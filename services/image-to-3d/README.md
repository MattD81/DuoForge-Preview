# DuoForge private Image-to-3D service (TripoSR)

This optional single-image → complete mesh → GLB inference pipeline connects the Character Forge panel to MIT-licensed TripoSR (https://github.com/VAST-AI-Research/TripoSR). It does not fake 3D by mapping a photograph over simple geometry.

**Status:** Server source and browser client are implemented; no model weights, GPU or running server are shipped by GitHub Pages. It works only after the owner installs/starts the upstream model on a compatible computer. It does not run on the current static site or the live Sites backend. Automatic reconstruction guesses unseen geometry and still requires artist review.

## Setup on a personal computer (not in ChatGPT Work)

Use Python 3.10+ and a compatible GPU. Upstream estimates ~6 GB GPU VRAM. CPU inference may be very slow. A 1 GB cloud VM is not a realistic inference host.

From the project root:
1. Change directory to services/image-to-3d.
2. Clone https://github.com/VAST-AI-Research/TripoSR.git so run.py is in services/image-to-3d/TripoSR/.
3. Install PyTorch matching your GPU (pytorch.org). Install upstream dependencies with pip install -r TripoSR/requirements.txt.
4. Install adapter dependencies with pip install -r requirements.txt.
5. Start with python server.py --port 7863 from this directory.
6. Open https://mattd81.github.io/DuoForge-Preview/workshop/studio/ on **the same computer**, select a PNG/JPG and click Generera GLB med lokal TripoSR.
7. The GLB is imported into the editor with undo, sculpting, Material Lab and export.

On first inference upstream may download model weights. No paid API key is used. Check image rights and upstream licenses for commercial distribution.

## Service interface

GET /health confirms local runner present (not GPU readiness). POST /generate requires multipart image and a required custom X-DuoForge-Request header. Responses are binary model/gltf-binary. Only the authorized site origins are permitted. Images up to 12 MB are processed in a private temporary directory, never saved to GitHub or uploaded to a cloud API by this adapter. Output <=50 MB, subprocess timeout 600 seconds.

For safety the server binds to 127.0.0.1 only, with CORS preflight and an Origin check. It accepts no user command or path input. **Do not expose this unauthenticated service to the internet.** A later multiuser Sites integration needs user authentication, quotas, rate limits, HTTPS, isolated jobs and owner-approved GPU infrastructure.

Safari/iPhone cannot access a 127.0.0.1 service running on some other machine. Mobile users can still use the procedural 360° model and silhouette importer. ML inference needs its own authorized server.

Upstream reference: https://github.com/VAST-AI-Research/TripoSR
