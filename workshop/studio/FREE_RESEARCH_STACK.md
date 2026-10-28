# DuoForge Open Research Stack V1 — license-fee-free building block

Status: GitHub Preview feature branch, not integrated in the live Sites source.
Open `/workshop/studio/` and use the **Öppen forskningsstack** panel.

## What works in this PR
- **Read-only scene and GLB analysis**: triangle and material counts; malformed GLB checks, extensions, external buffers/images, missing decoder requirements, skinned mesh warnings.
- **Device diagnostics**: actual studio backend, WebGPU *availability* (not rendering), canvas size and WebGL context condition. Does not claim Nvidia/AMD/Intel features.
- **Local SHA-256 index**: deliberate click computes a SHA-256 of an exported GLB, then stores metadata (no model binary) in IndexedDB `duoforge-research-index-local`. Exact hashes are deduplicated. Same display name with a different digest is a new version. The index is origin/browser-local, not a Sites or GitHub asset cloud.
- **Portable audit JSON**: includes GLB manifest, digest and warnings. It **does not contain the model**. Export the GLB independently, using existing 2048/1024 texture-size exporters.
- **Non-destructive health checks**: inspect invalid transforms, high triangle counts and unsupported GLB features, without editing the scene.
- Uses browser native APIs + existing Three.js / Editor. No new server, paid API, model download, GPU rental, tokens, or Work calls.

## Compatible optional zero-license-fee technologies (NOT auto-installed)
- WebGPU (native browser API): active renderer is still WebGL; current GPU Deluxe implementation is in separate PR #26.
- gltfpack / meshoptimizer (MIT): optimize a downloaded GLB **offline** by installing the CLI locally; animated rigs/named wheels must be checked afterward. Never replace source automatically.
  Example: `gltfpack -i input.glb -o output.glb -kn -km -ke`.
- KTX2/Basis Universal texture export (KTX Software mainly Apache-2.0, third-party license review required): separate tools/decoder needed before loading compressed textures.
- Gaussian Splatting: Spark (MIT) is a *candidate* renderer, **not embedded**. Supported splat formats are not ordinary GLB meshes. Verify exact dependency versions and input asset rights before integrating.
- ONNX Runtime (MIT) and TripoSR (MIT) can run on user hardware with separately downloaded permitted model weights; do not promise free electricity/compute or hosted inference. Existing optional TripoSR endpoint remains separate.

## Cost & licensing guardrails
No paid *software license* required for these native functions, but storage, network, compute and third-party hosting may cost money. Free/open-source licenses still require notices and may have conditions. Every added model, texture, splat scene or trained weight needs its own rights check. Do not silently integrate source-available/restricted models.
Never send user models, source projects, private GitHub data, tokens or scans to third-party services without explicit consent.

## Test
`node --test tests/research-stack.test.mjs`
CI smoke tests in `.github/workflows/studio-tests.yml`.
Limits: Not photogrammetry, not AI image reconstruction, not a path-traced renderer, not an automatic KTX2 or meshoptimizer encoder, and not a full playable-game QA system. Real Sites API integration and release remain separate.
