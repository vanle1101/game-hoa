"""Text-only title and reactor geometry audit at the calibration viewport."""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAMES = json.loads((ROOT / "lifelevel_1to1_kit/frame-coordinates.json").read_text(encoding="utf-8"))["frames"]
ROI = {
    "today": (334, 155, 480, 201), "boss": (970, 150, 1210, 201),
    "ai": (1440, 150, 1640, 201), "skills": (350, 460, 540, 513),
    "character": (970, 465, 1130, 510), "achievements": (965, 715, 1140, 760),
    "rewards": (1445, 465, 1640, 510),
}


def overlap(first: tuple[float, float, float, float], second: tuple[float, float, float, float]) -> float:
    a, b, c, d = first
    x, y, z, w = second
    return round(max(0, min(a + c, x + z) - max(a, x)) * max(0, min(b + d, y + w) - max(b, y)), 2)


def light_box(image: np.ndarray, roi: tuple[int, int, int, int]) -> list[int]:
    x1, y1, x2, y2 = roi
    crop = image[y1:y2, x1:x2]
    white = (crop[:, :, 0] > 170) & (crop[:, :, 1] > 170) & (crop[:, :, 2] > 170)
    ys, xs = np.nonzero(white)
    return [int(xs.min() + x1), int(ys.min() + y1), int(xs.max() + x1), int(ys.max() + y1), len(xs)] if len(xs) else []


def cyan_box(image: np.ndarray, roi: tuple[int, int, int, int]) -> list[int]:
    x1, y1, x2, y2 = roi
    crop = image[y1:y2, x1:x2].astype(np.int16)
    cyan = (crop[:, :, 1] > 130) & (crop[:, :, 2] > 140) & (crop[:, :, 1] > crop[:, :, 0] * 1.5)
    ys, xs = np.nonzero(cyan)
    return [int(xs.min() + x1), int(ys.min() + y1), int(xs.max() + x1), int(ys.max() + y1), len(xs)] if len(xs) else []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    reference = np.asarray(Image.open(ROOT / "lifelevel_1to1_kit/reference.png").convert("RGB"))
    current = np.asarray(Image.open(args.screenshot).convert("RGB"))
    dom = json.loads(args.screenshot.with_suffix(".json").read_text(encoding="utf-8"))["geometry"]["visualRegions"]
    result = {}
    for name, roi in ROI.items():
        frame = FRAMES[name]
        fx, fy = frame["box"][:2]
        title = dom[name]["titles"][0]
        title_box = (title["x"], title["y"], title["width"], title["height"])
        reactors = [(fx + cx - radius, fy + cy - radius, 2 * radius + 1, 2 * radius + 1)
                    for cx, cy, radius in frame["reactors"]]
        result[name] = {
            "referenceLightBox": light_box(reference, roi),
            "applicationLightBox": light_box(current, roi),
            "titleBox": title_box,
            "reactorBoxOverlaps": [overlap(title_box, reactor) for reactor in reactors],
        }
        left = max(int(title_box[0]), fx)
        top = max(int(title_box[1]), fy)
        right = min(int(title_box[0] + title_box[2]), frame["box"][2])
        bottom = min(int(title_box[1] + title_box[3]), frame["box"][3])
        if right > left and bottom > top:
            alpha = np.asarray(Image.open(ROOT / "public/lifelevel-frames" / f"{name}.png").convert("RGBA"))[:, :, 3]
            clear = alpha[top - fy:bottom - fy, left - fx:right - fx] < 32
            ref_badge = reference[top:bottom, left:right]
            app_badge = current[top:bottom, left:right]
            dark = clear & (ref_badge.max(axis=2) < 95) & (app_badge.max(axis=2) < 95)
            for label, pixels in (("reference", ref_badge), ("application", app_badge)):
                white = clear & (pixels[:, :, 0] > 170) & (pixels[:, :, 1] > 170) & (pixels[:, :, 2] > 170)
                ys, xs = np.nonzero(white)
                result[name][f"{label}BadgeLightBox"] = [int(xs.min() + left), int(ys.min() + top), int(xs.max() + left), int(ys.max() + top), len(xs)] if len(xs) else []
            result[name]["clearDarkPixels"] = int(dark.sum())
            if dark.any():
                result[name]["referenceDarkMedian"] = np.median(ref_badge[dark], axis=0).astype(int).tolist()
                result[name]["applicationDarkMedian"] = np.median(app_badge[dark], axis=0).astype(int).tolist()
        if name == "skills":
            result[name]["referenceIconBox"] = cyan_box(reference, (348, 470, 390, 510))
            result[name]["applicationIconBox"] = cyan_box(current, (348, 470, 390, 510))
    output = args.out or args.screenshot.with_name(args.screenshot.stem + "-titles.json")
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
