# DuoForge Fusion Engine V1 — original research-inspired techniques

**Status:** Implemented in the *existing GitHub Preview 3D Studio* on this stacked branch (based on the Open Research Stack PR #29). Not a new platform and **not** installed in the live Sites app. No Work calls, hosted AI, cloud compute, model weights or mandatory paid services.

## Four new combined techniques

1. **SceneDNA — Structural Scene Fingerprinting:** captures bounded metadata from visible meshes (triangle topology, selected vertex positions at millimeter resolution, material parameters and semantic role). Produces an approximate order-insensitive scene fingerprint plus possible duplicates and a small role graph. FNV-1a 32-bit is *not* cryptographic and is **never** used to replace or delete assets; compare original GLB SHA-256 from Open Research Stack for exact duplicate detection.
2. **HorizonBudget — Camera-aware resource planner:** screen-space radius and semantic criticality prioritize character/vehicle detail across a selectable triangle budget (mobile/balanced/desktop). Has explicit outcomes `full`, `suggest-low-detail`, `preserve-critical`, `defer-detail`, `out-of-view`. **Suggestions only:** no mesh reduction, retopology, missing renderer feature, or fake GPU performance gain. Critical character/vehicles may exceed the chosen budget; that is reported.
3. **TemporalGovernor — Stable render scale:** optional browser-local preview dynamically modifies the **existing WebGL renderer's pixel ratio** using exponentially smoothed frame intervals, sustained slow/fast windows and hysteresis. Only active after clicking the button. It restores the renderer pixel ratio and camera on stop, respects other studio modes, never changes GLB/film export resolution. This is wall-clock frame duration, **not** GPU timing or WebGPU.
4. **Auto Director — Five-scene-angle planner:** an original deterministic 25-second 5-shot path calculated from the real bounds of scene meshes and a semantic hero subject. Includes real camera preview on the existing Three.js canvas plus portable editable JSON storyboard. Does **not** render a movie or substitute for Film Studio's real camera/video pipeline.

## Evidence and design inspirations (not implementations of those papers)

- **Wang et al., SIGGRAPH 2026, Real-Time Level-of-Detail Rendering with ReSTIR.** It motivated considering stability under LOD transitions; DuoForge does not implement ReSTIR, advanced surface-point mapping or NVIDIA technology. https://research.nvidia.com/labs/rtr/publication/wang2026levelofdetail/
- **Unterguggenberger et al., IEEE TVCG 2026, Real-Time Rendering Methods with Adaptive Levels of Detail for Fast Rendering of Parametric Objects on Modern GPUs.** Motivated view-dependent workloads, not a claim to reproduce tessellation results. https://www.cg.tuwien.ac.at/research/publications/2026/UNTERGUGGENBERGER-2026-ALOD/
- **Cheng et al., ICLR 2026, Continuous Level-of-Detail via 3D Gaussian Splatting.** Inspired smooth quality transitions, not splat LOD generation or neural training. https://proceedings.iclr.cc/paper_files/paper/2026/hash/90134bfef0230e6ec7afa0391396490b-Abstract-Conference.html
- **W3C WebGPU Candidate Recommendation Draft 2026-05-12.** Background for hardware-neutral browser graphics; this implementation continues using the existing WebGL renderer. https://www.w3.org/TR/2026/CRD-webgpu-20260512/

The **composition, heuristics, source code and interfaces** here are new DuoForge engineering, not a scientifically peer-reviewed breakthrough or the same algorithm as the cited papers.

## Reuse, license, privacy and cost

- Reuses GLB import/export, Render World, existing Three.js shaders, local asset indexing and experimental Gaussian preview from PR #29, without copying their logic.
- PR #16 (Creative Studio) and PR #26 (GPU Deluxe) are separate open branches. They **must not** be marked as integrated or merged until their diffs and production conflict resolution have been reviewed.
- This module introduces **zero new third-party dependencies** or paid APIs. It is written in original JavaScript and runs in the browser. Existing Three.js remains under its MIT license.
- Keeps all models on device; exported SceneDNA contains structural metadata and node names, not private texture bytes or vertex buffers. Always inspect metadata before sharing.
- Hardware and bandwidth can still cost money. This is not an AI model or an actual GPU replacement.

## QA and known limitations
- `node --test tests/fusion-engine.test.mjs`: deterministic unit tests for roles, privacy, budget, hysteresis, camera plan.
- `node tests/fusion-lab-smoke.mjs`: real desktop/mobile Chromium test, GLB scene, storyboard download and camera/quality preview start/stop.
- All checks must pass in GitHub Actions before merging. Main and live Sites are not changed by creating this PR.
- View priority is **approximate** sphere projection, not accurate occlusion/frustum culling, saliency neural network or physical lighting.
- Render scale improves fill-rate only when pixel-bound; it does not make physical geometry or mesh data smaller.
- Actual asset optimization, splat streaming, AI-assisted film composition, networked asset version sharing and game agent QA need later implementations with verified licensing and device testing.

