# Blender 3.6+ / 4.x: export the user's own licensed lazercar S90 Blender model
# to a DuoForge-compatible GLB. The original .blend remains unchanged.
# Example:
# blender -b "/path/Volvo S90 Recharge.blend" --python tools/volvo-s90-convert.py -- \
#   "/path/s90-showroom.glb" --mode showroom
#
# Optimized draft (higher detail loss; inspect manually before shipping):
# blender -b "/path/Volvo S90 Recharge.blend" --python tools/volvo-s90-convert.py -- \
#   "/path/s90-game.glb" --mode game
#
# This script DOES NOT download artist assets and does not override licenses.
import bpy
import os
import sys
import re
from pathlib import Path

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if not args or args[0].startswith("--"):
    raise SystemExit("Usage: blender -b SOURCE.blend --python tools/volvo-s90-convert.py -- OUTPUT.glb [--mode showroom|game]")
target = Path(args[0]).expanduser().resolve()
mode = args[args.index("--mode")+1] if "--mode" in args and args.index("--mode")+1<len(args) else "showroom"
if mode not in {"showroom", "game"}:
    raise SystemExit("mode must be showroom or game")
target.parent.mkdir(parents=True, exist_ok=True)

def triangle_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(max(1, len(face.vertices)-2) for face in obj.data.polygons)

def preserve_mesh(obj):
    name=obj.name.lower()
    # Steering, wheel, doors, interior controls must retain recognizable parts.
    return bool(re.search(r"wheel|tire|tyre|rim|hub|door|caliper|headlight|taillight|window|glass|interior", name))

if mode=="game":
    count=0
    for obj in [o for o in bpy.context.scene.objects if o.type=="MESH" and not o.hide_render]:
        triangles=triangle_count(obj)
        # Only reduce large static car panels. Never alter small detailed parts
        # blindly: most premium S90 detail is in many little meshes.
        if triangles < 10000 or preserve_mesh(obj):
            continue
        modifier=obj.modifiers.new(name="DuoForge draft LOD decimate",type="DECIMATE")
        modifier.ratio = 0.45 if triangles>=30000 else .65
        count+=1
    print(f"DuoForge: LOD decimate modifiers added to {count} large static meshes")
    for image in bpy.data.images:
        if image.source not in {"FILE","GENERATED"}:
            continue
        # Do not shrink depth maps, normal maps or other noncolor images by default.
        if image.size[0]>2048 or image.size[1]>2048:
            factor=min(2048/max(1,image.size[0]),2048/max(1,image.size[1]))
            try:
                image.scale(max(1,int(image.size[0]*factor)),max(1,int(image.size[1]*factor)))
            except Exception as error:
                print("DuoForge: could not resize texture", image.name, str(error))
        
# Embed creator credit directly in glTF extras.
credit = ("Volvo S90 Recharge 3D by Adam Wiese (lazercar), "
          "Creative Commons Attribution (CC BY), "
          "https://sketchfab.com/3d-models/volvo-s90-recharge-free-9462b07c10244fd4a28d86846dc9e3a9")
metadata=bpy.data.objects.new("Attribution - lazercar CC BY",None)
bpy.context.scene.collection.objects.link(metadata)
metadata["author"]="Adam Wiese (lazercar)"
metadata["license"]="CC BY"
metadata["source"]="https://sketchfab.com/3d-models/volvo-s90-recharge-free-9462b07c10244fd4a28d86846dc9e3a9"
metadata["attribution"]=credit
metadata["mode"]=mode

for obj in bpy.context.selected_objects:
    obj.select_set(False)
# Leave scene object names intact so DuoForge can identify wheel meshes.
bpy.ops.export_scene.gltf(
    filepath=str(target),
    export_format="GLB",
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_extras=True,
    export_yup=True,
    export_apply=False
)
credit_path=target.with_name(target.stem+"-ATTRIBUTION.txt")
credit_path.write_text(
    credit+"\nUnofficial asset. Volvo Cars is not affiliated with DuoForge.\n"
    +"You are responsible for complying with the original asset license.\n",
    encoding="utf-8"
)
print("DuoForge: exported", target, "bytes", target.stat().st_size)
print("DuoForge: attribution",credit_path)
