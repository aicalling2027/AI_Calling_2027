"""Render a preview of artifact.glb without a GPU or a 3D dependency.

The asset is small and built from primitives, so a plain orthographic
rasteriser is enough to answer the only question a preview has to answer: does
the exported geometry look like the object we described? It reads the committed
GLB, not the authoring program, so a broken export cannot pass.

Depth is resolved per pixel against a z-buffer rather than by sorting whole
triangles: a painter's order draws a near-edge-on face as a stray sliver across
the body, and no sorting rule fixes that without splitting triangles.

    python render_preview.py [--yaw -22] [--pitch 12] [--out preview.png]
"""

import argparse
import json
import math
import struct
from pathlib import Path

from PIL import Image


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, _length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise SystemExit(f"{path} is not a glTF 2.0 binary")
    offset, doc, binary = 12, None, b""
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        payload = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == 0x4E4F534A:
            doc = json.loads(payload)
        elif chunk_type == 0x004E4942:
            binary = payload
        offset += 8 + chunk_length
    return doc, binary


COMPONENT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_accessor(doc, binary, index):
    accessor = doc["accessors"][index]
    view = doc["bufferViews"][accessor["bufferView"]]
    fmt, size = COMPONENT[accessor["componentType"]]
    width = WIDTH[accessor["type"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    stride = view.get("byteStride") or size * width
    out = []
    for i in range(accessor["count"]):
        base = start + i * stride
        out.append(struct.unpack_from("<" + fmt * width, binary, base))
    return out


def mat_mul(a, b):
    return [
        [sum(a[r][k] * b[k][c] for k in range(4)) for c in range(4)]
        for r in range(4)
    ]


def node_matrix(node):
    if "matrix" in node:
        m = node["matrix"]
        return [[m[c * 4 + r] for c in range(4)] for r in range(4)]
    tx, ty, tz = node.get("translation", (0, 0, 0))
    qx, qy, qz, qw = node.get("rotation", (0, 0, 0, 1))
    sx, sy, sz = node.get("scale", (1, 1, 1))
    rot = [
        [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
        [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
        [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
    ]
    return [
        [rot[0][0] * sx, rot[0][1] * sy, rot[0][2] * sz, tx],
        [rot[1][0] * sx, rot[1][1] * sy, rot[1][2] * sz, ty],
        [rot[2][0] * sx, rot[2][1] * sy, rot[2][2] * sz, tz],
        [0, 0, 0, 1],
    ]


def apply(m, p):
    x, y, z = p
    return [
        m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
        m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
        m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3],
    ]


def rotation(yaw_deg, pitch_deg):
    yaw, pitch = math.radians(yaw_deg), math.radians(pitch_deg)
    ry = [[math.cos(yaw), 0, math.sin(yaw)], [0, 1, 0], [-math.sin(yaw), 0, math.cos(yaw)]]
    rx = [[1, 0, 0], [0, math.cos(pitch), -math.sin(pitch)], [0, math.sin(pitch), math.cos(pitch)]]
    return [
        [sum(rx[r][k] * ry[k][c] for k in range(3)) for c in range(3)]
        for r in range(3)
    ]


def base_color(doc, material_index):
    if material_index is None:
        return (200, 204, 210)
    material = doc["materials"][material_index]
    pbr = material.get("pbrMetallicRoughness", {})
    rgb = pbr.get("baseColorFactor", (0.8, 0.8, 0.8, 1))[:3]
    emissive = material.get("emissiveFactor", (0, 0, 0))
    # Emissive is folded in at partial weight: at full strength the call screen
    # saturates to pure blue and hides the glass it is printed on.
    lifted = [min(1.0, c + e * 0.55) for c, e in zip(rgb, emissive)]
    return tuple(int(round(c * 255)) for c in lifted)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--glb", default="artifact.glb")
    parser.add_argument("--out", default="preview.png")
    parser.add_argument("--yaw", type=float, default=-24.0)
    parser.add_argument("--pitch", type=float, default=10.0)
    parser.add_argument("--size", type=int, default=900)
    args = parser.parse_args()

    doc, binary = read_glb(args.glb)
    scene = doc["scenes"][doc.get("scene", 0)]

    triangles = []
    for root in scene["nodes"]:
        stack = [(root, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])]
        while stack:
            index, parent = stack.pop()
            node = doc["nodes"][index]
            world = mat_mul(parent, node_matrix(node))
            for child in node.get("children", []):
                stack.append((child, world))
            if "mesh" not in node:
                continue
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                positions = read_accessor(doc, binary, primitive["attributes"]["POSITION"])
                indices = [i[0] for i in read_accessor(doc, binary, primitive["indices"])]
                colour = base_color(doc, primitive.get("material"))
                points = [apply(world, p) for p in positions]
                for i in range(0, len(indices), 3):
                    triangles.append(([points[j] for j in indices[i : i + 3]], colour))

    cam = rotation(args.yaw, args.pitch)
    projected = []
    for corners, colour in triangles:
        cam_pts = [[sum(cam[r][k] * p[k] for k in range(3)) for r in range(3)] for p in corners]
        a, b, c = cam_pts
        u1 = [b[i] - a[i] for i in range(3)]
        u2 = [c[i] - a[i] for i in range(3)]
        normal = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]]
        if normal[2] <= 0:  # back face in this orthographic view
            continue
        length = math.sqrt(sum(n * n for n in normal)) or 1.0
        normal = [n / length for n in normal]
        light = [-0.35, 0.55, 0.76]
        lam = max(0.0, sum(normal[i] * light[i] for i in range(3)))
        shade = 0.42 + 0.58 * lam
        tint = tuple(min(255, int(round(ch * shade))) for ch in colour)
        projected.append((cam_pts, tint))

    xs = [p[0] for pts, _ in projected for p in pts]
    ys = [p[1] for pts, _ in projected for p in pts]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    span = max(max_x - min_x, max_y - min_y) or 1.0

    scale = args.size * 0.82 / span
    cx, cy = (min_x + max_x) / 2, (min_y + max_y) / 2
    canvas = args.size
    image = Image.new("RGB", (canvas, canvas), (247, 250, 254))
    pixels = image.load()
    zbuf = [-1e9] * (canvas * canvas)

    for cam_pts, tint in projected:
        (ax, ay, az), (bx, by, bz), (cx_, cy_, cz) = cam_pts
        ax = canvas / 2 + (ax - cx) * scale
        bx = canvas / 2 + (bx - cx) * scale
        cx_ = canvas / 2 + (cx_ - cx) * scale
        ay = canvas / 2 - (ay - cy) * scale
        by = canvas / 2 - (by - cy) * scale
        cy_ = canvas / 2 - (cy_ - cy) * scale

        area = (bx - ax) * (cy_ - ay) - (by - ay) * (cx_ - ax)
        if area == 0:
            continue
        if area < 0:  # normalise the winding so inside is always w >= 0
            ax, ay, az, bx, by, bz = bx, by, bz, ax, ay, az
            area = -area

        left = max(0, int(math.floor(min(ax, bx, cx_))))
        right = min(canvas - 1, int(math.ceil(max(ax, bx, cx_))))
        top = max(0, int(math.floor(min(ay, by, cy_))))
        bottom = min(canvas - 1, int(math.ceil(max(ay, by, cy_))))

        for py in range(top, bottom + 1):
            sy = py + 0.5
            row = py * canvas
            for px in range(left, right + 1):
                sx = px + 0.5
                w0 = ((bx - sx) * (cy_ - sy) - (by - sy) * (cx_ - sx)) / area
                if w0 < 0.0:
                    continue
                w1 = ((cx_ - sx) * (ay - sy) - (cy_ - sy) * (ax - sx)) / area
                if w1 < 0.0:
                    continue
                w2 = 1.0 - w0 - w1
                if w2 < 0.0:
                    continue
                depth = w0 * az + w1 * bz + w2 * cz
                if depth > zbuf[row + px]:
                    zbuf[row + px] = depth
                    pixels[px, py] = tint

    image.save(args.out)
    print(f"{len(projected)} triangles -> {args.out}")


if __name__ == "__main__":
    main()
