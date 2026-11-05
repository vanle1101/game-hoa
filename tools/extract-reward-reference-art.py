"""Extract only the decorative reward artwork from the 1801x873 reference.

The coordinates stop above each card's title/price strip and inside its border.
Those labels, prices, and card borders are rendered by the live widget instead.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "life-level-dashboard-reference.png"
OUTPUT = ROOT / "public" / "assets" / "lobby-reference"

# (left, top, right, bottom); right and bottom are exclusive.
ART_CROPS = {
    "reward-ref-headphones.png": (1435, 557, 1591, 616),
    "reward-ref-outfit.png": (1602, 557, 1758, 616),
    "reward-ref-room.png": (1435, 661, 1591, 703),
    "reward-ref-resort.png": (1602, 661, 1758, 703),
    "reward-ref-bed.png": (1435, 750, 1591, 792),
    "reward-ref-coffee.png": (1602, 750, 1758, 792),
}


def main() -> None:
    with Image.open(SOURCE) as reference:
        if reference.size != (1801, 873):
            raise ValueError(f"Expected 1801x873 reference, got {reference.size}")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for filename, bounds in ART_CROPS.items():
            reference.crop(bounds).convert("RGB").save(OUTPUT / filename, optimize=True)


if __name__ == "__main__":
    main()
