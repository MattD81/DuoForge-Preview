# DuoForge GPU Deluxe V1 — cross-vendor preview rendering

**Status: feature branch / draft PR, NOT deployed to the real ChatGPT Sites app.** This implementation lives in the *existing* GitHub Pages 3D Studio Render World, preserving its original editable scene, GLB export and Film Studio code. No Work, external paid API, neural-model weights or rented GPU.

## Shipped code in this branch
- **WebGL2 GPU rendering:** still uses the existing Three.js renderer, existing Ocean V5 shader/PBR, SSAO, SMAA, bloom and cinematic postprocessing. New V1 uses the same renderer and does NOT allocate another WebGL context.
- **Adaptive resolution / frame pacing:** GPU Deluxe Auto and Performance estimate wall-clock frame time using rAF, smooth over time (EWMA), ignore background pauses and change device pixel ratio in bounded 0.035/0.07 steps after 48 frames. Modes Quality and Off do not change image resolution. Target is ~30 FPS on narrow devices, ~60 otherwise. These are *goals*, not guaranteed measured FPS.
- **Contrast-aware spatial detail pass** in the existing High-quality composer, with original five-tap GLSL, low-cost halo protection, activated only if GPU Deluxe is enabled. This is NOT DLSS, FSR, XeSS, neural reconstruction or temporal super-resolution.
- **Diagnostics / capabilities:** shows current mode, estimated FPS, p95 wall-clock frame time, device pixel ratio and WebGL backend. No GPU model/vendor fingerprinting.
- **Preserves film output:** scaling is disabled while Film Studio panel is open and while recording. The existing explicit setOutputSize / restoreOutputSize still dictates capture resolution. Editor preview is unchanged.

## User interface
Open the existing Studio, import or select a 3D model, tap "🌍 Testa i renderad värld", then set **GPU Deluxe** to Auto (default), Quality, Performance or Off. High-quality rendering can enable the spatial enhancement pass. GPU Deluxe does not apply to arbitrary saved games or Sites by itself.

## Research and vendor inspiration, *not* vendor code
- NVIDIA's DLSS 4.5 and ReSTIR PT Enhanced: temporal stability, selective reuse, reducing ray/sample cost. Official sources: https://www.nvidia.com/en-us/geforce/news/gamescom-2026-nvidia-geforce-rtx-dlss-4-5-announcements/ and https://research.nvidia.com/labs/rtr/publication/lin2026restirptenhanced/
- AMD FidelityFX / FSR Redstone: scalable rendering, contrast-aware image enhancement, variable quality tiers. Official: https://gpuopen.com/amd-fsr-upscaling/ and https://www.amd.com/en/products/graphics/technologies/fidelityfx.html
- Intel XeSS 3 / XeLL: consistent frame pacing, lowering interaction latency, super-resolution. Official: https://www.intel.com/content/www/us/en/developer/topic-technology/gamedev/xess.html
- Open web: https://www.w3.org/TR/2026/CRD-webgpu-20260521/ and https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

**Copyright/legal:** Do not copy the proprietary DLSS/FSR4/XeSS implementations or market our code as those brands. This V1 is original GLSL, frame pacing heuristics and standard WebGL2 APIs. WebGPU compute is a separate experimental prototype at PixelGames PR #7; it is not a claimed current dependency or an actual acceleration backend for the existing WebGL3D Studio.

## QA / prerequisites
Run:
- `node --test tests/gpu-deluxe.test.mjs`
- `node tests/render-world-smoke.mjs` with local server and Playwright installed
- Existing Ocean, Film Studio, GLB roundtrip and mobile smoke tests.

Verify performance under sustained load, mobile thermal throttling, scene preservation on exit, film frame dimensions and duration, device loss, screenshot color, low/medium/high transitions, and neutral device behavior across NVIDIA, AMD and Intel GPUs. Chromium SwiftShader alone does not validate real vendor GPUs.

**Limitation:** This V1 offers real adaptive pixel ratio and one spatial GPU shader, not world-leading neural path tracing, hardware frame generation, motion vectors, GPU raytracing, VRAM scheduling, or multi-GPU computing.

## Next steps
1. Pass real browser/mobile tests and review PR.
2. Compare p50/p95 frame times and full/half-res image quality on at least 3 vendor devices.
3. Prototype WebGPU backend and use the same GPUDevice for compute and render (Ocean engine); fall back to existing Ocean V5/WebGL shader path.
4. Only then evaluate legal/technical integration of permissively licensed AMD libraries or third-party open implementations and train native denoising/upscaling if beneficial and affordable.
