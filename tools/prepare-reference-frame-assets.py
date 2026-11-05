#!/usr/bin/env python3
"""Install the supplied reference crops, removing three captured text fragments.

The frame and turbine pixels still come from LIFELEVEL_1to1_frame_kit.zip.
Only alpha in small content areas is cleared so live React text shows through.
"""

from pathlib import Path
from PIL import Image, ImageDraw
import shutil


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lifelevel_1to1_kit" / "assets"
DESTINATION = ROOT / "public" / "lifelevel-frames"

FRAMES = (
    "header", "sidebar", "today", "boss", "ai", "skills",
    "character", "achievements", "rewards",
)

# Box coordinates are local to the kit's transparent crop. They cover text
# caught by the extraction band's mask, never the chrome rim or turbine.
CONTENT_FRAGMENTS = {
    "ai": (70, 279, 393, 307),
    "character": (155, 232, 446, 252),
    "achievements": (397, 135, 448, 153),
}


def main() -> None:
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in FRAMES:
        image = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        if name in CONTENT_FRAGMENTS:
            alpha = image.getchannel("A")
            ImageDraw.Draw(alpha).rectangle(CONTENT_FRAGMENTS[name], fill=0)
            image.putalpha(alpha)
        image.save(DESTINATION / f"{name}.png", optimize=True)

    reactors = DESTINATION / "reactors"
    reactors.mkdir(exist_ok=True)
    for path in (SOURCE / "reactors").glob("*.png"):
        shutil.copy2(path, reactors / path.name)

    print(f"Installed {len(FRAMES)} reference crops and reactor sprites in {DESTINATION}")


if __name__ == "__main__":
    main()
