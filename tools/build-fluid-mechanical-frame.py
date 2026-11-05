"""Prepare scalable chassis art from the supplied reference-derived frame kit.

Each reactor is removed from its source frame's alpha and placed back as a
separate unscaled sprite in the UI. The remaining source pixels form a CSS
nine-slice border without stretching circular parts into ovals.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SOURCE = ROOT / "public" / "lifelevel-frames"
KIT_ROOT = ROOT / "lifelevel_1to1_kit"
SOURCE = PUBLIC_SOURCE if (PUBLIC_SOURCE / "boss.png").exists() else KIT_ROOT / "assets"
OUTPUT = PUBLIC_SOURCE / "fluid"
TODAY_PARTS = PUBLIC_SOURCE / "today-parts"
# A 12 px horizontal seam and an 8 px vertical seam cross the least detailed
# straight channels. Tiling those strips adds length without scaling the metal.
TODAY_X = (0, 199, 211, 632)
TODAY_Y = (0, 144, 152, 321)
TODAY_NAMES = (
    ("top-left", "top-middle", "top-right"),
    ("middle-left", "middle-middle", "middle-right"),
    ("bottom-left", "bottom-middle", "bottom-right"),
)
TILED_SEAMS = {
    "header": (540, 8, 45, 8),
    "sidebar": (128, 8, 236, 8),
    "boss": (317, 8, 145, 8),
    "ai": (224, 8, 167, 8),
    "skills": (354, 12, 272, 8),
    "character": (317, 8, 134, 8),
    "achievements": (314, 8, 87, 8),
    "rewards": (167, 8, 245, 8),
}
GEOMETRY = json.loads((KIT_ROOT / "frame-coordinates.json").read_text(encoding="utf-8"))["frames"]


def remove_reactor(chassis: Image.Image, sprite: Image.Image, x: int, y: int) -> None:
    """Recover the residual alpha so source-over compositing restores frame."""
    for sprite_y in range(sprite.height):
        frame_y = y + sprite_y
        if frame_y < 0 or frame_y >= chassis.height:
            continue
        for sprite_x in range(sprite.width):
            frame_x = x + sprite_x
            if frame_x < 0 or frame_x >= chassis.width:
                continue
            pixel = chassis.getpixel((frame_x, frame_y))
            sprite_alpha = sprite.getpixel((sprite_x, sprite_y))[3]
            if not sprite_alpha:
                continue
            original_alpha = pixel[3]
            residual = 0 if sprite_alpha == 255 else round(
                255 * max(0, original_alpha - sprite_alpha) / (255 - sprite_alpha)
            )
            chassis.putpixel((frame_x, frame_y), (*pixel[:3], min(255, residual)))


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    TODAY_PARTS.mkdir(parents=True, exist_ok=True)
    for name, coordinates in GEOMETRY.items():
        frame = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        if list(frame.size) != coordinates["size"]:
            raise ValueError(f"Unexpected {name} frame geometry: {frame.size}")
        chassis = frame.copy()
        for index, (cx, cy, radius) in enumerate(coordinates["reactors"], start=1):
            reactor = Image.open(SOURCE / "reactors" / f"{name}_{index}.png").convert("RGBA")
            if reactor.size != (2 * radius + 1, 2 * radius + 1):
                raise ValueError(f"Unexpected {name} reactor geometry: {reactor.size}")
            remove_reactor(chassis, reactor, cx - radius, cy - radius)
        chassis.save(OUTPUT / f"{name}-chassis.png", optimize=True)
        if name == "today":
            for row in range(3):
                for column in range(3):
                    part = chassis.crop((
                        TODAY_X[column], TODAY_Y[row],
                        TODAY_X[column + 1], TODAY_Y[row + 1],
                    ))
                    part.save(TODAY_PARTS / f"{TODAY_NAMES[row][column]}.png", optimize=True)
        elif name in TILED_SEAMS:
            x, strip_width, y, strip_height = TILED_SEAMS[name]
            xs = (0, x, x + strip_width, frame.width)
            ys = (0, y, y + strip_height, frame.height)
            part_dir = PUBLIC_SOURCE / "parts" / name
            part_dir.mkdir(parents=True, exist_ok=True)
            for row in range(3):
                for column in range(3):
                    chassis.crop((xs[column], ys[row], xs[column + 1], ys[row + 1])).save(
                        part_dir / f"{TODAY_NAMES[row][column]}.png", optimize=True
                    )

        # Recompose all turbines to detect any crop/coordinate mismatch.
        reconstruction = Image.new("RGBA", frame.size)
        reconstruction.alpha_composite(chassis)
        for index, (cx, cy, radius) in enumerate(coordinates["reactors"], start=1):
            reactor = Image.open(SOURCE / "reactors" / f"{name}_{index}.png").convert("RGBA")
            reconstruction.alpha_composite(reactor, (cx - radius, cy - radius))
        black = Image.new("RGBA", frame.size, (0, 0, 0, 255))
        source_rgb = Image.alpha_composite(black, frame).convert("RGB")
        rebuilt_rgb = Image.alpha_composite(black, reconstruction).convert("RGB")
        delta = ImageChops.difference(source_rgb, rebuilt_rgb)
        error = sum(ImageStat.Stat(delta).mean) / 3
        print(f"{name}: source/reconstruction RGB MAE = {error:.4f}/255")


if __name__ == "__main__":
    main()
