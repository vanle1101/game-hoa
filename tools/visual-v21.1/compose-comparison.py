"""Put the supplied REF-D beside a real browser screenshot for visual QA."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

width, height, band = 1280, 720, 42
root = Path(__file__).resolve().parents[2]
label = sys.argv[1] if len(sys.argv) > 1 else "baseline"
same_label = sys.argv[2] if len(sys.argv) > 2 else "same-fixture"
pairs = [
    (
        root / "references/visual-v21.1/REF-D-developed.jpg",
        root / f"evidence/v21.1/showcase-{label}.png",
        root / f"evidence/v21.1/reference-vs-showcase-{label}.png",
        "REF-D / USER-SUPPLIED REFERENCE",
        f"CURRENT GAME / {label.upper().replace('-', ' ')} CAPTURE",
    ),
    (
        root / f"evidence/v21.1/home-{same_label}.png",
        root / f"evidence/v21.1/showcase-{same_label}.png",
        root / f"evidence/v21.1/home-vs-showcase-{same_label}.png",
        "HOME / DEVELOPED READ-ONLY FIXTURE",
        "SHOWCASE / DEVELOPED FIXTURE",
    ),
]

for left, right, output, left_label, right_label in pairs:
    if not left.exists() or not right.exists():
        continue
    with Image.open(left) as left_image, Image.open(right) as right_image:
        left_panel = ImageOps.fit(left_image.convert("RGB"), (width, height), method=Image.Resampling.LANCZOS)
        right_panel = ImageOps.fit(right_image.convert("RGB"), (width, height), method=Image.Resampling.LANCZOS)
        result = Image.new("RGB", (width * 2, height + band), "#07101e")
        result.paste(left_panel, (0, band))
        result.paste(right_panel, (width, band))
        draw = ImageDraw.Draw(result)
        font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
        draw.text((22, 9), left_label, fill="white", font=font)
        draw.text((width + 22, 9), right_label, fill="white", font=font)
        result.save(output)
    print(output)
