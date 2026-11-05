"""Crop only the default character's two non-interactive portrait images.

The default portrait is a presentation asset. The actual avatar canvas and
the card's navigation button remain in the DOM, and custom avatars never use
these reference crops.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "references" / "life-level-dashboard-reference.png"
OUTPUT = ROOT / "public" / "assets" / "reference-hud"

PORTRAITS = {
    "today-starter-portrait.png": (315, 201, 420, 358),
    "character-starter-portrait.png": (949, 523, 1044, 665),
}


def main() -> None:
    image = Image.open(REFERENCE).convert("RGB")
    if image.size != (1801, 873):
        raise SystemExit(f"Expected 1801 × 873 reference, received {image.size}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, box in PORTRAITS.items():
        image.crop(box).save(OUTPUT / name, optimize=True)


if __name__ == "__main__":
    main()
