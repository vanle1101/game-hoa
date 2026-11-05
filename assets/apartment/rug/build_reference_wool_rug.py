"""Rebuild the shared Home/Showcase rug as a textured, uneven wool pile.

Run from the repository root with Blender 4.5:
  blender --background --python assets/apartment/rug/build_reference_wool_rug.py
"""
from pathlib import Path
import math
import sys

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "visual-v18"))
from model_common import clear, material, box, export_asset, preview, xyz

clear()
WIDTH, DEPTH = 4.18, 3.05
backing = material("Woven charcoal backing", (0.095, 0.075, 0.071), 0.98)
binding = material("Smoked taupe bound edge", (0.16, 0.125, 0.116), 0.93, texture="fabric")
pile = material("Hand tufted charcoal taupe wool", (0.20, 0.16, 0.15), 1.0)

# A deterministic 1024-pixel woven colour/roughness map creates the mottled
# high-frequency fibres visible in the reference without flat painted bands.
n = 1024
rng = np.random.default_rng(2107)
low = rng.normal(0, 1, (64, 64)).astype(np.float32)
medium = rng.normal(0, 1, (256, 256)).astype(np.float32)
base = np.repeat(np.repeat(low, 16, axis=0), 16, axis=1)
mid = np.repeat(np.repeat(medium, 4, axis=0), 4, axis=1)
grain = rng.normal(0, 1, (n, n)).astype(np.float32)
yy, xx = np.mgrid[:n, :n]
fibres = np.sin(xx * 0.49 + np.sin(yy * 0.06) * 1.2) * 0.055
weave = np.cos(yy * 0.78 + np.sin(xx * 0.09)) * 0.045
variation = np.clip(1 + base * 0.11 + mid * 0.095 + grain * 0.095 + fibres + weave, 0.58, 1.37)
colour = np.empty((n, n, 4), np.float32)
for channel, value in enumerate((0.205, 0.17, 0.157)):
    colour[:, :, channel] = np.clip(value * variation, 0, 1)
colour[:, :, 3] = 1
image = bpy.data.images.new("Wool pile mottled colour", width=n, height=n)
image.pixels.foreach_set(colour.ravel())
image.pack()
nodes = pile.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
colour_node = nodes.new("ShaderNodeTexImage")
colour_node.image = image
pile.node_tree.links.new(colour_node.outputs["Color"], bsdf.inputs["Base Color"])

# Export a tangent-space micro normal map alongside the base colour. It is
# intentionally low strength so the rug stays soft in the amber room light.
normal = np.empty((n, n, 4), np.float32)
normal[:, :, 0] = np.clip(0.5 + np.gradient(variation, axis=1) * 0.09, 0, 1)
normal[:, :, 1] = np.clip(0.5 + np.gradient(variation, axis=0) * 0.09, 0, 1)
normal[:, :, 2] = 0.97
normal[:, :, 3] = 1
normal_image = bpy.data.images.new("Wool pile micro normal", width=n, height=n)
normal_image.colorspace_settings.name = "Non-Color"
normal_image.pixels.foreach_set(normal.ravel())
normal_image.pack()
normal_node = nodes.new("ShaderNodeTexImage")
normal_node.image = normal_image
normal_map = nodes.new("ShaderNodeNormalMap")
normal_map.inputs["Strength"].default_value = 0.21
pile.node_tree.links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
pile.node_tree.links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

box("Rug flexible woven backing", (0, 0.014, 0), (WIDTH, 0.022, DEPTH), backing, 0.017)

nx, nz = 120, 90
verts, uv, faces = [], [], []
for j in range(nz + 1):
    v = j / nz
    z = (v - 0.5) * DEPTH
    for i in range(nx + 1):
        u = i / nx
        x = (u - 0.5) * WIDTH
        edge = min(1, i / 4, (nx - i) / 4, j / 4, (nz - j) / 4)
        tuft = (0.004 * math.sin(i * 2.7 + j * 1.3)
                + 0.003 * math.sin(i * 7.1 - j * 3.4)
                + 0.002 * math.cos(i * 13.3 + j * 8.9))
        verts.append(xyz((x, 0.051 + tuft * edge, z)))
        uv.append((u * 2.4, v * 2.4))
for j in range(nz):
    for i in range(nx):
        a = j * (nx + 1) + i
        faces.append((a, a + nx + 1, a + nx + 2, a + 1))
mesh = bpy.data.meshes.new("Hand tufted pile surface")
mesh.from_pydata(verts, [], faces)
mesh.update()
obj = bpy.data.objects.new("Hand tufted pile surface", mesh)
bpy.context.collection.objects.link(obj)
mesh.materials.append(pile)
layer = mesh.uv_layers.new(name="Wool UV")
for polygon in mesh.polygons:
    polygon.use_smooth = True
    for loop_id in polygon.loop_indices:
        layer.data[loop_id].uv = uv[mesh.loops[loop_id].vertex_index]
solid = obj.modifiers.new("Pile depth", "SOLIDIFY")
solid.thickness = 0.014
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier=solid.name)

# A softened edge treatment replaces the former high-contrast geometric cords.
for side in (-1, 1):
    box("Rug bound long edge", (0, 0.027, side * (DEPTH / 2 - 0.018)),
        (WIDTH - 0.03, 0.032, 0.045), binding, 0.016)
    box("Rug bound short edge", (side * (WIDTH / 2 - 0.018), 0.027, 0),
        (0.045, 0.032, DEPTH - 0.03), binding, 0.016)

out = export_asset("rug", "wool-rug",
    "Large dark taupe hand-tufted wool rug with mottled woven PBR texture, uneven pile mesh and soft binding.",
    ["Physically uneven 120 by 90 pile mesh", "1024-pixel mottled wool base colour",
     "Tangent-space micro normal map", "Woven backing and bound edges"])
preview(out, (5, 4, 5.5), (0, 0, 0), 5.2)
