"""Measure opaque chassis pixels inside live title and control rectangles."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public/lifelevel-frames"
SPEC = importlib.util.spec_from_file_location("responsive_parts", ROOT / "tools/audit-responsive-frame-parts.py")
assert SPEC and SPEC.loader
PARTS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PARTS)
COORDINATES = json.loads((ROOT / "lifelevel_1to1_kit/frame-coordinates.json").read_text(encoding="utf-8"))["frames"]


def hit(alpha: np.ndarray, frame: list[float], box: dict) -> dict:
    left = max(0, round(box["x"] - frame[0]))
    top = max(0, round(box["y"] - frame[1]))
    right = min(alpha.shape[1], round(box["x"] + box["width"] - frame[0]))
    bottom = min(alpha.shape[0], round(box["y"] + box["height"] - frame[1]))
    if right <= left or bottom <= top:
        return {"opaque": 0, "visible": 0, "area": 0}
    crop = alpha[top:bottom, left:right]
    return {"opaque": int((crop >= 128).sum()), "visible": int((crop >= 32).sum()), "area": int(crop.size)}


def main() -> None:
    result = {}
    for filename in sys.argv[1:]:
        file = Path(filename)
        data = json.loads(file.read_text(encoding="utf-8"))["geometry"]
        wide = data["viewport"]["width"] > 1840
        entries = {}
        for name, source in COORDINATES.items():
            if wide:
                frame = next((item["frame"] for item in data["responsivePaths"] if item["name"] == name and item["frame"][2] > 0), None)
                if not frame:
                    continue
                alpha = np.asarray(PARTS.assembled(name, round(frame[2]), round(frame[3])).getchannel("A"))
            else:
                x1, y1, x2, y2 = source["box"]
                frame = [x1, y1, x2 - x1, y2 - y1]
                alpha = np.asarray(Image.open(ART / f"{name}.png").convert("RGBA").getchannel("A"))
            region = data["visualRegions"][name]
            titles = [hit(alpha, frame, box) for box in region["titles"]]
            controls = [hit(alpha, frame, box) for box in region["controls"]]
            entries[name] = {
                "titles": titles,
                "controls": controls,
                "opaqueTitlePixels": sum(item["opaque"] for item in titles),
                "controlsWithOpaqueArt": sum(item["opaque"] > 0 for item in controls),
            }
        result[file.stem] = entries
    output = ROOT / "artifacts/frame-audit-20261028/refinement-content-safe.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({capture: {name: {"titleOpaque": row["opaqueTitlePixels"], "controlsWithOpaqueArt": row["controlsWithOpaqueArt"]} for name, row in entries.items()} for capture, entries in result.items()}, separators=(",", ":")))


if __name__ == "__main__":
    main()
