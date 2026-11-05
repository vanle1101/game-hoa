"""Text-only error distribution by the prepared frame asset's opacity."""

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
geometry = json.loads((ROOT / "lifelevel_1to1_kit/frame-coordinates.json").read_text(encoding="utf-8"))["frames"]
reference = np.asarray(Image.open(ROOT / "lifelevel_1to1_kit/reference.png").convert("RGB"), dtype=np.float32)
current = np.asarray(Image.open(ROOT / "artifacts/frame-audit-20261028/final-1801x873.png").convert("RGB"), dtype=np.float32)
bands = ((0, 1), (1, 64), (64, 192), (192, 255), (255, 256))
result = {}
for name, frame in geometry.items():
    x1, y1, x2, y2 = frame["box"]
    alpha = np.asarray(Image.open(ROOT / "public/lifelevel-frames" / f"{name}.png").convert("RGBA"))[:, :, 3]
    asset_rgb = np.asarray(Image.open(ROOT / "public/lifelevel-frames" / f"{name}.png").convert("RGB"), dtype=np.float32)
    delta = np.abs(reference[y1:y2, x1:x2] - current[y1:y2, x1:x2]).mean(axis=2)
    result[name] = {}
    opaque = alpha == 255
    result[name]["assetVsReferenceOpaqueMAE"] = round(float(np.abs(reference[y1:y2, x1:x2] - asset_rgb).mean(axis=2)[opaque].mean()), 2)
    for low, high in bands:
        selected = (alpha >= low) & (alpha < high)
        result[name][f"{low}-{high - 1}"] = {"mae": round(float(delta[selected].mean()), 2), "pixels": int(selected.sum())} if selected.any() else None
output = ROOT / "artifacts/frame-audit-20261028/asset-mask-audit.json"
output.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, separators=(",", ":")))
