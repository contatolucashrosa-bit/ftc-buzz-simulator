# Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
# Galpão industrial onde fica a arena: piso de concreto, paredes de chapa ondulada, pilares e vigas de aço,
# arquibancada com escadas do lado da plateia, mezanino com escada no fundo, containers nas laterais, portão de
# enrolar e luminárias. Tudo modelado aqui (sem assets de terceiros) e exportado em um GLB leve para o jogo,
# com um JSON das fileiras da arquibancada (onde o jogo senta a plateia).
#
# Uso: blender -b --python scripts/blender/build_venue.py -- public/models/venue [pasta-de-previas]
#
# Coordenadas: as funções recebem o sistema do jogo (metros, y para cima, plateia em +z, aliança vermelha em -x)
# e convertem para o Blender (z para cima); o exportador glTF desfaz a conversão.
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:]
OUT = args[0]
PREVIEW = args[1] if len(args) > 1 else None
os.makedirs(OUT, exist_ok=True)

# interior do galpão (m)
X0, X1 = -17.0, 17.0
Z0, Z1 = -13.0, 15.0
HEIGHT = 8.5

# Materiais: o jogo troca pelo nome e aplica as texturas (concreto, chapa); aqui valem para as prévias.
PALETTE = {
    "concrete": (0.42, 0.42, 0.41),
    "concrete-dark": (0.25, 0.25, 0.25),
    "wall-panel": (0.55, 0.57, 0.59),
    "roof-panel": (0.32, 0.33, 0.35),
    "steel": (0.2, 0.22, 0.25),
    "steel-light": (0.5, 0.52, 0.55),
    "safety-yellow": (0.95, 0.72, 0.05),
    "seat": (0.3, 0.32, 0.36),
    "bleacher": (0.36, 0.37, 0.38),
    "light": (1.0, 0.98, 0.92),
    "container-blue": (0.12, 0.25, 0.42),
    "container-orange": (0.72, 0.32, 0.1),
    "container-gray": (0.45, 0.46, 0.47),
    "container-green": (0.17, 0.33, 0.22),
    "door": (0.6, 0.62, 0.63),
    "banner-red": (0.8, 0.1, 0.12),
    "banner-blue": (0.0, 0.3, 0.62),
    "wood": (0.55, 0.4, 0.24),
}


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*PALETTE[name], 1)
    bsdf.inputs["Roughness"].default_value = 0.7
    if name == "light":
        bsdf.inputs["Emission Color"].default_value = (*PALETTE[name], 1)
        bsdf.inputs["Emission Strength"].default_value = 4
    m.diffuse_color = (*PALETTE[name], 1)
    return m


PARTS = []


def to_blender(x, y, z):
    return Vector((x, -z, y))


def box(cx, cy, cz, sx, sy, sz, mat, rot_y=0.0, rot_x=0.0):
    """Caixa centrada em (cx, cy, cz) do jogo, com tamanhos sx (x), sy (altura) e sz (z)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.data.transform(Matrix.Diagonal((sx, sz, sy, 1)))
    if rot_x:
        o.data.transform(Matrix.Rotation(-rot_x, 4, "X"))
    if rot_y:
        o.data.transform(Matrix.Rotation(rot_y, 4, "Z"))
    o.data.transform(Matrix.Translation(to_blender(cx, cy, cz)))
    o.data.materials.append(material(mat))
    PARTS.append(o)
    return o


def rod(a, b, radius, mat, sides=8):
    a, b = to_blender(*a), to_blender(*b)
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=(b - a).length, vertices=sides)
    o = bpy.context.object
    o.data.transform(Vector((0, 0, 1)).rotation_difference(b - a).to_matrix().to_4x4())
    o.data.transform(Matrix.Translation((a + b) / 2))
    o.data.materials.append(material(mat))
    for p in o.data.polygons:
        p.use_smooth = True
    PARTS.append(o)
    return o


def cylinder(cx, cy, cz, radius, height, mat, sides=16):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, vertices=sides, location=to_blender(cx, cy, cz))
    o = bpy.context.object
    o.data.materials.append(material(mat))
    PARTS.append(o)
    return o


# ---------------------------------------------------------------- piso, paredes e cobertura

def shell():
    # topo do piso 1,5 cm abaixo de zero: os TILES e as faixas do campo ficam em y = 0 (evita "z-fighting")
    box(0, -0.065, (Z0 + Z1) / 2, X1 - X0 + 1, 0.1, Z1 - Z0 + 1, "concrete")
    t = 0.2
    # paredes: rodapé de concreto, chapa lisa por trás e nervuras verticais (chapa ondulada de verdade)
    walls = [
        ((X0 + X1) / 2, Z0 - t / 2, X1 - X0, "z"),
        ((X0 + X1) / 2, Z1 + t / 2, X1 - X0, "z"),
        (X0 - t / 2, (Z0 + Z1) / 2, Z1 - Z0, "x"),
        (X1 + t / 2, (Z0 + Z1) / 2, Z1 - Z0, "x"),
    ]
    for cx, cz, length, axis in walls:
        sx, sz = (length, t) if axis == "z" else (t, length)
        box(cx, HEIGHT / 2, cz, sx, HEIGHT, sz, "wall-panel")
        inward = (-1 if cz > 0 else 1) if axis == "z" else (-1 if cx > 0 else 1)
        plinth = 1.1
        if axis == "z":
            box(cx, plinth / 2, cz + inward * (t / 2 + 0.06), sx, plinth, 0.12, "concrete-dark")
        else:
            box(cx + inward * (t / 2 + 0.06), plinth / 2, cz, 0.12, plinth, sz, "concrete-dark")
        pitch = 0.32
        n = int(length / pitch)
        for i in range(n):
            u = -length / 2 + (i + 0.5) * pitch
            h = HEIGHT - plinth
            if axis == "z":
                box(cx + u, plinth + h / 2, cz + inward * (t / 2 + 0.025), 0.1, h, 0.05, "wall-panel")
            else:
                box(cx + inward * (t / 2 + 0.025), plinth + h / 2, cz + u, 0.05, h, 0.1, "wall-panel")
    # cobertura: chapa escura com faixas de telha translúcida (claraboias)
    box(0, HEIGHT + 0.05, (Z0 + Z1) / 2, X1 - X0, 0.1, Z1 - Z0, "roof-panel")
    for z in (-6.5, 1.0, 8.5):
        box(0, HEIGHT - 0.01, z, X1 - X0 - 2, 0.02, 1.4, "light")


def structure():
    # pilares nas paredes e vigas atravessando o galpão (pórticos a cada 5,6 m)
    zs = [Z0 + i * (Z1 - Z0) / 5 for i in range(6)]
    for z in zs:
        for x in (X0 + 0.25, X1 - 0.25):
            box(x, HEIGHT / 2, z, 0.35, HEIGHT, 0.35, "steel")
            box(x, HEIGHT / 2, z, 0.08, HEIGHT, 0.32, "steel")
        box(0, HEIGHT - 0.35, z, X1 - X0, 0.5, 0.22, "steel")
        # treliça: banzo inferior e diagonais
        box(0, HEIGHT - 1.55, z, X1 - X0 - 1, 0.12, 0.12, "steel")
        n = 12
        for i in range(n):
            xa = X0 + 0.5 + i * (X1 - X0 - 1) / n
            xb = xa + (X1 - X0 - 1) / n
            low, high = HEIGHT - 1.55, HEIGHT - 0.6
            a, b = ((xa, low, z), (xb, high, z)) if i % 2 == 0 else ((xa, high, z), (xb, low, z))
            rod(a, b, 0.04, "steel", 6)
    # terças ao longo do galpão
    for x in range(-15, 16, 3):
        box(x, HEIGHT - 0.15, (Z0 + Z1) / 2, 0.1, 0.15, Z1 - Z0, "steel")
    # luminárias industriais (campânulas) sobre a área da arena e da plateia
    for x in (-6, -2, 2, 6):
        for z in (-5, -1.5, 2, 5.5, 9):
            cylinder(x, HEIGHT - 2.2, z, 0.32, 0.28, "steel-light", 18)
            cylinder(x, HEIGHT - 2.35, z, 0.29, 0.02, "light", 18)
            rod((x, HEIGHT - 2.05, z), (x, HEIGHT - 0.6, z), 0.012, "steel", 4)


# ---------------------------------------------------------------- arquibancada (lado da plateia, +z)

SEAT_ROWS = []


def bleachers():
    rows = 7
    z_front = 7.0
    depth = 0.85
    rise = 0.42
    half = 9.0
    aisles = [(-4.2, 1.2), (4.2, 1.2)]  # centro e largura das escadas

    def in_aisle(x0, x1):
        return [(c - w / 2, c + w / 2) for c, w in aisles if c + w / 2 > x0 and c - w / 2 < x1]

    def segments(x0, x1):
        out = []
        cuts = sorted(in_aisle(x0, x1))
        cur = x0
        for a, b in cuts:
            if a > cur:
                out.append((cur, a))
            cur = max(cur, b)
        if cur < x1:
            out.append((cur, x1))
        return out

    for i in range(rows):
        top = (i + 1) * rise
        zc = z_front + i * depth + depth / 2
        for a, b in segments(-half, half):
            # degrau de concreto até o chão (fecha por baixo) e banco de plástico por cima
            box((a + b) / 2, top / 2, zc, b - a, top, depth, "bleacher")
            box((a + b) / 2, top + 0.2, zc + 0.12, b - a - 0.04, 0.05, 0.38, "seat")
            box((a + b) / 2, top + 0.1, zc + 0.12, b - a - 0.04, 0.2, 0.05, "seat")
        SEAT_ROWS.append({"y": round(top + 0.22, 3), "z": round(zc + 0.12, 3), "segments": [[round(a + 0.3, 2), round(b - 0.3, 2)] for a, b in segments(-half, half)]})
    # escadas dos corredores: meio degrau a cada fileira, faixa amarela no espelho e corrimão
    for c, w in aisles:
        for i in range(rows * 2):
            top = (i + 1) * rise / 2
            z = z_front + i * depth / 2 + depth / 4
            box(c, top / 2, z, w, top, depth / 2, "concrete-dark")
            box(c, top - 0.01, z - depth / 4 + 0.03, w, 0.02, 0.06, "safety-yellow")
        for side in (-1, 1):
            x = c + side * (w / 2 - 0.05)
            a = (x, rise / 2 + 0.9, z_front)
            b = (x, rows * rise + 0.9, z_front + rows * depth)
            rod(a, b, 0.025, "safety-yellow")
            for k in range(0, rows + 1, 2):
                t = k / rows
                p = (x, rise / 2 + t * (rows * rise - rise / 2), z_front + t * rows * depth)
                rod(p, (p[0], p[1] + 0.9, p[2]), 0.02, "safety-yellow")
    # guarda-corpo atrás da última fileira e nas laterais
    back = z_front + rows * depth
    top = rows * rise
    rod((-half, top + 1.0, back - 0.05), (half, top + 1.0, back - 0.05), 0.03, "safety-yellow")
    for x in range(-9, 10, 2):
        rod((x, top, back - 0.05), (x, top + 1.0, back - 0.05), 0.02, "safety-yellow")
    for side in (-1, 1):
        x = side * (half + 0.05)
        rod((x, rise + 0.9, z_front), (x, top + 1.0, back), 0.03, "safety-yellow")
    # parede de fundo da arquibancada até o guarda-corpo (tampa o vão por trás)
    box(0, top / 2, back + 0.1, half * 2, top, 0.2, "concrete-dark")
    # faixa amarela de segurança no chão, na frente da arquibancada
    box(0, -0.012, z_front - 0.35, half * 2 + 1, 0.006, 0.1, "safety-yellow")


# ---------------------------------------------------------------- mezanino com escada (fundo, -z)

def mezzanine():
    level = 3.6
    x0, x1 = -10.0, 8.0
    za, zb = Z0 + 0.1, Z0 + 2.5
    box((x0 + x1) / 2, level - 0.1, (za + zb) / 2, x1 - x0, 0.2, zb - za, "steel")
    box((x0 + x1) / 2, level + 0.005, (za + zb) / 2, x1 - x0 - 0.1, 0.01, zb - za - 0.1, "steel-light")
    for x in (x0 + 0.2, (x0 + x1) / 2, x1 - 0.2):
        box(x, (level - 0.2) / 2, zb - 0.15, 0.22, level - 0.2, 0.22, "steel")
    # guarda-corpo amarelo
    rod((x0, level + 1.05, zb), (x1, level + 1.05, zb), 0.03, "safety-yellow")
    rod((x0, level + 0.55, zb), (x1, level + 0.55, zb), 0.02, "safety-yellow")
    for i in range(int(x1 - x0) + 1):
        x = x0 + i
        rod((x, level, zb), (x, level + 1.05, zb), 0.02, "safety-yellow")
    box((x0 + x1) / 2, level + 0.06, zb - 0.02, x1 - x0, 0.12, 0.02, "safety-yellow")
    # escada reta descendo do mezanino até o piso, junto à parede do fundo
    steps = 18
    rise = level / steps
    run = 0.28
    width = 1.1
    zc = Z0 + 0.1 + width / 2 + 0.05
    for i in range(steps):
        x = x1 + 0.15 + i * run + run / 2
        y = level - (i + 1) * rise
        box(x, y + rise / 2 - 0.02, zc, run, 0.04, width, "steel-light")
    for side in (-1, 1):
        z = zc + side * width / 2
        a = (x1 + 0.15, level, z)
        b = (x1 + 0.15 + steps * run, 0.0, z)
        rod(a, b, 0.05, "steel", 6)
        rod((a[0], a[1] + 0.95, z), (b[0], b[1] + 0.95, z), 0.025, "safety-yellow")


# ---------------------------------------------------------------- containers, portão e banners

def container(cx, cz, rot, mat, stack=0, length=6.06):
    w, h = 2.44, 2.59
    y = stack * h
    body = box(cx, y + h / 2, cz, length, h, w, mat, rot_y=rot)
    c, s = math.cos(rot), math.sin(rot)

    def local(u, v):
        # u ao longo do comprimento, v ao longo da largura (no plano x/z do jogo)
        return cx + u * c - v * s, cz - (u * s + v * c)

    # nervuras nas laterais compridas, cantoneiras e portas no fundo
    pitch = 0.28
    for i in range(int((length - 0.4) / pitch)):
        u = -length / 2 + 0.2 + (i + 0.5) * pitch
        for side in (-1, 1):
            x, z = local(u, side * (w / 2 + 0.02))
            box(x, y + h / 2, z, 0.1, h - 0.3, 0.04, mat, rot_y=rot)
    for su in (-1, 1):
        for sv in (-1, 1):
            x, z = local(su * (length / 2 - 0.08), sv * (w / 2 - 0.08))
            box(x, y + h / 2, z, 0.18, h + 0.02, 0.18, "steel", rot_y=rot)
    for sv in (-0.5, 0.5):
        x, z = local(length / 2 + 0.02, sv * w * 0.5)
        box(x, y + h / 2, z, 0.04, h - 0.25, w / 2 - 0.1, mat, rot_y=rot)
        for k in (-0.3, 0.3):
            x2, z2 = local(length / 2 + 0.06, sv * w * 0.5 + k * 0.5)
            box(x2, y + h / 2, z2, 0.03, h - 0.4, 0.04, "steel-light", rot_y=rot)
    return body


def props():
    # lateral vermelha (-x): containers deitados junto à parede, um empilhado
    container(X0 + 1.5, -6.5, math.pi / 2, "container-blue")
    container(X0 + 1.5, -6.5, math.pi / 2, "container-gray", stack=1)
    container(X0 + 1.5, 0.5, math.pi / 2, "container-orange")
    # lateral azul (+x): portão de enrolar e containers mais atrás
    container(X1 - 1.5, -6.0, math.pi / 2, "container-green")
    container(X1 - 1.5, -6.0, math.pi / 2, "container-blue", stack=1)
    door_z = 2.5
    box(X1 - 0.05, 2.6, door_z, 0.06, 5.2, 5.0, "door")
    for i in range(26):
        box(X1 - 0.09, 0.1 + i * 0.2, door_z, 0.03, 0.03, 4.9, "steel-light")
    box(X1 - 0.12, 5.35, door_z, 0.3, 0.35, 5.4, "steel")
    for side in (-1, 1):
        box(X1 - 0.1, 2.7, door_z + side * 2.6, 0.2, 5.4, 0.18, "safety-yellow")
    # paletes e caixas de madeira encostadas
    for x, z in ((X0 + 1.4, 5.0), (X0 + 1.4, 6.4), (X1 - 1.4, 7.6)):
        box(x, 0.07, z, 1.2, 0.14, 1.0, "wood")
        box(x, 0.14 + 0.35, z, 1.0, 0.7, 0.8, "wood")
    # banners das alianças pendurados na viga, em cima de cada ALLIANCE AREA (sem logotipos)
    for side, mat in ((-1, "banner-red"), (1, "banner-blue")):
        x = side * 9.5
        box(x, HEIGHT - 2.0, -2.0, 0.04, 2.2, 4.2, mat)
        rod((x, HEIGHT - 0.9, -4.1), (x, HEIGHT - 0.9, 0.1), 0.03, "steel")
    # faixas amarelas no piso: área da arena e corredor até a arquibancada
    for x0, x1, z0, z1 in ((-5.4, 5.4, -4.4, -4.3), (-5.4, 5.4, 4.3, 4.4), (-5.4, -5.3, -4.4, 4.4), (5.3, 5.4, -4.4, 4.4)):
        box((x0 + x1) / 2, -0.012, (z0 + z1) / 2, x1 - x0, 0.006, z1 - z0, "safety-yellow")


bpy.ops.wm.read_factory_settings(use_empty=True)
shell()
structure()
bleachers()
mezzanine()
props()

# junta tudo por material (poucas chamadas de desenho no jogo)
bpy.ops.object.select_all(action="DESELECT")
for o in PARTS:
    o.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.object.join()
venue = bpy.context.view_layer.objects.active
venue.name = "warehouse"
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.object.mode_set(mode="OBJECT")
triangles = sum(len(p.vertices) - 2 for p in venue.data.polygons)
path = os.path.join(OUT, "warehouse.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_animations=False)
with open(os.path.join(OUT, "warehouse.json"), "w", encoding="utf-8") as f:
    json.dump({"seatRows": SEAT_ROWS, "bounds": {"x": [X0, X1], "z": [Z0, Z1], "height": HEIGHT}}, f, indent=1)
print("VENUE: %d triângulos, %.0f kB, %d fileiras" % (triangles, os.path.getsize(path) / 1024, len(SEAT_ROWS)))

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_cavity = True
    sc.render.resolution_x = 1280
    sc.render.resolution_y = 720
    # campo (só de referência na prévia)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15))
    field = bpy.context.object
    field.scale = (3.66, 3.66, 0.3)
    m = bpy.data.materials.new("field")
    m.diffuse_color = (0.85, 0.85, 0.85, 1)
    field.data.materials.append(m)
    # sem o teto, para ver por dentro
    cam = bpy.data.cameras.new("cam")
    cam.lens = 18
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    for name, pos, target in (("venue-audience", (0, 5.2 * 1.4, 3.2 * 1.4), (0, 0, 0.5)), ("venue-driver", (-3.2, 0, 1.8), (2, 0, 1.2)), ("venue-back", (6, 13.5, 6.5), (-2, -6, 1.5))):
        # pos/target já no Blender: (x, -z_jogo, y)
        co.location = to_blender(pos[0], pos[2], pos[1]) if False else Vector((pos[0], pos[1] if name != "venue-audience" else -pos[1], pos[2]))
        if name == "venue-back":
            co.location = Vector((6, -13.5, 6.5))
            target = (-2, 6, 1.5)
        co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.camera = co
        sc.render.filepath = os.path.join(PREVIEW, name + ".png")
        bpy.ops.render.render(write_still=True)
