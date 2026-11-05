"""Find repeatable straight-channel seams in reference-derived chassis pixels."""

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "public/lifelevel-frames/fluid"
NAMES = ("header", "sidebar", "boss", "ai", "skills", "character", "achievements", "rewards")


def score(a: np.ndarray, b: np.ndarray) -> tuple[float, int]:
    alpha = np.maximum(a[:, 3], b[:, 3]) / 255
    visible = int((alpha > .13).sum())
    error = np.abs(a[:, :3] - b[:, :3]).mean(axis=1)
    return float(np.dot(error, alpha) / max(alpha.sum(), 1)), visible


for name in NAMES:
    image = np.asarray(Image.open(ROOT / f"{name}-chassis.png").convert("RGBA"), np.float32)
    height, width = image.shape[:2]
    xs = []
    for x in range(max(100, int(width * .25)), min(width - 100, int(width * .7))):
        for period in (8, 12, 16, 20):
            if x + period >= width - 80:
                continue
            error, visible = score(image[:, x + period - 1], image[:, x])
            if visible >= 15:
                xs.append((round(error, 3), x, period, visible))
    ys = []
    for y in range(max(60, int(height * .23)), min(height - 60, int(height * .7))):
        for period in (8, 12, 16, 20):
            if y + period >= height - 55:
                continue
            error, visible = score(image[y + period - 1], image[y])
            if visible >= 15:
                ys.append((round(error, 3), y, period, visible))
    print(name, "x", sorted(xs)[:5], "y", sorted(ys)[:5])
