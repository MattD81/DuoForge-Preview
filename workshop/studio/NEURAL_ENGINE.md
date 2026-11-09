# DuoForge Neural Engine V0.1 — genuine trained inference, experimental

This is integrated into existing GPU Deluxe V2's Studio sidebar. The **Neural SR** button runs a small, truly trained (8-hidden-channel convolutional residual) network entirely inside the existing WebGL renderer; it does not use an external API or vendor GPU SDK. Output is 2× upscaled from a lower internal resolution. Existing temporal, analytic proxy ray tracing and normal WebGL modes stay available. A GPU-query circuit-breaker reverts to temporal after repeated slow samples; renderer errors revert to normal mode.

## Test evidence and limits

First training used only deterministic synthetic shapes (seed 20261029, 650 training steps, 20 held-out test images). Mean PSNR increased **26.695 → 26.976 dB** on those synthetic samples. This does *not* establish improvement on actual games, temporal stability, frame generation, 4K performance or DLSS parity. No user content or trained weights are sent to servers. The model is optional and opt-in.

## Real scene data: entirely local

1. Open 3D Studio in the feature branch, load a scene and click **Spara träningspar** repeatedly with different camera views, lighting, materials and geometry.
2. Each image is a single locally downloaded PNG atlas: **left** half high-resolution reference, **right** half nearest-neighbor enlarged 50%-resolution input. No upload occurs.
3. Keep at least 10 atlases in a local directory, install training-only `torch`, `numpy`, `Pillow`, and execute:
   `python services/neural-sr/train.py --dataset-dir /path/to/atlases --steps 650 --output workshop/studio/neural-sr-weights.mjs`.
4. Validate on scenes **not** used for training, compare GPU ms/PSNR and visible flicker. Replacing model weights should only be done in a reviewed branch.

Default reproducible training with no local data: `python services/neural-sr/train.py --output workshop/studio/neural-sr-weights.mjs`. Python and Torch are **not** browser runtime dependencies.

## Validation

`node --test tests/neural-sr.test.mjs`; `node --check workshop/studio/neural-sr.mjs`. Studio CI runs Playwright smoke in desktop Chromium. Shader compilation and actual graphics FPS on real iOS/Android hardware must still be validated manually before production release.

Roadmap: real scene dataset with held-out games, quantization and WebGPU backend, optical flow/motion vectors for temporal neural SR, proper real-geometry ray tracing and verified automated visual quality benchmarks. We do not claim these are already shipped. GitHub Pages hosts the model **files**, it does not train models on visitors' machines.
