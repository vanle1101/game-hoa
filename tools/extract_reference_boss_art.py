"""Extract only the non-interactive boss illustration from the supplied HUD reference.

The lower artwork fades into the existing source asset so the live icon buttons
and dynamic boss information are never baked into a reused image.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
reference = Image.open(ROOT / "references/life-level-dashboard-reference.png").convert("RGBA")
art = reference.crop((944, 202, 1123, 404))
pixels = art.load()

for y in range(art.height):
    for x in range(art.width):
        if x < 6 or y >= 168:
            alpha = 0
        elif y <= 150:
            alpha = 255
        else:
            alpha = round(255 * (168 - y) / 18)
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = r, g, b, alpha

target = ROOT / "public/assets/reference-hud/boss-art-overlay.png"
target.parent.mkdir(parents=True, exist_ok=True)
art.save(target)
print(target)
