"""Author the reference kitchen wall as an actual Blender mesh asset.

Run with Blender 4.5: blender -b --python model.py
All dimensions are metres; GLB feet are at Y=0 in the game (Blender Z=0).
"""
from __future__ import annotations

import math
import os
import random
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT.parents[2] / "public" / "assets" / "apartment" / "kitchen" / "reference-kitchen-wall.glb"
ROOT.mkdir(parents=True, exist_ok=True)
RUNTIME.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
random.seed(21)


def material(name, color, metal=0.0, rough=.42, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


graphite = material("Cabinet · brushed graphite", (.035, .04, .052), .42, .34)
deep = material("Cabinet · dark titanium", (.017, .023, .033), .67, .28)
black_glass = material("Appliance · smoked glass", (.012, .018, .027), .36, .11)
marble = material("Counter · veined Nero marble", (.04, .045, .052), .18, .19)
brass = material("Hardware · satin brass", (.58, .35, .15), .78, .27)
steel = material("Appliance · brushed steel", (.27, .31, .33), .72, .28)
warm = material("Cove · amber LED", (.94, .42, .12), .16, .22, (.94, .38, .09), 4.0)
orange = material("Cooktop · heat indicator", (.9, .16, .08), .28, .16, (.9, .08, .025), 3.0)
tile = material("Backsplash · charcoal stone", (.075, .068, .073), .12, .53)


def marble_texture():
    image = bpy.data.images.new("Nero marble · authored texture", width=512, height=512)
    pixels = []
    for y in range(512):
        v = y / 511
        for x in range(512):
            u = x / 511
            turbulence = (math.sin(u * 31 + math.sin(v * 23) * 2.8) * .32
                          + math.sin(u * 79 - v * 47) * .11
                          + math.sin(u * 167 + v * 109) * .04)
            vein_a = abs(math.sin((u * 4.1 + v * 2.7 + turbulence * .23) * math.pi))
            vein_b = abs(math.sin((u * 8.7 - v * 1.8 + turbulence * .38) * math.pi))
            light = max(0, (vein_a - .974) / .026) * .55
            gold = max(0, (vein_b - .987) / .013) * .36
            cloud = .012 * math.sin(u * 81 + v * 53) + .009 * math.cos(u * 139 - v * 71)
            pixels.extend((min(1, .027 + cloud + light + gold),
                           min(1, .031 + cloud + light * .86 + gold * .63),
                           min(1, .038 + cloud + light * .8 + gold * .25), 1))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(ROOT / "nero-marble.png")
    image.file_format = "PNG"
    image.save()
    nodes = marble.node_tree.nodes
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = image
    image_node.interpolation = "Linear"
    marble.node_tree.links.new(image_node.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])


marble_texture()


def cube(name, location, dimensions, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Machined radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        weighted = obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
        bpy.ops.object.modifier_apply(modifier=weighted.name)
    return obj


def cylinder(name, location, radius, depth, mat, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Soft turned edge", "BEVEL")
    bevel.width = min(.012, depth / 4)
    bevel.segments = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj


def torus(name, location, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=8, location=location,
                                     major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


# Back wall, lower cabinetry and two-level hanging cabinets. Front is -Y.
cube("Continuous backsplash slab", (0, .265, 1.43), (3.58, .08, 2.66), tile, .018)
cube("Lower floating plinth", (0, -.03, .15), (3.5, .61, .21), brass, .014)
cube("Lower cabinet housing", (0, -.02, .48), (3.48, .65, .68), graphite, .018)
cube("Nero marble counter slab", (0, -.06, .86), (3.58, .72, .076), marble, .018)
cube("Marble edge gold reveal", (0, -.422, .805), (3.55, .018, .028), brass, .003)
cube("Upper cabinet carcass", (-.57, .175, 2.08), (2.35, .52, .74), deep, .018)
cube("Upper illuminated cornice", (-.57, -.1, 2.65), (2.42, .57, .05), brass, .006)
cube("Upper cove diffuser", (-.57, -.12, 2.61), (2.37, .04, .018), warm, .002)
cube("Under-cabinet diffuser", (-.57, -.113, 1.72), (2.32, .055, .024), warm, .003)

# Tall integrated refrigerator at right, with deliberate recessed double doors.
cube("Integrated refrigerator cabinet", (1.38, .16, 1.35), (.74, .69, 2.64), deep, .016)
for side in (-1, 1):
    cube(f"Refrigerator front {side}", (1.38 + side * .18, -.201, 1.39), (.343, .035, 2.47), graphite, .007)
    cube(f"Refrigerator handle {side}", (1.38 + side * .1, -.23, 1.37), (.018, .033, .56), brass, .007)
cube("Fridge lower vent", (1.38, -.201, .15), (.7, .038, .18), steel, .006)

# Tall cabinet beside cooktop and three differentiated cabinet doors.
for i, x in enumerate((-1.43, -.77, -.11, .55)):
    cube(f"Lower drawer facade {i}", (x, -.344, .61), (.58, .03, .44), graphite, .007)
    for row, z in enumerate((.42, .62)):
        cube(f"Drawer brass pull {i}-{row}", (x, -.365, z), (.22, .022, .012), brass, .004)
for i, x in enumerate((-1.45, -.9, -.35, .2)):
    cube(f"Upper inset panel {i}", (x, -.102, 2.1), (.49, .024, .65), graphite, .008)
    cube(f"Upper pull {i}", (x + .18, -.123, 2.06), (.012, .03, .28), brass, .005)

# A real oven beneath the hob: recessed glass, door trim, control strip, knobs.
cube("Oven frame", (-.91, -.361, .38), (.98, .03, .71), steel, .013)
cube("Oven glass", (-.91, -.381, .37), (.86, .018, .51), black_glass, .009)
cube("Oven handle", (-.91, -.414, .69), (.73, .034, .026), brass, .01)
for index in range(4):
    cylinder(f"Oven control {index}", (-1.25 + index * .22, -.405, .14), .033, .027, steel)
    # Cylinders are along Z; rotate into the vertical appliance face.
    bpy.context.object.rotation_euler[0] = math.pi / 2

# Cooktop: four individual gas rings, black porcelain burners and pan rests.
cube("Inset cooktop", (-.9, -.21, .907), (1.52, .47, .018), deep, .007)
for col, x in enumerate((-1.24, -.59)):
    for row, y in enumerate((-.34, -.09)):
        torus(f"Burner brass ring {col}-{row}", (x, y, .933), .115, .009, brass)
        cylinder(f"Burner black cap {col}-{row}", (x, y, .938), .062, .019, black_glass)
        torus(f"Burner heat halo {col}-{row}", (x, y, .932), .14, .0035, orange)
        for angle in range(4):
            theta = angle * math.pi / 2
            rest = cube(f"Pan rest {col}-{row}-{angle}",
                        (x + math.cos(theta) * .13, y + math.sin(theta) * .13, .952),
                        (.074, .014, .014), steel, .003)
            rest.rotation_euler[2] = theta

# Stone backsplash shelf and practical props: extract hood, spice jars, bowls.
cube("Integrated extract hood", (-.89, -.15, 1.89), (1.29, .66, .16), deep, .018)
cube("Hood intake", (-.89, -.49, 1.8), (1.08, .025, .034), steel, .003)
for index in range(4):
    cylinder(f"Spice bottle {index}", (.44 + index * .12, -.22, .997), .035, .13, brass if index % 2 else tile)
    cylinder(f"Spice cap {index}", (.44 + index * .12, -.22, 1.073), .037, .018, steel)
for index, x in enumerate((.3, .46, .62)):
    cylinder(f"Ceramic plate stack {index}", (x, .02, .92 + index * .01), .1 - index * .011, .018, tile)

# Warm reflected light is present in preview; the emissive mesh survives GLB.
bpy.ops.object.light_add(type="AREA", location=(-1.2, -1.2, 4.6))
key = bpy.context.object
key.name = "Preview area key"
key.data.energy = 900
key.data.shape = "DISK"
key.data.size = 4
key.rotation_euler = (Vector((0, 0, 1.2)) - key.location).to_track_quat("-Z", "Y").to_euler()

bpy.ops.object.camera_add(location=(4.8, -5.8, 4.1))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 1.2)) - camera.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = camera
bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.context.scene.render.resolution_x = 840
bpy.context.scene.render.resolution_y = 630
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.filepath = str(ROOT / "preview.png")
bpy.context.scene.world.color = (.08, .075, .09)

# GLB exports only the asset meshes, not preview lights/camera.
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.select_set(True)
bpy.context.view_layer.objects.active = next(obj for obj in bpy.data.objects if obj.type == "MESH")
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "reference-kitchen-wall.blend"))
bpy.ops.export_scene.gltf(filepath=str(RUNTIME), export_format="GLB", use_selection=True,
                          export_apply=True, export_yup=True, export_materials="EXPORT")
bpy.ops.render.render(write_still=True)
print(f"Wrote {RUNTIME} and {ROOT / 'preview.png'}")
