# DuoForge 2D Deluxe Engine — V1

**A real, original 2D rendering and game engine built into the existing DuoForge Preview repository, not a new platform.** Play the original five-relic platform game [LANTERN VALE](../../games/lantern-vale/). No imported game framework, AI APIs or cloud rendering.

## Components

- `renderer.mjs`: genuine WebGL2 fragment shader lighting. A Canvas2D drawing pipeline produces 3 dynamic layers (albedo, tangent-space normal vectors and an occluder mask). GPU compositor computes up to six colored moving point lights, per-pixel normal-dependent diffuse/specular response, eight-step 2D occlusion from the two foremost lights, attenuation and atmospheric grading. Canvas2D fallback when WebGL2 is unavailable. This is a **2D shader-based lighting system**, not WebGPU path tracing.
- `world.mjs`: hand-designed painted 2.5D scene with deterministic layered mountain/pine parallax, custom scenery, a floating-mist pass, procedural fireflies, platforms, rock ledges and optional light emitters.
- `physics.mjs`: fully standalone fixed 60 Hz world simulation, AABB collision, movement damping, variable jump, buffered jumps, coyote time, gaps, reset on fall, five collectible goals, goal shrine and portrait-aware camera. Pure functions suitable for Node tests.
- `skeleton.mjs`: procedural 2D humanoid with independently animated legs, IK knees and two-segment limbs, walking phase, cape motion and an attached lantern light.
- `../../games/lantern-vale/`: full-screen original playable demo. Keyboard, touchscreen, connected gamepad, optional generated WebAudio tones. 4 land areas separated by 3 jumpable gaps, raised ruins and five collectable fragments.

## Technical scope

No Phaser, PixiJS, Rapier, WebAssembly or external 2D sprite packs have been installed. V1 instead **implements original minimal capabilities directly**. That avoids framework licenses/dependencies and makes the components portable to an existing editor. The compositor uses WebGL2; it is not GPU ray tracing, and its occlusion is a limited screen-space approximation. The IK system draws a single original procedural character, not imported skeletal animation files. The physics engine currently handles axis-aligned solids, not arbitrary rotating polygon rigid bodies. V1 does not include a built-in level authoring GUI or animation timeline.

For more ambitious V2, implement GPU-instanced tile/sprite batching, SDF scene shadows, integrated editor panels and sprite atlas/GLB-to-sprite export.

## API

```js
import {createRenderer} from "./renderer.mjs";
import {createState,stepPhysics} from "./physics.mjs";
import {paintLandscape,createLights} from "./world.mjs";

const state=createState();
stepPhysics(state,{right:true,jump:false},1/60);
const renderer=createRenderer(htmlCanvas,{width:960,height:540});
renderer.paint(frame=>paintLandscape(frame,state),performance.now()/1000,createLights(state,0));
```

The modules can be reused independently. To use a custom game, replace `paintLandscape` and supply new light descriptors to `renderer.paint`. Dynamic normal/occlusion channels remain optional from a graphics-authoring perspective, but the pipeline always uploads all three layers.

## Run / test

```bash
python3 -m http.server 8080
# http://localhost:8080/games/lantern-vale/
node --test tests/duoforge-2d.test.mjs
```

GitHub Actions `duoforge-2d-tests.yml` tests actual WebGL shader startup plus mobile portrait controls and uploads real Chromium screenshots. Running `file://` directly fails ES module CORS.

## Sites integration

This is implemented in **DuoForge-Preview on GitHub Pages**, not production Sites. The Sites platform's latest actual production source is not present in the GitHub mirror; **do not imply this preview engine has been installed in Sites**. No Work run or paid service used, though GitHub Actions incurs its ordinary CI minute allowances.
