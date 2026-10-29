# DuoForge Shape DNA Lab V1 — experimental surface evolution

**Status:** functional experimental code in 3D Studio when merged and published, not a replacement for full single-image AI 3D reconstruction.

## Research motivation
Instead of spending expensive GPU minutes reconstructing a whole character each time, try a cheap **local refinement loop**:
1. Import or create actual 360-degree mesh (DuoForge Character Forge, external owned GLB, 3D scanner, etc).
2. Detect surface family from part name/material (stone, bark, scales, skin).
3. Evaluate three reproducible 3D noise-based deformation DNA seeds, retaining UV, geometry topology and bone weights.
4. Reject or scale back candidates causing reversed triangles; cap max displacement and vertex budget.
5. Select a candidate and inspect its exported GLB on mobile and desktop. Undo is non-destructive.

The score is **technical geometric risk**, not photorealism, aesthetics or ground-truth correspondence. There are no fake multi-camera screenshots. The six-axis check is bounding-volume analysis. We make no claim to have invented fractal noise, smooth deformation or genetic search.

## Original synthesis and references

- Material-conditioned fBm and coordinate-domain warping. The tool is a custom implementation; no third-party generator weights.
- Fractal relief is adapted to local object-space coordinates; the result does not depend on a UV image. It keeps skinning attributes and uv mapping.
- Face-normal inversion fraction and max relative displacement limit risk; selecting 3 seeds resembles human-in-the-loop search rather than model training.
- Image-informed shape fitting remains future work. Our inspiration is **Fancy123** (CVPR 2025) https://openaccess.thecvf.com/content/CVPR2025/html/Yu_Fancy123_One_Image_to_High-Quality_3D_Mesh_Generation_via_Plug-and-Play_CVPR_2025_paper.html
- Normal-driven identity-preserving mesh deformation research: **Geometry in Style** (CVPR 2025) https://openaccess.thecvf.com/content/CVPR2025/html/Dinh_Geometry_in_Style_3D_Stylization_via_Surface_Normal_Deformation_CVPR_2025_paper.html
- Real-time mesh reconstruction: **MeshSplatting** (CVPR 2026) https://openaccess.thecvf.com/content/CVPR2026/html/Held_MeshSplatting_Differentiable_Rendering_with_Opaque_Meshes_CVPR_2026_paper.html
- Khronos glTF geometry/skin/animation standards https://registry.khronos.org/glTF/

## Known gaps and experiments for V2
- Geometry changes are deliberately subtle (typically under 1.2 % of mesh diagonal) for safety, so models with bad anatomy cannot be fixed by this method.
- Each mesh gets local relief; continuity across adjacent separate meshes and silhouette matching to references are not solved.
- Current score cannot detect self-intersection, anatomical wrongness, texture quality or thin overlapping pieces. Need multi-camera rendered image comparisons and volumetric SDF penalty.
- Triangle risk is evaluated on bounded samples, so the model must still pass glTF Validator and human 360 review. Better offline QA is needed.
- Performance cap 95k vertices for one selection; no GPU compute needed.
- No OpenAI Work, model downloads, paid APIs or changing Sites DB. This is a small additive module in the existing Studio.
