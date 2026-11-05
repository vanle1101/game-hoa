"""One-time reproducible detail pass for the authored premium bed.

Run from the repository root with Blender 4.5:
  blender --background --python assets/apartment/bed/add_reference_foot_bench.py

The script reopens the existing editable source, adds the foot bench and textile
details visible in REF-D, then regenerates the same runtime GLB and preview.
"""
from pathlib import Path
import sys

import bpy

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "visual-v18"))
from model_common import box, soft, tube, rounded_rect, cyl, cloth, export_asset, preview, material


source = ROOT / "assets" / "apartment" / "bed" / "premium-bed.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))

# Re-running this script keeps a single bench instead of duplicating geometry.
for obj in list(bpy.data.objects):
    if obj.name.startswith("Reference foot bench") or obj.name.startswith("Reference bench"):
        bpy.data.objects.remove(obj, do_unlink=True)

walnut = bpy.data.materials.get("Smoked walnut")
bronze = bpy.data.materials.get("Satin champagne bronze")
duvet = bpy.data.materials.get("Graphite taupe quilted cover")
charcoal = bpy.data.materials.get("Charcoal textured bed runner")
seam = bpy.data.materials.get("Warm seam thread")
if not all((walnut, bronze, duvet, charcoal, seam)):
    raise RuntimeError("The premium bed source is missing its production materials")

# Low, offset foot bench: the reference has a padded bench emerging from the
# right half of the bed, with a tailored dark throw crossing its top.
cx, cz = 0.43, 1.42
box("Reference foot bench walnut chassis", (cx, 0.18, cz), (1.42, 0.16, 0.68), walnut, 0.035)
soft("Reference foot bench upholstered cushion", (cx, 0.41, cz), (1.49, 0.29, 0.71), duvet, 0.075, 0.006)
tube("Reference bench upper welt", rounded_rect(cx, 0.53, cz, 1.44, 0.66, 0.065), 0.004, seam, True)
tube("Reference bench lower welt", rounded_rect(cx, 0.285, cz, 1.44, 0.66, 0.065), 0.003, seam, True)
for x in (cx - 0.58, cx + 0.58):
    for z in (cz - 0.25, cz + 0.25):
        cyl("Reference bench recessed bronze leg", (x, 0.055, z), 0.025, 0.11, bronze, 32)

# A folded textile is a deformed UV mesh and has thickness, not a flat decal.
cloth("Reference foot bench charcoal throw", (cx + 0.14, cz + 0.055), 0.77, 0.79, 0.575, charcoal, 0.20, 0.014, 2)
for index in range(13):
    x = cx - 0.19 + index * 0.054
    tube("Reference bench throw fringe", [(x, 0.45, cz + 0.40), (x + 0.006, 0.39, cz + 0.45)], 0.0022, charcoal)

description = "Premium low walnut platform bed with sculpted bedding, integrated nightstands, opal lamps and offset upholstered foot bench."
features = [
    "Beveled walnut joinery and recessed feet",
    "Subdivided sculpted pillows and draped bedding",
    "Tailored headboard and mattress piping",
    "Embedded woven fabric and walnut PBR textures",
    "Offset upholstered foot bench with stitched seams and draped throw",
    "Two bedside drawer units and opal practical lamps",
]
out = export_asset("bed", "premium-bed", description, features)
preview(out, (4.3, 3.4, 5.2), (0, 0.66, 0.22), 5.1)
