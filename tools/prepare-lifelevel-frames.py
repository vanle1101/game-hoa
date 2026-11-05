#!/usr/bin/env python3
"""Install the reference-derived frame kit without copying flattened UI text.

The source PNGs were masked from a screenshot. A few retained inner-edge strips
contain labels from the screenshot, so those small strips are made transparent.
The source kit remains untouched; circular reactors and metal perimeter art are
copied at their original pixel dimensions.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter


FRAMES = {
    "header": (1494, 99),
    "sidebar": (264, 783),
    "today": (632, 321),
    "boss": (471, 321),
    "ai": (424, 324),
    "skills": (638, 428),
    "character": (475, 276),
    "achievements": (475, 182),
    "rewards": (421, 428),
}

REACTORS = {
    "achievements_1": (61, 61),
    "ai_1": (77, 77),
    "boss_1": (79, 79),
    "character_1": (79, 79),
    "header_1": (97, 97),
    "rewards_1": (81, 81),
    "sidebar_1": (79, 79),
    "skills_1": (83, 83),
    "today_1": (79, 79),
    "today_2": (97, 97),
}

OLD_FRAME_NAMES = {"ai": "butler", "skills": "skill"}

# Sprite centers are taken directly from frame-coordinates.json in the kit.
REACTOR_PLACEMENTS = {
    "header": [("header_1", 49, 49)],
    "sidebar": [("sidebar_1", 40, 43)],
    "today": [("today_1", 39, 38), ("today_2", 581, 272)],
    "boss": [("boss_1", 36, 39)],
    "ai": [("ai_1", 46, 38)],
    "skills": [("skills_1", 47, 39)],
    "character": [("character_1", 39, 40)],
    "achievements": [("achievements_1", 39, 29)],
    "rewards": [("rewards_1", 43, 42)],
}

# Pixel bounds inside each crop. These cover flattened panel labels while
# ending before the source-extracted chrome tracks and circular reactors.
TEXT_STRIPS = {
    "sidebar": [(47, 742, 145, 760)],
    "ai": [(72, 282, 390, 306)],
    "character": [(158, 232, 449, 258), (410, 217, 449, 262)],
    "achievements": [(405, 129, 450, 152)],
}


def prepare_frame(
    source: Path,
    target: Path,
    old_mask_source: Path,
    reactor_source: Path,
    name: str,
    size: tuple[int, int],
) -> None:
    image = Image.open(source).convert("RGBA")
    if image.size != size:
        raise ValueError(f"{source}: expected {size}, got {image.size}")
    old_name = OLD_FRAME_NAMES.get(name, name)
    old_mask = Image.open(old_mask_source / f"{old_name}.png").convert("RGBA").getchannel("A")
    old_mask = old_mask.resize(size, Image.Resampling.BICUBIC)
    reactor_mask = Image.new("L", size, 0)
    for sprite_name, cx, cy in REACTOR_PLACEMENTS[name]:
        sprite = Image.open(reactor_source / f"{sprite_name}.png").convert("RGBA")
        if sprite.size != REACTORS[sprite_name]:
            raise ValueError(f"Unexpected reactor size: {sprite_name} {sprite.size}")
        reactor_mask.paste(
            sprite.getchannel("A"),
            (cx - sprite.width // 2, cy - sprite.height // 2),
        )
    # The old traced masks are narrower than the broad screenshot crop bands.
    # Keep only their overlap with the kit mask, plus exact ring sprite alpha.
    alpha = ImageChops.darker(
        image.getchannel("A"),
        ImageChops.lighter(old_mask, reactor_mask),
    )
    if name in TEXT_STRIPS:
        keep = Image.new("L", size, 255)
        draw = ImageDraw.Draw(keep)
        for rect in TEXT_STRIPS[name]:
            draw.rectangle(rect, fill=0)
        keep = keep.filter(ImageFilter.GaussianBlur(1.0))
        alpha = ImageChops.multiply(alpha, keep)
    image.putalpha(alpha)
    image.save(target, optimize=True)


def main() -> None:
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=project / "lifelevel_1to1_kit/assets",
        help="Extracted kit assets directory",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=project / "public/lifelevel-frames",
        help="Next.js public asset directory",
    )
    parser.add_argument(
        "--mask-source",
        type=Path,
        default=project / "public/assets/reference-hud",
        help="Previous conservatively traced mask directory",
    )
    args = parser.parse_args()
    args.dest.mkdir(parents=True, exist_ok=True)
    (args.dest / "reactors").mkdir(parents=True, exist_ok=True)
    for name, size in FRAMES.items():
        prepare_frame(
            args.source / f"{name}.png",
            args.dest / f"{name}.png",
            args.mask_source,
            args.source / "reactors",
            name,
            size,
        )
    for name, size in REACTORS.items():
        source = args.source / "reactors" / f"{name}.png"
        image = Image.open(source).convert("RGBA")
        if image.size != size:
            raise ValueError(f"{source}: expected {size}, got {image.size}")
        image.save(args.dest / "reactors" / f"{name}.png", optimize=True)
    print(f"Prepared {len(FRAMES)} frames and {len(REACTORS)} reactors in {args.dest}")


if __name__ == "__main__":
    main()
