"""Create a labeled bed-only reference/studio preview comparison.

This is asset review evidence, not proof of the Home renderer.
"""

from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
reference = Image.open(root / "references/visual-v18/REF-D-developed.jpg").convert("RGB")
preview = Image.open(root / "assets/apartment/bed/preview.png").convert("RGB")

reference = reference.crop((500, 132, 974, 425))
preview = preview.crop((160, 175, 1140, 765))
height = 500
reference = reference.resize((round(reference.width * height / reference.height), height))
preview = preview.resize((round(preview.width * height / preview.height), height))
margin, caption = 18, 42
canvas = Image.new("RGB", (reference.width + preview.width + 3 * margin, height + caption + 2 * margin), (25, 27, 34))
canvas.paste(reference, (margin, margin + caption))
canvas.paste(preview, (2 * margin + reference.width, margin + caption))
draw = ImageDraw.Draw(canvas)
draw.text((margin, margin + 12), "REF-D bed crop", fill=(243, 239, 230))
draw.text((2 * margin + reference.width, margin + 12), "Blender V21.1 bed preview (not Home)", fill=(243, 239, 230))
canvas.save(root / "assets/apartment/bed/reference-vs-preview.png")
