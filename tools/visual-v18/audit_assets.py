"""Read-only structural audit of the authored apartment asset bundle.

Run from the repository root: python tools/visual-v18/audit_assets.py
This checks file integrity and export contents; it is not a visual quality gate.
"""

import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "assets/apartment/registry-v18.json"


def read_glb(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("invalid GLB header")
    version, total_length = struct.unpack_from("<II", data, 4)
    if version != 2 or total_length != len(data):
        raise ValueError("invalid GLB version or length")
    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A or 20 + json_length > len(data):
        raise ValueError("invalid GLB JSON chunk")
    return json.loads(data[20 : 20 + json_length].decode("utf-8"))


def audit_asset(entry: dict) -> dict:
    runtime = ROOT / "public" / entry["runtime"].lstrip("/")
    source = ROOT / "assets" / entry["runtime"].removeprefix("/assets/")
    source = source.with_suffix(".blend")
    preview = source.parent / "preview.png"
    metadata = source.parent / "metadata.json"
    missing = [str(p.relative_to(ROOT)) for p in (runtime, source, preview, metadata) if not p.is_file()]
    if missing:
        return {"id": entry["id"], "status": "MISSING", "missing": missing}
    with source.open("rb") as source_file:
        source_header = source_file.read(7)
    if source_header != b"BLENDER":
        raise ValueError(f"{source}: invalid Blender header")
    with preview.open("rb") as preview_file:
        preview_header = preview_file.read(8)
    if preview_header != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{preview}: invalid PNG header")
    gltf = read_glb(runtime)
    meta = json.loads(metadata.read_text(encoding="utf-8"))
    triangles = 0
    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) == 4:
                accessor = primitive.get("indices", primitive.get("attributes", {}).get("POSITION"))
                triangles += gltf["accessors"][accessor]["count"] // 3
    dimensions = meta.get("dimensions", [])
    if len(dimensions) != 3 or not all(isinstance(d, (int, float)) and d > 0 for d in dimensions):
        raise ValueError(f"{metadata}: invalid dimensions")
    if meta.get("id") != entry["id"] or meta.get("runtime") != entry["runtime"]:
        raise ValueError(f"{metadata}: id/runtime does not match registry")
    if meta.get("meshCount") != len(gltf.get("meshes", [])) or meta.get("triangles") != triangles:
        raise ValueError(f"{metadata}: mesh/triangle totals do not match GLB")
    if not gltf.get("materials"):
        raise ValueError(f"{runtime}: no exported materials")
    return {
        "id": entry["id"],
        "status": "STRUCTURALLY VALID",
        "sourceBytes": source.stat().st_size,
        "runtimeBytes": runtime.stat().st_size,
        "meshes": len(gltf.get("meshes", [])),
        "triangles": triangles,
        "materials": len(gltf.get("materials", [])),
        "images": len(gltf.get("images", [])),
        "textures": len(gltf.get("textures", [])),
        "dimensionsMetres": dimensions,
        "preview": str(preview.relative_to(ROOT)),
        "visualGate": entry.get("status", "UNASSESSED"),
    }


if __name__ == "__main__":
    entries = json.loads(REGISTRY.read_text(encoding="utf-8"))
    results = [audit_asset(entry) for entry in entries]
    print(json.dumps(results, indent=2, ensure_ascii=False))
    if any(result["status"] != "STRUCTURALLY VALID" for result in results):
        raise SystemExit(1)
