# Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
# Prepara os CADs oficiais dos starter bots para o jogo: orienta (frente em +X, piso em z = 0, centrado),
# simplifica e exporta um GLB por robô. Entrada: os GLBs de `npm run cad:convert` (eixos do CAD, em metros).
#
# Uso: blender -b --python scripts/blender/build_robots.py -- cad/robots public/models/robots [pasta-de-previas]
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None
os.makedirs(OUT, exist_ok=True)
# os CADs já chegam simplificados (~240 mil triângulos); abaixo de ~100 mil as chapas furadas se desfazem
BUDGET = 110000

# Para cada robô: arquivo, eixo do CAD que aponta para cima e eixo do CAD que aponta para a frente (intake).
ROBOTS = {
    "gobilda": ("gobilda-game.glb", "+z", "-y"),
    "revDuo": ("rev-duo-game.glb", "+z", "-y"),
    "andymark": ("andymark-robits-game.glb", "+y", "-x"),
}


def axis(name):
    v = Vector((0, 0, 0))
    v["xyz".index(name[1])] = 1 if name[0] == "+" else -1
    return v


def build(key, file, up, front):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, file))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.data.transform(world)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # volta aos eixos do CAD (o importador converte y-para-cima em z-para-cima) e gira para frente = +X, cima = +Z
    obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, "X"))
    f, u = axis(front), axis(up)
    left = u.cross(f)
    obj.data.transform(Matrix((f, left, u)).to_4x4())
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for v in obj.data.vertices:
        for k in range(3):
            mn[k] = min(mn[k], v.co[k])
            mx[k] = max(mx[k], v.co[k])
    obj.data.transform(Matrix.Translation((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=5e-5)
    bm.to_mesh(obj.data)
    bm.free()
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > BUDGET:
        d = obj.modifiers.new("collapse", "DECIMATE")
        d.ratio = BUDGET / tris
        bpy.ops.object.modifier_apply(modifier=d.name)
    # Zonas de colisão: o robô é fatiado em 3 trechos ao longo do comprimento; cada trecho vira uma caixa com a
    # largura e a altura do CAD ali (percentil 97, para ignorar fios e antenas). Vão para src/config/robotPresets.ts.
    zones = []
    half = (mx.x - mn.x) / 2
    for i in range(3):
        x0, x1 = -half + i * 2 * half / 3, -half + (i + 1) * 2 * half / 3
        pts = [v.co for v in obj.data.vertices if x0 <= v.co.x <= x1]
        zs = sorted(c.z for c in pts)
        ys = sorted(abs(c.y) for c in pts)
        zones.append((round(x0 / 0.0254, 1), round(x1 / 0.0254, 1), round(2 * ys[int(len(ys) * 0.97)] / 0.0254, 1), round(zs[int(len(zs) * 0.97)] / 0.0254, 1)))
    print("ZONES %s: %s" % (key, zones))
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(35))
    obj.name = key
    path = os.path.join(OUT, key + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=False)
    size = (mx - mn) / 0.0254
    print("ROBOT %s: %d -> %d triângulos, %.0f kB, frente x lado x altura = %.1f x %.1f x %.1f pol" % (key, tris, sum(len(p.vertices) - 2 for p in obj.data.polygons), os.path.getsize(path) / 1024, size.x, size.y, size.z))
    if PREVIEW:
        os.makedirs(PREVIEW, exist_ok=True)
        sc = bpy.context.scene
        bpy.ops.mesh.primitive_cone_add(radius1=0.03, depth=0.12, location=(0.36, 0, 0.05), rotation=(0, math.pi / 2, 0))
        m = bpy.data.materials.new("front")
        m.diffuse_color = (1, 0, 0, 1)
        bpy.context.object.data.materials.append(m)
        cam = bpy.data.cameras.new("cam")
        co = bpy.data.objects.new("cam", cam)
        sc.collection.objects.link(co)
        target = Vector((0, 0, 0.15))
        co.location = target + Vector((0.6, -1, 0.75)).normalized() * 1.5
        co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.camera = co
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.display.shading.color_type = "MATERIAL"
        sc.display.shading.show_cavity = True
        sc.render.resolution_x = 700
        sc.render.resolution_y = 520
        sc.render.film_transparent = True
        sc.render.filepath = os.path.join(PREVIEW, key + ".png")
        bpy.ops.render.render(write_still=True)


for key, (file, up, front) in ROBOTS.items():
    build(key, file, up, front)
