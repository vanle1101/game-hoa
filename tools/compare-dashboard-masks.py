"""Compare nine dashboard regions by visual layer; all image output stays local."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("frame_metrics", ROOT / "tools/compare-lifelevel-frame.py")
assert SPEC and SPEC.loader
METRICS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(METRICS)
BOXES = json.loads((ROOT / "lifelevel_1to1_kit/frame-coordinates.json").read_text(encoding="utf-8"))["frames"]
LAYERS = ("chassis", "neon", "title", "controls", "background")


def rect_mask(size: tuple[int, int], boxes: list[dict], origin: tuple[int, int]) -> np.ndarray:
    image = Image.new("L", size, 0)
    painter = ImageDraw.Draw(image)
    for box in boxes:
        x1 = round(box["x"] - origin[0])
        y1 = round(box["y"] - origin[1])
        x2 = round(box["x"] + box["width"] - origin[0])
        y2 = round(box["y"] + box["height"] - origin[1])
        painter.rectangle((x1, y1, x2 - 1, y2 - 1), fill=255)
    return np.asarray(image) > 0


def neon_mask(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    color = rgb.astype(np.int16)
    r, g, b = color[:, :, 0], color[:, :, 1], color[:, :, 2]
    cyan = (g >= 72) & (b >= 82) & (g > r * 1.42) & (b > r * 1.38)
    magenta = (r >= 85) & (b >= 85) & (r > g * 1.48) & (b > g * 1.48)
    blue = (b >= 105) & (b > r * 1.55) & (b > g * 1.18)
    return (alpha >= 32) & (cyan | magenta | blue)


def stats(reference: np.ndarray, actual: np.ndarray, mask: np.ndarray) -> dict:
    if not mask.any():
        return {"pixels": 0, "mae": None, "rmse": None}
    result = METRICS.metrics(reference, actual, mask)
    return {"pixels": int(mask.sum()), **result,
            "referenceLuma": round(float(reference[mask].mean()), 2),
            "actualLuma": round(float(actual[mask].mean()), 2)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--reference", type=Path, default=ROOT / "lifelevel_1to1_kit/reference.png")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    ref_image = Image.open(args.reference).convert("RGB")
    app_image = Image.open(args.screenshot).convert("RGB")
    if ref_image.size != (1801, 873) or app_image.size != ref_image.size:
        raise ValueError("Both comparison images must be 1801×873")
    dom = json.loads(args.screenshot.with_suffix(".json").read_text(encoding="utf-8"))["geometry"]
    result = {"reference": str(args.reference), "screenshot": str(args.screenshot), "frames": {}}
    contact = Image.new("RGB", (3 * 638, 3 * 428), (2, 5, 13))
    draw = ImageDraw.Draw(contact)
    summary = {}
    for index, (name, frame) in enumerate(BOXES.items()):
        x1, y1, x2, y2 = frame["box"]
        origin = (x1, y1)
        size = (x2 - x1, y2 - y1)
        ref_crop = np.asarray(ref_image.crop((x1, y1, x2, y2)))
        app_crop = np.asarray(app_image.crop((x1, y1, x2, y2)))
        asset = Image.open(ROOT / "public/lifelevel-frames" / f"{name}.png").convert("RGBA")
        asset_rgb = np.asarray(asset.convert("RGB"))
        alpha = np.asarray(asset.getchannel("A"))
        region = dom["visualRegions"][name]
        title = rect_mask(size, region["titles"], origin)
        controls = rect_mask(size, region["controls"], origin)
        dynamic = rect_mask(size, region["dynamic"], origin)
        neon = neon_mask(asset_rgb, alpha) & ~title
        chassis = (alpha >= 32) & ~neon & ~title
        controls &= ~title & ~chassis & ~neon
        background = ~(title | controls | chassis | neon | dynamic)
        masks = {"chassis": chassis, "neon": neon, "title": title, "controls": controls, "background": background}
        frame_metrics = {layer: stats(ref_crop, app_crop, mask) for layer, mask in masks.items()}
        frame_metrics["controlsStatic"] = stats(ref_crop, app_crop, controls & ~dynamic)
        frame_metrics["dynamicContent"] = stats(ref_crop, app_crop, dynamic & ~(chassis | neon | title))
        frame_metrics["whole"] = {**METRICS.metrics(ref_crop, app_crop), "ssim": round(METRICS.ssim(ref_crop, app_crop), 4)}
        frame_metrics["referenceBox"] = frame["box"]
        frame_metrics["appPanel"] = dom["panels"].get(name)
        frame_metrics["styles"] = {k: region[k] for k in ("panelBackground", "pseudoBackground", "pseudoOpacity", "pseudoInset")}
        result["frames"][name] = frame_metrics
        folder = args.out / name
        folder.mkdir(exist_ok=True)
        Image.fromarray(ref_crop).save(folder / "reference.png")
        Image.fromarray(app_crop).save(folder / "application.png")
        Image.blend(Image.fromarray(ref_crop), Image.fromarray(app_crop), .5).save(folder / "overlay.png")
        difference = np.abs(ref_crop.astype(np.int16) - app_crop.astype(np.int16)).astype(np.uint8)
        Image.fromarray(difference).save(folder / "difference.png")
        heat = np.clip(difference.mean(axis=2) * 2.7, 0, 255).astype(np.uint8)
        Image.fromarray(np.stack((heat, heat // 3, np.zeros_like(heat)), axis=2)).save(folder / "heatmap.png")
        for layer, mask in masks.items():
            Image.fromarray((mask * 255).astype(np.uint8)).save(folder / f"mask-{layer}.png")
        col, row = index % 3, index // 3
        tile = Image.new("RGB", (638, 428), (2, 5, 13))
        tile.paste(Image.fromarray(app_crop), (0, 0))
        contact.paste(tile, (col * 638, row * 428))
        draw.text((col * 638 + 6, row * 428 + 5), name, fill=(255, 255, 255))
        summary[name] = {layer: frame_metrics[layer]["mae"] for layer in LAYERS}
    contact.save(args.out / "application-contact-sheet.png")
    (args.out / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"maeByMask": summary, "metrics": str(args.out / "metrics.json")}, separators=(",", ":")))


if __name__ == "__main__":
    main()
