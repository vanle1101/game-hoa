"""Compare real Chrome document pixels to a same-viewport Playwright capture."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "tools/compare-lifelevel-frame.py"
spec = importlib.util.spec_from_file_location("lifelevel_metrics", MODULE)
metrics_module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(metrics_module)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("live", type=Path)
    parser.add_argument("automated", type=Path)
    parser.add_argument("--diagnostic", type=Path, default=ROOT / "artifacts/frame-audit-20261028/live-chrome-diagnostic.json")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    live_image = Image.open(args.live).convert("RGB")
    automated_image = Image.open(args.automated).convert("RGB")
    if live_image.size != automated_image.size:
        raise ValueError(f"Captures have different dimensions: {live_image.size} and {automated_image.size}")
    live = np.asarray(live_image)
    automated = np.asarray(automated_image)
    diagnostic = json.loads(args.diagnostic.read_text(encoding="utf-8-sig"))["browser"]
    capture = json.loads(args.automated.with_suffix(".json").read_text(encoding="utf-8"))["geometry"]
    result = {
        "dimensions": list(live_image.size),
        "whole": {**metrics_module.metrics(live, automated), "ssim": round(metrics_module.ssim(live, automated), 4)},
        "viewportMatch": diagnostic["inner"] == [capture["viewport"]["width"], capture["viewport"]["height"]],
        "dprMatch": diagnostic["dpr"] == capture["viewport"]["pixelRatio"],
        "urlMatch": diagnostic["href"] == capture["href"],
        "sessionMatch": diagnostic.get("session") == capture.get("session"),
        "serviceWorkerMatch": diagnostic.get("serviceWorker") == capture.get("serviceWorker"),
        "sourceFingerprintMatch": diagnostic.get("sourceFingerprint") == capture.get("sourceFingerprint"),
        "mediaMatch": all(diagnostic["media"].get(key) == value for key, value in capture["media"].items()),
        "panelDeltas": {},
        "regions": {},
    }
    for name, actual_rect in diagnostic["geometry"].items():
        capture_rect = capture.get("panels", {}).get(name) if name not in ("sidebar", "main") else (capture.get("panels", {}).get(name) if name == "sidebar" else capture.get("main"))
        if not actual_rect or not capture_rect:
            continue
        result["panelDeltas"][name] = [round(capture_rect[key] - actual_rect[index], 2) for index, key in enumerate(("x", "y", "width", "height"))]
        x, y, width, height = actual_rect
        x1, y1 = max(0, int(round(x))), max(0, int(round(y)))
        x2, y2 = min(live.shape[1], int(round(x + width))), min(live.shape[0], int(round(y + height)))
        if x2 > x1 and y2 > y1:
            result["regions"][name] = metrics_module.metrics(live[y1:y2, x1:x2], automated[y1:y2, x1:x2])
    Image.blend(live_image, automated_image, 0.5).save(args.out / "overlay.png")
    difference = np.abs(live.astype(np.float32) - automated.astype(np.float32))
    Image.fromarray(difference.astype(np.uint8)).save(args.out / "difference.png")
    heat = difference.mean(axis=2)
    colors = np.zeros_like(live)
    colors[:, :, 0] = np.clip(heat * 2.7, 0, 255)
    colors[:, :, 1] = np.clip((heat - 65) * 1.7, 0, 255)
    colors[:, :, 2] = np.clip((heat - 145) * 1.8, 0, 255)
    Image.fromarray(colors).save(args.out / "heatmap.png")
    (args.out / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"whole": result["whole"], "viewportMatch": result["viewportMatch"], "dprMatch": result["dprMatch"], "urlMatch": result["urlMatch"], "sessionMatch": result["sessionMatch"], "serviceWorkerMatch": result["serviceWorkerMatch"], "sourceFingerprintMatch": result["sourceFingerprintMatch"], "mediaMatch": result["mediaMatch"], "panelDeltas": result["panelDeltas"], "files": str(args.out)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
