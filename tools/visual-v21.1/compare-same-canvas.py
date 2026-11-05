"""Visual QA of Home and Showcase with identical fixture/camera/canvas size."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat
import json

root = Path(__file__).resolve().parents[2]
evidence = root / "evidence/v21.1"
home_path = evidence / "home-canvas-same-fixture.png"
showcase_path = evidence / "showcase-canvas-same-fixture.png"
with Image.open(home_path) as source_home, Image.open(showcase_path) as source_showcase:
    home = source_home.convert("RGB")
    showcase = source_showcase.convert("RGB")
    if home.size != showcase.size or home.size != (1280, 720):
        raise ValueError(f"Canvas sizes differ: {home.size} vs {showcase.size}")
    difference = ImageChops.difference(home, showcase)
    stat = ImageStat.Stat(difference)
    mean_absolute = sum(stat.mean) / 3
    changed = sum(1 for pixel in difference.get_flattened_data() if max(pixel) > 12)
    panel = Image.new("RGB", (2560, 762), "#07101e")
    panel.paste(home, (0, 42))
    panel.paste(showcase, (1280, 42))
    draw = ImageDraw.Draw(panel)
    font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
    draw.text((22, 9), "HOME / DEVELOPED FIXTURE / 1280 x 720 CANVAS", fill="white", font=font)
    draw.text((1302, 9), "SHOWCASE / SAME FIXTURE / SAME CAMERA", fill="white", font=font)
    panel.save(evidence / "home-vs-showcase-same-canvas.png")
    # The pixel metric is diagnostic only; dynamic WebGL frames can differ.
    metrics = {"canvas": [1280, 720], "meanAbsoluteRgb": mean_absolute,
               "pixelsDifferingByMoreThan12": changed,
               "fractionDifferingByMoreThan12": changed / (1280 * 720)}
    (evidence / "same-canvas-metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
