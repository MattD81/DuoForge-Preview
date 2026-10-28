# RIFT CHAMPIONS · DuoForge Originals — 0.1.1

**Real-time 3D fighting game playable prototype**. Original procedural character designs (KAEL VORTEX / VEX REVENANT), articulated skeleton groups, detailed layered armor, PBR metallic materials, dramatic dynamic lighting, 3D neon arena with portal, hit sparks, shockwaves, WebAudio, camera shake, block, knockback, meter/specials, combo counter, CPU opponent, local two-player mode, keyboard/gamepad/touch input and best-of-three rounds.

## Start

`python3 -m http.server 8000` then open `http://localhost:8000`. The browser needs internet access to jsDelivr for Three.js 0.180.0; no AI/API keys, remote GLBs or image generation are used. Chrome/Firefox/Edge with WebGL2 required; optional bloom falls back to ordinary renderer.

Use a real server rather than double-clicking index.html because ES modules and imports require HTTP. Three.js is pinned in importmap and in package.json for DuoForge's isolated npm builder.

P1: A/D move, W jump, J jab, K heavy, L kick, U rift special (requires 40 energy), S block. P2: arrow keys, numpad1/2/3 attack, numpad0 special, down block. Gamepad uses left stick + buttons 0–5. Mobile has touchscreen buttons.

## Tests

`node --test tests/*.test.mjs` verifies deterministic gameplay mechanics without a browser. Actual WebGL render/play tests require a browser with WebGL and the Three.js module available. These tests are not proof of a complete AAA game.

## Source / services reused

- **Three.js** game engine and visual architecture from the existing public DuoForge Preview studio: PBR, procedural meshes, camera, lighting, optional bloom. Source modules are original and standalone, not a live call to Sites 3D workshop.
- **Asset intelligence**: only original procedurally created geometry; no copyrighted or private models required, and no external GLB paths. Future catalog integration can replace rig meshes if licensing/rigging pass validation.
- **Combat Doctor**: unit tests for timing, collision, guard and progression.
- **Play**: responsive aspect, pointer/touch/gamepad controls, optional quality.
- **Cinema**: camera composition, event shake, optional bloom. This is a game, not an MP4 output.
- **Version/Release**: private GitHub branch + review PR until tested. No automatic Sites publish.

## Boundaries

Existing DuoForge Prompt Orchestrator is NOT integrated into the running Sites server. This prototype uses compatible techniques but does not call all live services. It is neither a direct upgrade to Sites nor a final production Street Fighter-quality model. For that level, import custom properly licensed, fully rigged characters and motion-capture animations, then conduct real playtesting and polish.

## DuoForge isolated-builder repair (v0.1.1)

Fixed `project:style.css:1:12 ... npm-beroendet https: saknas` by deleting remote Google Fonts CSS `@import` and replacing Barlow/Rajdhani with installed-device font stacks. Do **not** add `https` to package.json. `three` is already declared. Regression test `tests/builder.test.mjs` covers this error.

If you have already imported v0.1.0 into DuoForge, update **the existing game's** `style.css` (remove line 1 beginning with `@import url('https://fonts.googleapis.com`) or replace the project's code with this corrected package while preserving the same project ID. The GitHub branch is a source of truth for this game; no production Sites update is implied.

Rendering on the real DuoForge isolated builder has not yet been verified from this environment. A new error, if any, needs its exact diagnostic rather than guessing.
