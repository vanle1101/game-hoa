"""Text-only 1801x873 visual comparison; all image artifacts stay on disk."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "lifelevel_1to1_kit/reference.png"
GEOMETRY = ROOT / "lifelevel_1to1_kit/frame-coordinates.json"


def ssim(reference: np.ndarray, actual: np.ndarray) -> float:
    """Mean local luminance SSIM with an 11px Gaussian window."""
    a = np.asarray(Image.fromarray(reference).convert("L"), np.float32)
    b = np.asarray(Image.fromarray(actual).convert("L"), np.float32)

    offsets = np.arange(-5, 6)
    weights = np.exp(-(offsets**2) / (2 * 1.5**2)).astype(np.float32)
    weights /= weights.sum()

    def blur(array: np.ndarray) -> np.ndarray:
        padded_x = np.pad(array, ((0, 0), (5, 5)), mode="reflect")
        horizontal = sum(weight * padded_x[:, 5 + offset : 5 + offset + array.shape[1]] for offset, weight in zip(offsets, weights))
        padded_y = np.pad(horizontal, ((5, 5), (0, 0)), mode="reflect")
        return sum(weight * padded_y[5 + offset : 5 + offset + array.shape[0], :] for offset, weight in zip(offsets, weights))

    mu_a, mu_b = blur(a), blur(b)
    var_a = np.maximum(0, blur(a * a) - mu_a * mu_a)
    var_b = np.maximum(0, blur(b * b) - mu_b * mu_b)
    cov = blur(a * b) - mu_a * mu_b
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    score = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / (
        (mu_a * mu_a + mu_b * mu_b + c1) * (var_a + var_b + c2)
    )
    return float(np.mean(score[5:-5, 5:-5])) if min(score.shape) > 10 else float(np.mean(score))


def metrics(a: np.ndarray, b: np.ndarray, mask: np.ndarray | None = None) -> dict:
    delta = np.abs(a.astype(np.float32) - b.astype(np.float32))
    selected = delta[mask] if mask is not None else delta
    return {"mae": round(float(selected.mean()), 3), "rmse": round(float(np.sqrt(np.mean(selected**2))), 3)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--reference", type=Path, default=REFERENCE)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/frame-audit-20261028/compare")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    reference_image = Image.open(args.reference).convert("RGB")
    actual_image = Image.open(args.screenshot).convert("RGB")
    if reference_image.size != (1801, 873) or actual_image.size != reference_image.size:
        raise ValueError(f"Images must both be 1801x873; got {reference_image.size}, {actual_image.size}")
    a, b = np.asarray(reference_image), np.asarray(actual_image)
    geometry = json.loads(GEOMETRY.read_text(encoding="utf-8"))["frames"]
    browser_file = args.screenshot.with_suffix(".json")
    browser = json.loads(browser_file.read_text(encoding="utf-8")) if browser_file.exists() else {}
    panels = browser.get("geometry", {}).get("panels", {})
    result = {"viewport": [1801, 873], "reference": str(args.reference), "whole": {**metrics(a, b), "ssim": round(ssim(a, b), 4)}, "frames": {}}
    for name, frame in geometry.items():
        x1, y1, x2, y2 = frame["box"]
        ref_crop, actual_crop = a[y1:y2, x1:x2], b[y1:y2, x1:x2]
        left, top, right, bottom = frame["ring"]
        ring = np.ones(ref_crop.shape[:2], bool)
        ring[top : ref_crop.shape[0] - bottom, left : ref_crop.shape[1] - right] = False
        measured = panels.get(name)
        target = {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}
        offset = {key: round(measured[key] - value, 2) for key, value in target.items()} if measured else None
        result["frames"][name] = {
            "box": frame["box"], "panelDelta": offset,
            "whole": {**metrics(ref_crop, actual_crop), "ssim": round(ssim(ref_crop, actual_crop), 4)},
            "ring": metrics(ref_crop, actual_crop, ring),
            "center": metrics(ref_crop, actual_crop, ~ring),
        }
    Image.blend(reference_image, actual_image, 0.5).save(args.out / "overlay.png")
    delta = np.abs(a.astype(np.float32) - b.astype(np.float32))
    Image.fromarray(np.clip(delta, 0, 255).astype(np.uint8)).save(args.out / "difference.png")
    heat = delta.mean(axis=2)
    colors = np.zeros_like(a)
    colors[:, :, 0] = np.clip(heat * 2.7, 0, 255)
    colors[:, :, 1] = np.clip((heat - 65) * 1.7, 0, 255)
    colors[:, :, 2] = np.clip((heat - 145) * 1.8, 0, 255)
    Image.fromarray(colors).save(args.out / "heatmap.png")
    (args.out / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    summary = {
        "whole": result["whole"],
        "frames": {name: {"ringMAE": value["ring"]["mae"], "ssim": value["whole"]["ssim"], "panelDelta": value["panelDelta"]} for name, value in result["frames"].items()},
        "files": str(args.out),
    }
    print(json.dumps(summary, separators=(",", ":")))


if __name__ == "__main__":
    main()
