# DuoForge Material Vault V1 — 360 PBR recipes + genuine downloadable texture sets

**Status:** implemented in existing DuoForge Preview 3D Studio, using Material Lab's selected objects and undo/redo, no new platform or paid service.

## What is actually inside

30 original material families × 12 reproducible variants = **360 distinct procedural recipes**. Families: granite, marble, slate, limestone, basalt, brick, concrete, plaster, ceramic, tiles, oak, pine, walnut, bark, bamboo, sand, soil, moss, grass, snow, ice, asphalt, cobblestone, car paint, rubber, carbon fibre, steel, copper, gold and rust. All map code is authored for DuoForge, with no third-party artwork.

Families have material-specific texture pattern equations (grain, sediment, wood fibre, brick grout, tiles, carbon weave, etc.), not just labels. The 12 variants change lightness/hue, wear, gloss, relief/contrast, and deterministic seeds. **These are stylized synthetic textures** rather than photogrammetric 4K scans, and real material realism varies by lighting, scale and reference.

## Workflow

Open `/workshop/studio/` → Material (mobile dock) → **📚 360 material** → search/category/filter/favorites → select recipe → choose 128, 256, 512, or 1024 map size → **Applicera** to selected 3D model, or **Hämta PBR-texturer** for the three PNG files and license/metadata JSON in ZIP. GLB export includes texture maps.

Gallery draws only first 30 lightweight thumbnails, then 30 more when requested; high-res maps computed lazily. Repeated material application uses the same material instance within a group, which avoids duplicating GPU resources per submesh. Favorites saved only in this browser's localStorage.

## PBR correctness and limitations

Generated maps per recipe:
- `basecolor.png`: RGB/sRGB colour.
- `normal.png`: RGB tangent-space normal with **+Y up** convention and positive Z, linear data.
- `orm.png`: packed R=occlusion, G=roughness, B=metalness, linear data.
- `material.json`: recipe, resolution, channel layout, rights.

Browser uses `THREE.MeshStandardMaterial` with colour, normal, roughness and metalness maps. The packed ORM's **R/AO channel is provided in ZIP** but not used by the renderer if a second UV set is unavailable. Do not claim that AO is displayed or embedded as a glTF occlusion texture. Three.js/glTF roughness uses G and metalness B. The existing planar fallback is applied to imported meshes missing UV, but complex curves may show stretching; high-quality hand UV/tri-planar workflow remains future work.

A glTF model can be exported and tested via a full import for all three mapped material features. File size and GPU memory rise with resolution; use 128/256 on phones, 512/1024 only when the device can afford it. Physical material scans, 4K photos, real ambient occlusion baking from a high-poly scene, displacement and HDR environment lighting are **not** implemented here.

## Rights

All map pixels are deterministically generated on the user's device from original project code. No third-party textures have been downloaded or redistributed. The source code is governed by the repository's license; the maps carry a `DuoForge-original` provenance note. Before distributing project code or others' uploaded GLB, check applicable licenses.

## Reference standards (implementation-aligned)

- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html — Khronos metallic-roughness PBR, normal map conventions, channel packing.
- https://www.khronos.org/gltf/pbr/ — glTF materials, roughness and normal.
- https://threejs.org/docs/pages/MeshStandardMaterial.html — Three.js supported map colour spaces.

## QA

`node --test tests/pbr-vault-core.test.mjs` verifies all 360 recipes, categories/variants, deterministic repeatability, real pixel maps and metal/dielectric channels.
`tests/pbr-vault-browser.mjs` performs actual Chromium GLB export → reimport, ZIP download and simulated iPhone UI interactions.
