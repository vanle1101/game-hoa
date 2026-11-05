"""Text-only audit of today's mechanical frame; images stay on disk."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/frame-audit-20261028/today-composition"
METRICS = ROOT / "tools/compare-lifelevel-frame.py"
SPEC = importlib.util.spec_from_file_location("frame_metrics", METRICS)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

FRAME = (256, 122, 888, 443)
REGIONS = {
    "topLeftTurbine": (256, 122, 335, 201),
    "titleBadge": (334, 155, 480, 201),
    "topRail": (335, 122, 888, 165),
    "leftEdge": (256, 201, 301, 410),
    "neonChannel": (335, 139, 870, 164),
    "topCornerIntersection": (256, 122, 360, 220),
    "lowerRightIntersection": (789, 345, 888, 443),
}
PARTS = (
    ("top-left", "top-middle", "top-right"),
    ("middle-left", "middle-middle", "middle-right"),
    ("bottom-left", "bottom-middle", "bottom-right"),
)


def tile_part(canvas: Image.Image, name: str, box: tuple[int, int, int, int]) -> None:
    part = Image.open(ROOT / "public/lifelevel-frames/today-parts" / f"{name}.png").convert("RGBA")
    x1, y1, x2, y2 = box
    for y in range(y1, y2, part.height):
        for x in range(x1, x2, part.width):
            patch = part.crop((0, 0, min(part.width, x2 - x), min(part.height, y2 - y)))
            canvas.alpha_composite(patch, (x, y))


def assembled_frame(width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height))
    xs = (0, 199, width - 421, width)
    ys = (0, 144, height - 169, height)
    for row in range(3):
        for column in range(3):
            tile_part(canvas, PARTS[row][column], (xs[column], ys[row], xs[column + 1], ys[row + 1]))
    for name, position in (("today_1", (0, -1)), ("today_2", (width - 99, height - 97))):
        reactor = Image.open(ROOT / "public/lifelevel-frames/reactors" / f"{name}.png").convert("RGBA")
        canvas.alpha_composite(reactor, position)
    return canvas


def rect_mask_measure(alpha: np.ndarray, rect: list[float], origin: list[float]) -> dict:
    x, y, width, height = rect
    x1 = max(0, round(x - origin[0]))
    y1 = max(0, round(y - origin[1]))
    x2 = min(alpha.shape[1], round(x + width - origin[0]))
    y2 = min(alpha.shape[0], round(y + height - origin[1]))
    pixels = alpha[y1:y2, x1:x2]
    return {"opaquePixels": int(np.count_nonzero(pixels >= 128)), "visiblePixels": int(np.count_nonzero(pixels >= 32)), "area": int(pixels.size)}


def intersection(first: list[float], second: list[float]) -> float:
    x1, y1, w1, h1 = first
    x2, y2, w2, h2 = second
    return round(max(0, min(x1 + w1, x2 + w2) - max(x1, x2)) * max(0, min(y1 + h1, y2 + h2) - max(y1, y2)), 2)


def route_mask_distance(mask: np.ndarray, samples: list[list[float]], radius: int = 8) -> dict:
    distances = []
    for x, y in samples:
        x1, x2 = max(0, int(x) - radius), min(mask.shape[1], int(x) + radius + 2)
        y1, y2 = max(0, int(y) - radius), min(mask.shape[0], int(y) + radius + 2)
        points = np.argwhere(mask[y1:y2, x1:x2])
        if len(points):
            dx = points[:, 1] + x1 - x
            dy = points[:, 0] + y1 - y
            distances.append(float(np.sqrt(np.min(dx * dx + dy * dy))))
        else:
            distances.append(float(radius + 1))
    return {"samples": len(distances), "nearMetal4Pct": round(100 * float(np.mean(np.asarray(distances) <= 4)), 1), "fartherThan8Px": int(np.sum(np.asarray(distances) > 8)), "maxDistancePx": round(max(distances), 2)}


def compare_capture(name: str, reference: Image.Image, tag: str = "kit", save_images: bool = True) -> dict:
    screenshot = Image.open(OUT / name).convert("RGB")
    folder = OUT / f"{tag}-{name.removesuffix('.png')}"
    folder.mkdir(exist_ok=True)
    original = reference.crop(FRAME)
    current = screenshot.crop(FRAME)
    if save_images:
        original.save(folder / "reference-today.png")
        current.save(folder / "application-today.png")
        Image.blend(original, current, .5).save(folder / "overlay.png")
    a = np.asarray(original)
    b = np.asarray(current)
    difference = np.abs(a.astype(np.float32) - b.astype(np.float32))
    if save_images:
        Image.fromarray(difference.astype(np.uint8)).save(folder / "difference.png")
    heat = difference.mean(axis=2)
    colors = np.zeros_like(a)
    colors[:, :, 0] = np.clip(heat * 2.7, 0, 255)
    colors[:, :, 1] = np.clip((heat - 65) * 1.7, 0, 255)
    if save_images:
        Image.fromarray(colors).save(folder / "heatmap.png")
    region_results = {}
    for region, (x1, y1, x2, y2) in REGIONS.items():
        crop_a = np.asarray(reference.crop((x1, y1, x2, y2)))
        crop_b = np.asarray(screenshot.crop((x1, y1, x2, y2)))
        region_results[region] = {**MODULE.metrics(crop_a, crop_b), "ssim": round(MODULE.ssim(crop_a, crop_b), 4)}
    result = {"whole": {**MODULE.metrics(a, b), "ssim": round(MODULE.ssim(a, b), 4)}, "regions": region_results}
    (folder / "metrics.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def main() -> None:
    reference_path = ROOT / "lifelevel_1to1_kit/reference.png"
    reference = Image.open(reference_path).convert("RGB")
    before = compare_capture("before-1801x873.png", reference)
    after = compare_capture("after-1801x873.png", reference)
    standalone_path = ROOT / "references/life-level-dashboard-reference.png"
    standalone = Image.open(standalone_path).convert("RGB")
    standalone_before = compare_capture("before-1801x873.png", standalone, "standalone")
    standalone_after = compare_capture("after-1801x873.png", standalone, "standalone")
    first_trial = compare_capture("first-trial-1801x873.png", reference, "kit", False) if (OUT / "first-trial-1801x873.png").exists() else None
    geometry = {}
    for name in ("before-1801x873", "before-1920x919", "1801x873", "1920x919"):
        info = json.loads((OUT / f"{name}.json").read_text(encoding="utf-8"))
        details = info["details"]
        fixed = info["overlayVisible"] and info["fixedTodayImages"] == 1
        reactor = [256, 122, 79, 79] if fixed else info.get("reactorRects", [details["topReactor"]["rect"]])[0]
        badge = details["badge"]["rect"]
        icon = details["icon"]["rect"]
        geometry[name] = {
            "frame": [256, 122, 632, 321] if fixed else details["fluid"]["rect"],
            "reactorBadgeBoxOverlapPx2": intersection(reactor, badge),
            "reactorIconBoxOverlapPx2": intersection(reactor, icon),
            "railPointsInsideBadge": info["railPointsInsideBadge"],
            "railGapToBadgePx": info["railGapToBadge"],
            "fixedTodayImageCount": info["fixedTodayImages"],
            "fluidTodayFrameCount": info["fluidTodayFrames"],
        }
        if name in ("1801x873", "1920x919"):
            if fixed:
                artwork = Image.open(ROOT / "public/lifelevel-frames/today.png").convert("RGBA")
                origin = [256, 122]
            else:
                frame_width = round(details["fluid"]["rect"][2])
                frame_height = round(details["fluid"]["rect"][3])
                artwork = assembled_frame(frame_width, frame_height)
                origin = details["fluid"]["rect"][:2]
            artwork.save(OUT / f"assembled-{name}.png")
            alpha = np.asarray(artwork.getchannel("A"))
            geometry[name]["assetAlphaInBadge"] = rect_mask_measure(alpha, badge, origin)
            geometry[name]["assetAlphaInIcon"] = rect_mask_measure(alpha, icon, origin)
            geometry[name]["assetAlphaInText"] = rect_mask_measure(alpha, info["textRect"], origin)
            geometry[name]["composition"] = info["composition"]
            geometry[name]["ledRouteToMetal"] = route_mask_distance(alpha >= 32, info["railSamples"])
            if not fixed:
                mask = alpha >= 32
                clear_points = []
                for x, y in ((0, 79), (78, 0), (0, frame_height - 90), (79, frame_height - 1), (frame_width - 99, 0), (frame_width - 1, 79), (frame_width - 99, frame_height - 1), (frame_width - 1, frame_height - 90)):
                    x1, x2 = max(0, x - 2), min(frame_width, x + 3)
                    y1, y2 = max(0, y - 2), min(frame_height, y + 3)
                    clear_points.append(int(np.count_nonzero(mask[y1:y2, x1:x2])))
                geometry[name]["cornerJoinVisiblePixels"] = clear_points
    source = Image.open(ROOT / "public/lifelevel-frames/today.png").convert("RGBA")
    restored = assembled_frame(632, 321)
    black = Image.new("RGBA", source.size, (0, 0, 0, 255))
    a = np.asarray(Image.alpha_composite(black, source).convert("RGB"))
    b = np.asarray(Image.alpha_composite(black, restored).convert("RGB"))
    reconstruction = MODULE.metrics(a, b)
    result = {"kitReference": str(reference_path), "standaloneReference": str(standalone_path), "before": before, "after": after, "firstTrial": first_trial, "standaloneBefore": standalone_before, "standaloneAfter": standalone_after, "geometry": geometry, "exactReconstruction": reconstruction}
    (OUT / "comparison.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    for name in ("1801x873", "1920x919"):
        measured = geometry[name]
        if measured["reactorBadgeBoxOverlapPx2"] or measured["reactorIconBoxOverlapPx2"] or measured["railPointsInsideBadge"]:
            raise AssertionError(f"{name}: mechanical layer intersects the title")
        if measured["assetAlphaInIcon"]["opaquePixels"] or measured["assetAlphaInText"]["opaquePixels"]:
            raise AssertionError(f"{name}: extracted artwork occupies icon or text pixels")
        if measured["ledRouteToMetal"]["fartherThan8Px"]:
            raise AssertionError(f"{name}: LED path leaves the metal frame")
    if reconstruction["mae"]:
        raise AssertionError("Tiled Hôm nay parts do not reproduce the source crop at 632×321")
    print(json.dumps({"kitBeforeMAE": before["whole"]["mae"], "kitAfterMAE": after["whole"]["mae"], "standaloneBeforeMAE": standalone_before["whole"]["mae"], "standaloneAfterMAE": standalone_after["whole"]["mae"], "exactReconstruction": reconstruction, "geometry": geometry, "file": str(OUT / "comparison.json")}, separators=(",", ":")))


if __name__ == "__main__":
    main()
