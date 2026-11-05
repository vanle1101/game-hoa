"""Search local skyline alignment numerically without displaying images."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SIZE = (450, 218)
reference = Image.open(ROOT / "lifelevel_1to1_kit/reference.png").convert("L").resize(SIZE)
mask_image = Image.open(ROOT / "artifacts/frame-audit-20261028/refinement-baseline-masks/skills/mask-background.png").convert("L").resize((160, 107))
mask = np.zeros((SIZE[1], SIZE[0]), dtype=bool)
mask[109:216, 65:225] = np.asarray(mask_image) > 127


def highpass(image: Image.Image) -> np.ndarray:
    return np.asarray(image, np.float32) - np.asarray(image.filter(ImageFilter.GaussianBlur(2)), np.float32)


def cover(source: Path) -> Image.Image:
    image = Image.open(source).convert("L")
    scale = max(SIZE[0] / image.width, SIZE[1] / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)))
    left = (image.width - SIZE[0]) // 2
    top = (image.height - SIZE[1]) // 2
    return image.crop((left, top, left + SIZE[0], top + SIZE[1]))


ref = highpass(reference)
for file in ("public/assets/cyberpunk-bg.png", "public/assets/lobby-reference/city-blur.jpg", "public/assets/1.png"):
    target = highpass(cover(ROOT / file))
    scores = []
    for dy in range(-25, 26, 2):
        for dx in range(-25, 26, 2):
            x0, x1 = max(0, dx), min(SIZE[0], SIZE[0] + dx)
            y0, y1 = max(0, dy), min(SIZE[1], SIZE[1] + dy)
            selected = mask[y0:y1, x0:x1]
            a = ref[y0:y1, x0:x1][selected]
            b = target[y0 - dy:y1 - dy, x0 - dx:x1 - dx][selected]
            if len(a) > 500 and a.std() > 0 and b.std() > 0:
                scores.append((float(np.corrcoef(a, b)[0, 1]), dx * 4, dy * 4))
    same = min(scores, key=lambda item: abs(item[1]) + abs(item[2]))
    print(f"{file}: aligned edge correlation {same[0]:.3f}; best in ±100 px {max(scores)}")
