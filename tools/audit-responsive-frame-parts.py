"""Audit tiled desktop frame reconstruction, seams, LEDs and content bounds."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public/lifelevel-frames"
SPEC = importlib.util.spec_from_file_location("frame_builder", ROOT / "tools/build-fluid-mechanical-frame.py")
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)
NAMES = BUILDER.TODAY_NAMES


def assembled(name: str, width: int, height: int) -> Image.Image:
    source = Image.open(ART / f"{name}.png").convert("RGBA")
    seam = (199, 12, 144, 8) if name == "today" else BUILDER.TILED_SEAMS[name]
    x, strip_width, y, strip_height = seam
    xs = (0, x, width - (source.width - x - strip_width), width)
    ys = (0, y, height - (source.height - y - strip_height), height)
    result = Image.new("RGBA", (width, height))
    parts = ART / ("today-parts" if name == "today" else f"parts/{name}")
    for row in range(3):
        for column in range(3):
            piece = Image.open(parts / f"{NAMES[row][column]}.png").convert("RGBA")
            x1, x2 = xs[column], xs[column + 1]
            y1, y2 = ys[row], ys[row + 1]
            for py in range(y1, y2, piece.height):
                for px in range(x1, x2, piece.width):
                    patch = piece.crop((0, 0, min(piece.width, x2 - px), min(piece.height, y2 - py)))
                    result.alpha_composite(patch, (px, py))
    for index, (cx, cy, radius) in enumerate(BUILDER.GEOMETRY[name]["reactors"], 1):
        sprite = Image.open(ART / "reactors" / f"{name}_{index}.png").convert("RGBA")
        position = (cx - radius if cx < source.width / 2 else width - (source.width - cx - radius - 1) - sprite.width,
                    cy - radius if cy < source.height / 2 else height - (source.height - cy - radius - 1) - sprite.height)
        result.alpha_composite(sprite, position)
    return result


def seam_score(image: Image.Image, name: str) -> dict[str, float]:
    original = Image.open(ART / f"{name}.png").convert("RGBA")
    x, strip_width, y, strip_height = (199, 12, 144, 8) if name == "today" else BUILDER.TILED_SEAMS[name]
    xs = (x, x + strip_width, image.width - (original.width - x - strip_width))
    ys = (y, y + strip_height, image.height - (original.height - y - strip_height))
    pixels = np.asarray(image, np.float32)
    top = pixels[:min(y, 80)]
    left = pixels[:, :min(x, 80)]
    horizontal = [float(np.abs(top[:, px] - top[:, px - 1]).mean()) for px in xs if 0 < px < image.width]
    vertical = [float(np.abs(left[py] - left[py - 1]).mean()) for py in ys if 0 < py < image.height]
    return {"horizontalMeanRGBA": round(max(horizontal, default=0), 3),
            "verticalMeanRGBA": round(max(vertical, default=0), 3)}


def distance(mask: np.ndarray, x: float, y: float, radius: int = 8) -> float:
    x1, x2 = max(0, int(x) - radius), min(mask.shape[1], int(x) + radius + 2)
    y1, y2 = max(0, int(y) - radius), min(mask.shape[0], int(y) + radius + 2)
    pixels = np.argwhere(mask[y1:y2, x1:x2])
    if not len(pixels):
        return float(radius + 1)
    delta = pixels + np.array([y1 - y, x1 - x])
    return float(np.sqrt(np.square(delta).sum(axis=1).min()))


def main() -> None:
    capture = Path(sys.argv[1])
    data = json.loads(capture.read_text(encoding="utf-8"))["geometry"]
    info = {}
    for item in data["responsivePaths"]:
        name = item["name"]
        if not name:
            continue
        x, y, width, height = item["frame"]
        if width < 1 or height < 1:
            continue
        art = assembled(name, round(width), round(height))
        alpha = np.asarray(art.getchannel("A"))
        distances = [distance(alpha >= 32, px, py) for px, py in item["samples"]]
        native = Image.open(ART / f"{name}.png").convert("RGBA")
        native_reassembled = assembled(name, native.width, native.height)
        black = Image.new("RGBA", native.size, (0, 0, 0, 255))
        original = Image.alpha_composite(black, native).convert("RGB")
        rebuilt = Image.alpha_composite(black, native_reassembled).convert("RGB")
        error = sum(ImageStat.Stat(ImageChops.difference(original, rebuilt)).mean) / 3
        info[name] = {
            "frame": item["frame"], "nativeReconstructionMAE": round(error, 4),
            "ledNearMetal4Pct": round(100 * np.mean(np.asarray(distances) <= 4), 1),
            "ledFartherThan8": int(np.sum(np.asarray(distances) > 8)),
            "maxLedDistance": round(max(distances), 2),
            "visibleAlphaPixels": int((alpha >= 32).sum()),
            "seams": seam_score(art, name),
        }
        if error or info[name]["ledFartherThan8"]:
            raise AssertionError(f"{name}: bad part reconstruction or LED path; {info[name]}")
    out = capture.with_name(capture.stem + "-part-audit.json")
    out.write_text(json.dumps(info, indent=2), encoding="utf-8")
    print(json.dumps({"frames": {name: {k: value for k, value in row.items() if k != "frame"} for name, row in info.items()}, "file": str(out)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
