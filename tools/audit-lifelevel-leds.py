"""Numerically check traced SVG routes against the extracted frame pixels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAMES = ROOT / "public/lifelevel-frames"
GEOMETRY = ROOT / "lifelevel_1to1_kit/frame-coordinates.json"


def nearest(mask: np.ndarray, x: float, y: float, radius: int = 10) -> float:
    x1, x2 = max(0, int(x) - radius), min(mask.shape[1], int(x) + radius + 2)
    y1, y2 = max(0, int(y) - radius), min(mask.shape[0], int(y) + radius + 2)
    locations = np.argwhere(mask[y1:y2, x1:x2])
    if not len(locations):
        return float(radius + 1)
    dx = locations[:, 1] + x1 - x
    dy = locations[:, 0] + y1 - y
    return float(np.sqrt(np.min(dx * dx + dy * dy)))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("capture_json", type=Path)
    args = parser.parse_args()
    capture = json.loads(args.capture_json.read_text(encoding="utf-8"))
    paths = capture["geometry"]["ledPaths"]
    frames = json.loads(GEOMETRY.read_text(encoding="utf-8"))["frames"]
    result = {}
    for name, points in paths.items():
        x1, y1, _, _ = frames[name]["box"]
        sprite = np.asarray(Image.open(FRAMES / f"{name}.png").convert("RGBA"))
        rgb = sprite[:, :, :3].astype(np.float32)
        alpha = sprite[:, :, 3]
        metal = alpha >= 32
        # High-saturation cyan, magenta, and violet pixels in the extracted circuit.
        vivid = metal & (rgb.max(axis=2) > 95) & ((rgb.max(axis=2) - rgb.min(axis=2)) > 37)
        alpha_dist = [nearest(metal, px - x1, py - y1) for px, py in points]
        vivid_dist = [nearest(vivid, px - x1, py - y1) for px, py in points]
        outliers = np.asarray(alpha_dist) > 8
        runs = []
        first = None
        for index, bad in enumerate([*outliers, False]):
            if bad and first is None:
                first = index
            elif not bad and first is not None:
                runs.append([first, index - 1, [round(value, 1) for value in points[first]], [round(value, 1) for value in points[index - 1]]])
                first = None
        result[name] = {
            "nearMetal3Pct": round(100 * np.mean(np.asarray(alpha_dist) <= 3), 1),
            "nearVivid4Pct": round(100 * np.mean(np.asarray(vivid_dist) <= 4), 1),
            "medianMetalDistancePx": round(float(np.median(alpha_dist)), 2),
            "fartherThan8Px": int(np.sum(np.asarray(alpha_dist) > 8)),
            "outlierRuns": runs,
        }
    output = args.capture_json.with_name("led-path-audit.json")
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"paths": result, "file": str(output)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
