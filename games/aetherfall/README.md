# AETHERFALL — The Fractured Sky

A real **three-level 3D action game**, built for existing DuoForge GitHub Preview and import into the existing DuoForge platform; no new platform or paid services.

**How to play:** Move WASD/arrows, J or mouse attack, Shift or K dash, E or L energy pulse, Space jump, P/Esc pause. iOS/Android: always-visible four-direction touch pad + jump/dash/pulse/attack. Controllers: analog left stick, buttons A=jump, B=dash, X=attack, Y=pulse. Fight guardians, collect 3 energy cores per stage, defeat the minimum number of guardians and enter the shining portal. Three differently arranged arenas, stronger enemies and level-specific atmospheres. Score and health carry forward.

## DuoForge Fusion technologies actually used
- `sceneDNA` from `./fusion-engine.mjs` computes a deterministic scene-structure fingerprint on level load. The UI displays it. **It is not an AI scene recognizer.**
- `planDetailBudget` calculates a real camera-priority plan every 0.6 seconds. For noncritical ruin carvings, we also apply a simple distance/screen-space visibility tier. The player, enemies, crystals, portal, geometry and textures stay untouched. **This is selective geometry hiding, not true mesh simplification or a GPU speed guarantee.**
- `createTemporalBudgetGovernor` changes WebGL output pixel ratio only after sustained frame-pressure with hysteresis. 30 fps mobile / 60 fps desktop target. Resets on stage transition.
- `createCinemaPlan` + `cameraAt` drive a short five-angle intro montage from the real current scene descriptors; controls skip it for immediate play.
- Procedural PBR character, animated neon opponents, crystal pickups, 3D stone architecture, fragment-shader sky and animated ocean surface. All authored with Three.js and native browser APIs (Three MIT).

## Source / dependencies / limitations
The game bundles the **same new DuoForge Fusion Engine V1 source** in `./fusion-engine.mjs`, making this published game self-contained for DuoForge's isolated game builder. The engine originated in the separate Fusion Engine PR #32, but this game release does not depend on that PR being merged. Maintain version parity manually when upgrading the underlying engine; this release's CI tests the bundled engine independently.

No downloaded GLBs, paid AI APIs, new servers or cloud GPUs. Uses three@0.180.0 (MIT). CSS has no remote imports. Browser preview uses version-pinned jsDelivr CDN for Three. In isolated DuoForge builds the `three` dependency is declared in package.json.

AETHERFALL is **stylized/procedural**, not photorealistic or motion-captured. It does not claim generative models or true Gaussian Splatting. Github Pages serves only the default branch: a PR URL alone is not a playable production link.

## Tests
`node --test games/aetherfall/logic.test.mjs`
`node tests/aetherfall-smoke.mjs` after starting local HTTP server at 127.0.0.1:8080 and installing Playwright Chromium. CI runs these before merging.

## Publication
After review and passing CI, merge this standalone game PR to `main`. Github Pages publishes to `/DuoForge-Preview/games/aetherfall/`. Plugin's GitHub import can then copy the game into the existing DuoForge project list under category `3D`, with branch `main` and directory `games/aetherfall`.
