"""Extract decorative HUD chassis pixels from the supplied 1801x873 reference.

The paths below are measured in screenshot coordinates.  Each asset keeps only
the perimeter chassis and circular reactors; its center is transparent so the
application continues to render live content, state, and background.

Run from the repository root:
    python tools/extract_reference_hud.py
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "references" / "life-level-dashboard-reference.png"
OUTPUT = ROOT / "public" / "assets" / "reference-hud"
SCALE = 4  # Antialias the manually traced extraction mask.


@dataclass(frozen=True)
class Frame:
    name: str
    bounds: tuple[int, int, int, int]
    outer: tuple[tuple[int, int], ...]
    opening: tuple[tuple[int, int], ...]
    reactors: tuple[tuple[int, int, int], ...] = ()
    # Additional small metal connector plates that sit outside the main shell.
    clamps: tuple[tuple[tuple[int, int], ...], ...] = ()


FRAMES = (
    Frame(
        "header",
        (291, 7, 1784, 101),
        ((330, 9), (1753, 9), (1782, 35), (1782, 70),
         (1755, 99), (326, 99), (293, 67), (293, 45)),
        ((380, 32), (1748, 32), (1759, 43), (1759, 66),
         (1748, 77), (381, 77), (371, 67), (371, 43)),
        ((335, 54, 43),),
    ),
    Frame(
        "sidebar",
        (2, 85, 257, 864),
        ((27, 90), (211, 90), (254, 130), (254, 820),
         (218, 861), (28, 861), (4, 837), (4, 117)),
        ((36, 159), (207, 159), (230, 179), (230, 806),
         (207, 836), (33, 836), (25, 817), (25, 180)),
        ((41, 122, 39),),
        (((220, 390), (253, 419), (253, 442), (229, 421)),
         ((218, 565), (252, 583), (252, 605), (225, 590))),
    ),
    Frame(
        "today",
        (267, 127, 901, 446),
        ((310, 130), (858, 130), (888, 157), (888, 362),
         (861, 394), (860, 414), (835, 441), (303, 441),
         (276, 413), (276, 184)),
        ((323, 159), (849, 159), (865, 176), (865, 354),
         (837, 386), (808, 411), (315, 411), (300, 394),
         (300, 194)),
        ((297, 163, 39), (846, 401, 41)),
        (((267, 406), (291, 380), (321, 412), (296, 442)),),
    ),
    Frame(
        "boss",
        (903, 129, 1381, 442),
        ((937, 132), (1347, 132), (1375, 161), (1375, 410),
         (1344, 439), (936, 439), (905, 408), (905, 165)),
        ((946, 161), (1337, 161), (1352, 178), (1352, 397),
         (1337, 417), (947, 417), (928, 396), (928, 183)),
        ((942, 163, 39),),
        (((901, 407), (924, 385), (954, 416), (926, 441)),),
    ),
    Frame(
        "butler",
        (1376, 129, 1783, 443),
        ((1414, 132), (1748, 132), (1778, 161), (1778, 408),
         (1751, 439), (1411, 439), (1380, 409), (1380, 167)),
        ((1434, 161), (1745, 161), (1757, 179), (1757, 405),
         (1741, 427), (1433, 427), (1404, 405), (1404, 184)),
        ((1417, 164, 39),),
        (((1377, 404), (1403, 382), (1433, 418), (1406, 441)),),
    ),
    Frame(
        "skill",
        (274, 445, 902, 861),
        ((308, 448), (865, 448), (899, 478), (899, 825),
         (867, 858), (305, 858), (277, 826), (277, 480)),
        ((324, 475), (854, 475), (875, 494), (875, 813),
         (854, 832), (319, 832), (300, 812), (300, 500)),
        ((312, 481, 40),),
        (((273, 822), (297, 789), (326, 829), (301, 860)),),
    ),
    Frame(
        "character",
        (904, 447, 1381, 709),
        ((939, 450), (1345, 450), (1376, 480), (1376, 676),
         (1352, 705), (935, 705), (907, 679), (907, 480)),
        ((953, 476), (1337, 476), (1352, 493), (1352, 668),
         (1335, 682), (950, 682), (930, 664), (930, 499)),
        ((941, 485, 40),),
        (((903, 674), (926, 652), (956, 683), (930, 708)),),
    ),
    Frame(
        "achievements",
        (905, 696, 1380, 861),
        ((939, 699), (1345, 699), (1375, 725), (1375, 828),
         (1348, 857), (938, 857), (908, 828), (908, 725)),
        ((962, 721), (1338, 721), (1352, 735), (1352, 818),
         (1337, 835), (954, 835), (932, 816), (932, 740)),
        ((940, 724, 30),),
        (((904, 817), (930, 798), (953, 837), (931, 859)),),
    ),
    Frame(
        "rewards",
        (1377, 446, 1786, 861),
        ((1412, 449), (1750, 449), (1782, 480), (1782, 823),
         (1750, 858), (1410, 858), (1381, 827), (1381, 482)),
        ((1434, 476), (1744, 476), (1758, 493), (1758, 815),
         (1742, 833), (1432, 833), (1405, 814), (1405, 501)),
        ((1417, 482, 40),),
        (((1377, 821), (1401, 791), (1433, 829), (1409, 860)),),
    ),
)


def local_points(points: tuple[tuple[int, int], ...], x0: int, y0: int):
    return [((x - x0) * SCALE, (y - y0) * SCALE) for x, y in points]


def extract_frame(reference: Image.Image, frame: Frame) -> Image.Image:
    x0, y0, x1, y1 = frame.bounds
    crop = reference.crop(frame.bounds).convert("RGBA")
    mask = Image.new("L", ((x1 - x0) * SCALE, (y1 - y0) * SCALE), 0)
    draw = ImageDraw.Draw(mask)

    draw.polygon(local_points(frame.outer, x0, y0), fill=255)
    draw.polygon(local_points(frame.opening, x0, y0), fill=0)

    for x, y, radius in frame.reactors:
        draw.ellipse(
            ((x - radius - x0) * SCALE, (y - radius - y0) * SCALE,
             (x + radius - x0) * SCALE, (y + radius - y0) * SCALE),
            fill=255,
        )

    for clamp in frame.clamps:
        draw.polygon(local_points(clamp, x0, y0), fill=255)

    mask = mask.resize(crop.size, Image.Resampling.LANCZOS)
    crop.putalpha(mask)
    return crop


def extract_reactor(reference: Image.Image) -> Image.Image:
    """Keep the Today panel's upper-left ring as a standalone circular asset."""
    center_x, center_y = 297, 163
    size, radius = 86, 40
    x0, y0 = center_x - size // 2, center_y - size // 2
    crop = reference.crop((x0, y0, x0 + size, y0 + size)).convert("RGBA")

    mask = Image.new("L", (size * SCALE, size * SCALE), 0)
    draw = ImageDraw.Draw(mask)
    center = (size // 2) * SCALE
    edge = radius * SCALE
    draw.ellipse((center - edge, center - edge,
                  center + edge, center + edge), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.75 * SCALE))
    crop.putalpha(mask.resize(crop.size, Image.Resampling.LANCZOS))
    return crop


def main() -> None:
    if not REFERENCE.is_file():
        raise SystemExit(f"Reference not found: {REFERENCE}")
    reference = Image.open(REFERENCE).convert("RGB")
    if reference.size != (1801, 873):
        raise SystemExit(f"Expected 1801x873 reference, got {reference.size}")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for frame in FRAMES:
        image = extract_frame(reference, frame)
        destination = OUTPUT / f"{frame.name}.png"
        image.save(destination, optimize=True)
        print(f"{destination.relative_to(ROOT)} {image.width}x{image.height}")

    reactor = extract_reactor(reference)
    destination = OUTPUT / "reactor.png"
    reactor.save(destination, optimize=True)
    print(f"{destination.relative_to(ROOT)} {reactor.width}x{reactor.height}")


if __name__ == "__main__":
    main()
