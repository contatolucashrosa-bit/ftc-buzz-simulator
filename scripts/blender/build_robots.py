# Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
# Prepara os CADs oficiais dos starter bots para o jogo: orienta (frente em +X, piso em z = 0, centrado),
# refaz a malha peça por peça, repinta e exporta um GLB por robô. Entrada: os GLBs de
# `npm run cad:convert -- robo.step cad/robots/<nome>-parts.glb --parts` (uma malha por peça, eixos do CAD).
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
# as peças que não viram casco (curvas, abertas) ainda passam por um colapso de arestas se o total passar disto
BUDGET = 90000

# Para cada robô: arquivo, eixo do CAD que aponta para cima e eixo do CAD que aponta para a frente (intake).
ROBOTS = {
    "gobilda": ("gobilda-parts.glb", "+z", "-y"),
    "revDuo": ("rev-duo-parts.glb", "+z", "-y"),
    "andymark": ("andymark-parts.glb", "+y", "-x"),
}


def axis(name):
    v = Vector((0, 0, 0))
    v["xyz".index(name[1])] = 1 if name[0] == "+" else -1
    return v


# Materiais do jogo. As cores dos STEPs são genéricas (cinzas claros, quase brancos sob a luz do jogo; o do AndyMark
# vem inteiro numa cor só), então cada peça solta é repintada: pneus pelo formato, o resto pela cor do CAD ou,
# sem cor, pelo formato da peça. (cor, metálico, rugosidade)
# Valores calibrados para a luz do jogo (sol forte, mapa de ambiente e ACES): metal muito claro ou muito metálico
# reflete o céu e o robô some em branco na arena clara.
PAINT = {
    "tire": ((0.02, 0.02, 0.022), 0.0, 0.9),
    "dark": ((0.03, 0.03, 0.034), 0.1, 0.55),
    "steel": ((0.17, 0.18, 0.2), 0.55, 0.5),
    "aluminum": ((0.36, 0.38, 0.41), 0.55, 0.42),
    "plate": ((0.08, 0.085, 0.095), 0.45, 0.55),
}
INCH = 0.0254


def paint_material(name, color=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    base, metallic, roughness = PAINT.get(name, (color, 0.1, 0.5))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (*base, 1)
    return m


def classify(size, low, color, colored):
    """Material de uma peça solta: pneu pelo formato; o resto pela cor do CAD ou, sem cor, pelo formato."""
    dims = sorted(size)
    # roda: encosta no piso, redonda de lado (x ≈ z) e estreita em y
    if low < 0.6 and 2.4 < size.z < 5.2 and abs(size.x - size.z) < 0.25 * size.z and size.y < 2.6:
        return "tire", None
    lum = sum(color) / 3
    if colored and max(color) - min(color) > 0.25:
        # cor de verdade no CAD (ex.: peças laranja da REV): mantém
        return "accent-%02x%02x%02x" % tuple(int(v * 255) for v in color), color
    if colored:
        return ("dark" if lum < 0.3 else "steel" if lum < 0.72 else "aluminum"), None
    if dims[2] > 7 and dims[1] < 2.2:
        return "aluminum", None  # perfis e eixos compridos
    if dims[0] < 0.35 and dims[1] > 2.5:
        return "plate", None  # chapas
    if dims[2] < 4.5 and dims[0] > 0.9:
        return "dark", None  # motores, servos, cubos
    return "steel", None


def rebuild(obj, key):
    """
    Refaz a malha peça por peça (ilha de faces ligadas). Os kits são cheios de perfis e chapas furadas, que um
    simplificador comum transforma em retalhos; aqui cada peça "cheia" (que ocupa boa parte da própria caixa)
    vira o seu casco convexo, limpo e leve, e só as peças curvas ou abertas mantêm a malha original.
    Parafusos e outras peças minúsculas saem.
    """
    source = []
    for slot in obj.material_slots:
        c = slot.material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
        source.append((c[0], c[1], c[2]))
    colored = len({tuple(round(v, 1) for v in c) for c in source}) > 3
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    names, index = [], {}
    out_verts, out_faces, out_slots = [], [], []
    stats = {"hull": 0, "raw": 0, "dropped": 0}
    # o conversor (--parts) grava uma malha por peça, cada uma com o próprio material: peça = material
    parts = {}
    for face in bm.faces:
        parts.setdefault(face.material_index, []).append(face)
    for island in parts.values():
        verts = list({v for face in island for v in face.verts})
        mn = Vector((min(v.co.x for v in verts), min(v.co.y for v in verts), min(v.co.z for v in verts)))
        mx = Vector((max(v.co.x for v in verts), max(v.co.y for v in verts), max(v.co.z for v in verts)))
        size = (mx - mn) / INCH
        if max(size) < 0.7:
            stats["dropped"] += 1
            continue
        name, color = classify(size, mn.z / INCH, source[island[0].material_index] if source else (0.6, 0.6, 0.6), colored)
        if name not in index:
            index[name] = len(names)
            names.append(paint_material(name, color))
        slot = index[name]
        hull = None
        if len(verts) >= 4:
            tb = bmesh.new()
            try:
                made = [tb.verts.new(v.co) for v in verts]
                result = bmesh.ops.convex_hull(tb, input=made)
                # um vértice pode aparecer nas duas listas: o delete recusa repetidos
                extra = list({g for g in result["geom_interior"] + result["geom_unused"] if isinstance(g, bmesh.types.BMVert)})
                bmesh.ops.delete(tb, geom=extra, context="VERTS")
                box = max(1e-12, (mx.x - mn.x) * (mx.y - mn.y) * (mx.z - mn.z))
                if tb.faces and abs(tb.calc_volume()) / box > 0.45:
                    bmesh.ops.dissolve_limit(tb, angle_limit=math.radians(7), verts=tb.verts[:], edges=tb.edges[:])
                    bmesh.ops.triangulate(tb, faces=tb.faces[:])
                    tb.verts.index_update()
                    hull = ([v.co.copy() for v in tb.verts], [[v.index for v in f.verts] for f in tb.faces])
            except Exception:
                hull = None
            tb.free()
        base = len(out_verts)
        if hull:
            stats["hull"] += 1
            out_verts += hull[0]
            out_faces += [[base + k for k in face] for face in hull[1]]
            out_slots += [slot] * len(hull[1])
        else:
            stats["raw"] += 1
            local = {}
            for face in island:
                ids = []
                for v in face.verts:
                    if v not in local:
                        local[v] = len(out_verts)
                        out_verts.append(v.co.copy())
                    ids.append(local[v])
                out_faces.append(ids)
                out_slots.append(slot)
    bm.free()
    mesh = bpy.data.meshes.new(key)
    mesh.from_pydata(out_verts, [], out_faces)
    for m in names:
        mesh.materials.append(m)
    mesh.polygons.foreach_set("material_index", out_slots)
    mesh.update()
    old = obj.data
    obj.data = mesh
    bpy.data.meshes.remove(old)
    print("PARTS %s: %d cascos, %d malhas originais, %d peças pequenas descartadas; materiais: %s" % (key, stats["hull"], stats["raw"], stats["dropped"], ", ".join(index)))


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
    rebuild(obj, key)
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
