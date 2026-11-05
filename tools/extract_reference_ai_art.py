"""Extract the static robot portrait and transparent hologram ornament.

These assets contain no live game data or interactive controls. The parent
button and all NOVA suggestions remain normal DOM elements.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "life-level-dashboard-reference.png"
OUTPUT = ROOT / "public" / "assets" / "reference-hud"


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    if source.size != (1801, 873):
        raise SystemExit(f"Unexpected reference size: {source.size}")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    robot = source.crop((1434, 199, 1523, 280))
    robot.save(OUTPUT / "butler-robot.png", optimize=True)

    x0, y0, x1, y1 = 1568, 177, 1691, 284
    hologram = source.crop((x0, y0, x1, y1))
    scale = 4
    mask = Image.new("L", ((x1 - x0) * scale, (y1 - y0) * scale), 0)
    draw = ImageDraw.Draw(mask)
    polygon = [(1573, 212), (1681, 179), (1686, 257), (1571, 281)]
    draw.polygon([((x - x0) * scale, (y - y0) * scale) for x, y in polygon], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2 * scale))
    hologram.putalpha(mask.resize(hologram.size, Image.Resampling.LANCZOS))
    hologram.save(OUTPUT / "butler-hologram.png", optimize=True)


if __name__ == "__main__":
    main()
