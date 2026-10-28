# DuoForge Cinema Render Core V1 — independent local film pipeline

**Implemented now:** independent low-level rendering compositor, deterministic movie clock and shutter-angle temporal anti-aliasing; it works together with the existing DuoForge 3D Workshop.

## Architecture

1. Existing `render-world.mjs` + Three.js renders imported GLB assets, shadows, water and environment into a WebGL canvas. **The rasterizer/GLB importer is not rebuilt from scratch.**
2. New `cinema-engine-core.mjs` plans *exact frame counts*, shutter sample times, hardware guardrails and linear-light CPU accumulation. For 20 seconds × 24fps, exactly **480 frames** are required.
3. New `cinema-gpu-engine.mjs` creates and owns its **own separate WebGL2 context, render targets, fragment shader programs and GPU float16 multipass accumulation**. It takes multiple source frames per final image at film shutter times, averages in linear RGB and encodes back to sRGB. When GPU float16 is unsupported, fall back to the CPU compositor.
4. Film Studio's existing `frameSequence()` exports **resumable frame-exact PNG ZIP batches** with renderer metadata. Your existing video assembler can combine sequence parts into MP4/WebM (codec/browser-dependent) with imported local music.

**Use:** Open Film Studio → Cinema Engine Core V1 PNG export → choose 1, 2 or 4 samples per frame, 90°–360° shutter angle, 720p/1080p/4K, FPS, start frame and batch size → export ZIP chunks → optional MP4/WebM assembly.

## Guarantees & limits

- No Work credits, cloud render farm, AI inference, account key or external API.
- 20s means 480 frames at 24fps or 600 frames at 30fps. A 1.5-second teaser must **never** be represented as a 20-second deliverable.
- `4x`/180° blends temporally supersampled **already tone-mapped scene renders**. It does **not** magically supply path tracing, physically measured seawater, wave-fluid/ship collision or Blender-quality footage.
- Full quality depends on the existing scene (GLB mesh, lighting, sky, ocean), driver, resolution, motion and video encoder. Mobile max 720p/2 temporal samples. 4K offline memory is costly.
- Browser video encoding is separately subject to codec and GPU speed; offline ZIP frame timing is deterministic.
- Standard WebGL PBR film renderer, optional separate path-traced stills/film samples and local video assembly already existed before this PR. They are not claimed as new.
- Test: pure Node checks frame clock, per-device limits, sample timing; real Playwright browser checks both compositors and actual 2x Film Studio frame ZIP.

## Next quality work (not misrepresented as shipped)

Physically simulated ship displacement/wakes and wave breaking, sky HDR environment/reflection-probe capture, deeper volumetric clouds, displacement-based LOD and ocean FFT simulation, wave-optics/caustics, path-traced sequence GPU test on real hardware, calibrated motion blur with shutter curves, motion-vector AOV, offline WebCodecs frame-by-frame encoded MP4 with audio and resumable jobs.

The new core keeps render-time and pixel-accumulation logic modular so these features can plug in without rebuilding the whole site.
