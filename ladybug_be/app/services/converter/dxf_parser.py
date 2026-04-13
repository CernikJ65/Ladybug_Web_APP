"""
Parsování DXF POLYFACE_MESH entit → ladybug_geometry Point3D.

Obsahuje:
  - parse_polyface_mesh()    → surová data (body + face indexy)
  - extract_mesh_boundary()  → obrysový polygon z triangulovaného meshe

Knihovna ladybug_geometry poskytuje Point3D pro přesnou reprezentaci
3D bodů v souřadnicovém systému stavebního modelu.

Soubor: ladybug_be/app/services/converter/dxf_parser.py
"""

from ladybug_geometry.geometry3d.pointvector import Point3D


def parse_polyface_mesh(entity) -> tuple[list[Point3D], list[list[int]]]:
    """
    Přečte POLYFACE_MESH entitu z ezdxf.

    Rozlišuje vertex flags:
      - 0xC0 (192) → definiční bod meshe (souřadnice)
      - 0x80 (128) → face index záznam (odkazy na body)

    Returns:
        (vertices: list[Point3D], face_indices: list[list[int]])
    """
    mesh_vertices: list[Point3D] = []
    face_index_records: list[list[int]] = []

    for v in entity.vertices:
        vflags = v.dxf.get("flags", 0)

        if vflags & 0xC0 == 0xC0:
            loc = v.dxf.location
            mesh_vertices.append(Point3D(loc.x, loc.y, loc.z))

        elif vflags & 0x80:
            indices = []
            for attr in ("vtx0", "vtx1", "vtx2", "vtx3"):
                val = v.dxf.get(attr, 0)
                if val != 0:
                    indices.append(abs(val) - 1)
            if len(indices) >= 3:
                face_index_records.append(indices)

    return mesh_vertices, face_index_records


def extract_mesh_boundary(
    vertices: list[Point3D],
    face_indices: list[list[int]],
) -> list[Point3D] | None:
    """
    Z triangulovaného meshe extrahuje obrysový polygon.

    Princip: hrany které patří jen jednomu trojúhelníku
    tvoří vnější obrys (boundary edges). Tyto hrany se
    spojí do uzavřeného polygonu procházením adjacency mapy.

    Returns:
        Uspořádaný seznam Point3D tvořící polygon, nebo None.
    """
    if not vertices or not face_indices:
        return None

    # Spočítej kolikrát se každá hrana objevuje
    edge_count: dict[tuple[int, int], int] = {}
    for face in face_indices:
        n = len(face)
        for i in range(n):
            v1, v2 = face[i], face[(i + 1) % n]
            edge = (min(v1, v2), max(v1, v2))
            edge_count[edge] = edge_count.get(edge, 0) + 1

    # Obrysové hrany = count == 1
    boundary_edges = [
        (v1, v2) for (v1, v2), c in edge_count.items() if c == 1
    ]
    if len(boundary_edges) < 3:
        return None

    # Adjacency map pro řetězení hran do polygonu
    adj: dict[int, list[int]] = {}
    for v1, v2 in boundary_edges:
        adj.setdefault(v1, []).append(v2)
        adj.setdefault(v2, []).append(v1)

    # Projdi obrys od prvního bodu
    start = boundary_edges[0][0]
    polygon_indices = [start]
    visited = {start}

    while True:
        current = polygon_indices[-1]
        neighbors = adj.get(current, [])
        next_v = None
        for n in neighbors:
            if n not in visited:
                next_v = n
                break
        if next_v is None:
            break
        polygon_indices.append(next_v)
        visited.add(next_v)

    if len(polygon_indices) < 3:
        return None

    return [
        vertices[i] for i in polygon_indices
        if i < len(vertices)
    ]