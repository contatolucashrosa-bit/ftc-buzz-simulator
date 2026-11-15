# Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
# Monta os modelos da arena no Blender a partir das peças do CAD oficial (convertidas por scripts/arena-parts.mjs)
# e exporta GLBs leves para o jogo. As peças do CAD vêm soltas, cada uma no próprio sistema de eixos, então a
# montagem é feita aqui com as medidas do manual (§9.6 e §9.7). Chapas, tubos simples e painéis são gerados.
#
# Uso: blender -b --python scripts/blender/build_field.py -- cad/arena-parts public/models/field [pasta-de-previas]
#
# Eixos: os modelos são montados em polegadas no sistema do manual (x para a aliança azul, y para o fundo, z para
# cima) e exportados em metros com y para cima, que é exatamente a conversão toWorld() do jogo.
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

IN = 0.0254
args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None
os.makedirs(OUT, exist_ok=True)

# O jogo troca os materiais pelo nome (cor da aliança, policarbonato etc.); aqui valem para as prévias.
PALETTE = {
    "alliance": ((0.80, 0.08, 0.08), 0.1, 0.45, 1),
    "polycarbonate": ((0.85, 0.9, 0.93), 0, 0.12, 0.25),
    "aluminum": ((0.72, 0.74, 0.77), 0.9, 0.38, 1),
    "steel": ((0.45, 0.46, 0.48), 0.9, 0.45, 1),
    "black-plastic": ((0.03, 0.03, 0.035), 0, 0.5, 1),
    "panel": ((0.95, 0.76, 0.1), 0, 0.5, 1),
    "pipe": ((0.2, 0.62, 0.16), 0, 0.42, 1),
    "flower-top": ((0.93, 0.66, 0.2), 0, 0.5, 1),
    "backstop": ((0.45, 0.2, 0.7), 0.2, 0.5, 1),
}


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    color, metallic, roughness, alpha = PALETTE[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    m.diffuse_color = (*color, alpha)
    if alpha < 1:
        m.surface_render_method = "BLENDED"
    return m


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def load(slug, mat, budget):
    """Peça do CAD nos eixos do próprio CAD (em metros), soldada e simplificada até `budget` triângulos."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, slug + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.data.transform(world)
    activate(meshes[0])
    for o in meshes:
        o.select_set(True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in new:
        if o.type != "MESH" and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    # o importador converte y-para-cima em z-para-cima; desfaz para voltar aos eixos do CAD
    obj.data.transform(Matrix.Rotation(-math.pi / 2, 4, "X"))
    obj.data.materials.clear()
    obj.data.materials.append(material(mat))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-5)
    bm.to_mesh(obj.data)
    bm.free()
    if triangles(obj) > budget:
        # faces planas do CAD viram poucos polígonos; o resto sai no colapso de arestas
        d = obj.modifiers.new("planar", "DECIMATE")
        d.decimate_type = "DISSOLVE"
        d.angle_limit = math.radians(1.5)
        bpy.ops.object.modifier_apply(modifier=d.name)
        t = obj.modifiers.new("tri", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=t.name)
        if triangles(obj) > budget:
            c = obj.modifiers.new("collapse", "DECIMATE")
            c.ratio = budget / triangles(obj)
            bpy.ops.object.modifier_apply(modifier=c.name)
    smooth(obj)
    obj.name = slug
    return obj


def smooth(obj, angle=35):
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(angle))


def copy(obj):
    c = obj.copy()
    c.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(c)
    return c


def bounds(obj):
    mn = Vector((1e9,) * 3)
    mx = Vector((-1e9,) * 3)
    for v in obj.data.vertices:
        for k in range(3):
            mn[k] = min(mn[k], v.co[k])
            mx[k] = max(mx[k], v.co[k])
    return mn, mx


def put(obj, rot=None, origin=None, **anchor):
    """Gira a peça (em torno da origem do CAD) e a posiciona, em polegadas.
    origin=(x, y, z) leva a origem do CAD até o ponto; x/y/z=("min"|"c"|"max", valor) encaixa a caixa envolvente."""
    if rot is not None:
        obj.data.transform(rot)
    shift = Vector(origin) * IN if origin else Vector((0, 0, 0))
    mn, mx = bounds(obj)
    for k, axis in enumerate("xyz"):
        if axis in anchor:
            how, value = anchor[axis]
            ref = {"min": mn[k], "max": mx[k], "c": (mn[k] + mx[k]) / 2}[how]
            shift[k] = value * IN - ref
    obj.data.transform(Matrix.Translation(shift))
    return obj


def rot_z(deg):
    return Matrix.Rotation(math.radians(deg), 4, "Z")


def box(size, center, mat, rot=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.data.transform(Matrix.Diagonal((size[0] * IN, size[1] * IN, size[2] * IN, 1)))
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel * IN
        b.segments = 2
        bpy.ops.object.modifier_apply(modifier=b.name)
        smooth(o)
    if rot is not None:
        o.data.transform(rot)
    o.data.transform(Matrix.Translation(Vector(center) * IN))
    o.data.materials.append(material(mat))
    return o


def rod(a, b, radius, mat, sides=12):
    a, b = Vector(a) * IN, Vector(b) * IN
    bpy.ops.mesh.primitive_cylinder_add(radius=radius * IN, depth=(b - a).length, vertices=sides)
    o = bpy.context.object
    o.data.transform(Vector((0, 0, 1)).rotation_difference(b - a).to_matrix().to_4x4())
    o.data.transform(Matrix.Translation((a + b) / 2))
    o.data.materials.append(material(mat))
    smooth(o)
    return o


def sheet(points, faces, mat):
    me = bpy.data.meshes.new("sheet")
    me.from_pydata([Vector(p) * IN for p in points], [], faces)
    o = bpy.data.objects.new("sheet", me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(material(mat))
    return o


def export(objs, name):
    activate(objs[0])
    for o in objs:
        o.select_set(True)
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_extras=False, export_animations=False)
    print("MODEL %s: %d triângulos, %.0f kB" % (name, triangles(obj), os.path.getsize(path) / 1024))
    return obj


def preview(obj, name, distance, focus=None):
    if not PREVIEW:
        return
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    mn, mx = bounds(obj)
    target = Vector(focus) * IN if focus else (mn + mx) / 2
    cam = bpy.data.cameras.new("cam")
    cam.lens = 60
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    co.location = target + Vector((0.75, -1, 0.45)).normalized() * distance * IN
    co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = co
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_cavity = True
    sc.display.shading.show_object_outline = True
    sc.render.resolution_x = 1100
    sc.render.resolution_y = 800
    sc.render.film_transparent = True
    sc.render.filepath = os.path.join(PREVIEW, name + ".png")
    for o in sc.objects:
        o.hide_render = o is not obj and o is not co
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- HIVE (parte que vira), origem no pivô
CELL_INNER_Y = 18.84 / 2  # Fig. 9-9
CELL_DEPTH = 12.04
RIB_BOTTOM = -3.1  # a presilha de baixo da moldura abraça o tubo da base
FLOOR_Z = -1.55
WALL_TOP = FLOOR_Z + 7.61  # Fig. 9-11
PEAK = FLOOR_Z + 14
HALF_W = 9.9


def build_hive():
    parts = []
    rib = load("am-5866-red-red-goal-rib", "alliance", 5000)
    tube = load("am-5868-basket-base-tube", "aluminum", 600)
    bracket = load("am-5873-goal-pivot-bracket", "aluminum", 900)
    for s in (1, -1):
        flip = rot_z(0 if s == 1 else 180)
        for y0 in (CELL_INNER_Y, CELL_INNER_Y + CELL_DEPTH - 2):
            y = ("min", y0) if s == 1 else ("max", -y0)
            parts.append(put(copy(rib), flip, x=("c", 0), y=y, z=("min", RIB_BOTTOM)))
        y_tube = ("min", 4.75) if s == 1 else ("max", -4.75)
        parts.append(put(copy(tube), rot_z(90), x=("c", 0), y=y_tube, z=("c", RIB_BOTTOM + 0.5)))
        # chapas de policarbonato: fundo, laterais, telhado e a parede do lado do pivô (a ponta de fora é a abertura)
        ya, yb = s * (CELL_INNER_Y + 0.3), s * (CELL_INNER_Y + CELL_DEPTH - 0.3)
        c = 1.2  # cantos de baixo arredondados, como a moldura
        profile = [(-HALF_W + c, FLOOR_Z), (HALF_W - c, FLOOR_Z), (HALF_W, FLOOR_Z + c), (HALF_W, WALL_TOP), (0, PEAK), (-HALF_W, WALL_TOP), (-HALF_W, FLOOR_Z + c)]
        n = len(profile)
        pts = [(x, ya, z) for x, z in profile] + [(x, yb, z) for x, z in profile]
        faces = [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)] + [tuple(range(n))]
        parts.append(sheet(pts, faces, "polycarbonate"))
        # travessas entre as molduras, no meio do telhado
        for sx in (1, -1):
            x = sx * 5.2
            z = PEAK - (abs(x) / HALF_W) * (PEAK - WALL_TOP) + 0.35
            parts.append(rod((x, s * (CELL_INNER_Y + 1.6), z), (x, s * (CELL_INNER_Y + CELL_DEPTH - 1.6), z), 0.2, "aluminum", 6))
    for sx in (1, -1):
        parts.append(put(copy(bracket), rot_z(90), x=("c", sx * 0.56), y=("c", 0), z=("max", 0.75)))
    parts.append(rod((-1.1, 0, 0), (1.1, 0, 0), 0.16, "steel"))
    for o in (rib, tube, bracket):
        bpy.data.objects.remove(o)
    return export(parts, "hive")


# ---------------------------------------------------------------- Estrutura fixa das HIVEs (sistema do campo)
PIVOT_Z = 43.95
CORNER_Z = 39.6  # eixo da barra de cima; o topo do canto fica logo abaixo do suporte do eixo
FOOT_X, FOOT_Y = 49.46 / 2 - 1, 38.95 / 2 - 1  # §9.6.1


def build_frame():
    parts = []
    holder = load("am-5863-axle-holder", "black-plastic", 1200)
    leg = load("am-5876-a-frame-leg", "aluminum", 700)
    foot_bar = load("am-5878-sheet-metal-foot-bar", "steel", 500)
    top_bar = load("am-5875-a-frame-top-bar", "aluminum", 500)
    parts.append(put(top_bar, rot_z(90), x=("c", 0), y=("c", 0), z=("c", CORNER_Z)))
    for sx in (1, -1):
        # Canto de cima: bloco gerado com o tamanho da peça am-5874 (a peça do CAD vem sem a posição de
        # montagem e os encaixes das pernas não ficaram alinhados). A barra de 24 pol e as pernas entram nele.
        parts.append(box((3.2, 3.4, 4.7), (sx * 12.6, 0, CORNER_Z + 0.4), "black-plastic", bevel=0.35))
        parts.append(put(copy(holder), rot_z(90), x=("c", sx * 12.75), y=("c", 0), z=("min", CORNER_Z + 2.7)))
        parts.append(put(copy(foot_bar), rot_z(90), x=("c", sx * FOOT_X), y=("c", 0), z=("min", 0)))
        for sy in (1, -1):
            top = Vector((sx * 12.6, sy * 0.8, CORNER_Z - 0.3))
            foot = Vector((sx * FOOT_X, sy * FOOT_Y, 1.6))
            direction = (foot - top).normalized()
            # o perfil do CAD vai da origem até -45,75 pol em y: a ponta de baixo fica no pé, a de cima entra no canto
            turn = Vector((0, -1, 0)).rotation_difference(direction).to_matrix().to_4x4()
            parts.append(put(copy(leg), turn, origin=tuple(foot - direction * 45.75)))
            parts.append(box((2.3, 2.3, 2.1), (foot.x, foot.y, 1.05), "black-plastic", bevel=0.25))
    # painel de cada lado, preso às pernas (sem a arte oficial: o jogo aplica a própria textura)
    lean = math.atan2(FOOT_Y - 0.8, CORNER_Z - 1.9)
    for sy in (1, -1):
        tilt = Matrix.Rotation(-sy * lean, 4, "X")
        parts.append(box((30.16, 0.12, 6.46), (0, sy * 5.6, 30.4), "panel", rot=tilt))
    for o in (holder, leg, foot_bar):
        bpy.data.objects.remove(o)
    return export(parts, "hive-frame")


# ---------------------------------------------------------------- FLOWER (origem no piso, no eixo; parede em +y)
MIDDLE_BOTTOM = 0.43 + 3.55  # anel de baixo + abertura de retirada (Fig. 9-12)
TOP = 21.5


def build_flower():
    parts = []
    bottom = put(load("am-5859-flower-layer-x", "black-plastic", 2500), z=("min", 0))
    middle = put(load("am-5858-flower-layer-b", "black-plastic", 4000), Matrix.Rotation(math.pi, 4, "Y"), z=("min", MIDDLE_BOTTOM))
    top = put(load("am-5857-flower-layer-c", "flower-top", 4000), z=("max", TOP))
    parts += [bottom, middle, top]
    # os 4 canos ficam nos encaixes do anel do topo: os vértices mais baixos da peça, um grupo por quadrante
    mn, mx = bounds(top)
    low = [v.co for v in top.data.vertices if v.co.z < mn.z + 0.2 * IN]
    sockets = []
    for qx in (1, -1):
        for qy in (1, -1):
            group = [c for c in low if c.x * qx > 0 and c.y * qy > 0]
            sockets.append((sum(c.x for c in group) / len(group) / IN, sum(c.y for c in group) / len(group) / IN))
    print("FLOWER sockets (pol):", [tuple(round(v, 2) for v in s) for s in sockets])
    pipe = load("am-5862-flower-hips-pipe", "pipe", 300)
    for x, y in sockets:
        parts.append(put(copy(pipe), x=("c", x), y=("c", y), z=("min", MIDDLE_BOTTOM + 0.4)))
    bpy.data.objects.remove(pipe)
    # dois perfis do lado da parede seguram o anel do meio acima da abertura de retirada
    for x, y in sockets:
        if y > 0:
            parts.append(box((1, 1, MIDDLE_BOTTOM - 0.3), (x, y, 0.4 + (MIDDLE_BOTTOM - 0.3) / 2), "aluminum", bevel=0.06))
    # batente: tira perfurada 1,25 pol acima do topo, contornando o lado da parede
    z = TOP + 1.25
    radius = 2.75
    angles = [math.radians(a) for a in (20, 55, 90, 125, 160)]
    ring = [(math.cos(a) * radius, math.sin(a) * radius) for a in angles]
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        length = math.hypot(x1 - x0, y1 - y0) + 0.5
        turn = rot_z(math.degrees(math.atan2(y1 - y0, x1 - x0)))
        parts.append(box((length, 0.75, 0.13), ((x0 + x1) / 2, (y0 + y1) / 2, z - 0.065), "backstop", rot=turn))
    for x, y in (ring[0], ring[-1]):
        parts.append(rod((x, y, TOP - 0.2), (x, y, z), 0.19, "aluminum", 8))
    return export(parts, "flower")


bpy.ops.wm.read_factory_settings(use_empty=True)
for build, distance in ((build_hive, 95), (build_frame, 170), (build_flower, 60)):
    model = build()
    preview(model, model.name, distance)
    if model.name == "hive-frame":
        preview(model, "hive-frame-top", 30, (-12.75, 0, 41))
    if model.name == "hive":
        preview(model, "hive-end", 70, (0, 15, 5))
