"""Print compact alpha/vivid coordinate intervals for a few suspect rail spans."""

import numpy as np
from PIL import Image
from pathlib import Path

root = Path(__file__).resolve().parents[1]
frames = root / "public/lifelevel-frames"


def spans(values):
    indices = np.flatnonzero(values)
    if not len(indices):
        return []
    cuts = np.flatnonzero(np.diff(indices) > 1)
    parts = np.split(indices, cuts + 1)
    return [(int(part[0]), int(part[-1])) for part in parts if len(part) >= 2]


def masks(name):
    rgba = np.asarray(Image.open(frames / f"{name}.png").convert("RGBA"))
    rgb = rgba[:, :, :3]
    metal = rgba[:, :, 3] >= 32
    vivid = metal & (rgb.max(axis=2) > 95) & ((rgb.max(axis=2).astype(int) - rgb.min(axis=2).astype(int)) > 37)
    return metal, vivid


metal, vivid = masks("sidebar")
print("sidebar top: x => alpha y spans; vivid y spans (local)")
for x in (82, 100, 130, 160, 190, 220, 235):
    print(x, spans(metal[:70, x]), spans(vivid[:70, x]))
print("sidebar right: global y => alpha x spans; vivid x spans")
for y in (350, 370, 390, 410, 430, 450, 550, 570, 590, 610, 630):
    row = y - 81
    print(y, [(a + 140, b + 140) for a, b in spans(metal[row, 140:])], [(a + 140, b + 140) for a, b in spans(vivid[row, 140:])])

metal, vivid = masks("header")
print("header notches: global x => alpha y spans; vivid y spans (global)")
for x in (600, 620, 640, 660, 680, 990, 1010, 1030, 1050, 1070, 1510, 1530, 1550, 1570):
    col = x - 286
    print(x, [(a + 6, b + 6) for a, b in spans(metal[:, col])], [(a + 6, b + 6) for a, b in spans(vivid[:, col])])
