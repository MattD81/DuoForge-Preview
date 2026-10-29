# DuoForge 3D Studio (GitHub Pages)

A self-contained, browser-based 3D editor at `/workshop/studio/`. It works with Three.js over a CDN, the existing public GitHub model catalog `/workshop/models.json` and browser-local project saves. No paid AI, Work, model server, database or private access tokens are required.

## Implemented

- Scene hierarchy with nested meshes/groups and object selection by click.
- Transform gizmos (move, rotate, scale), world/local axes, grid snapping, orbit camera.
- Inspector: object name, visible, transforms, PBR base color, roughness, metalness, opacity and wireframe.
- Basic **real mesh vertex sculpting**: draw over a selected mesh to move vertices, change brush size/strength, recalculate surface normals, undo changes (maximum 250,000 vertices).
- Primitive geometry, reusable procedural house/cart/tree presets from GitHub catalog.
- GLB import **without guessing or modifying model axes**; manual rotation by gizmos and inspector.
- GLB export, editable Three.js scene JSON export/import, PNG screenshots.
- Browser-local saved scenes in IndexedDB, no cloud sync.
- Undo/redo (up to 35 steps), duplication, deletion and place object on ground.
- Desktop and mobile layout, keyboard shortcuts.

## Render World Preview (free, three stages)

The **🌍 Testa i renderad värld** button runs a *non-destructive cloned asset* in an ephemeral procedural environment. The original editable model, transform and GLB exports are unaffected.

1. **Worlds**: Showroom (PBR presentation pedestal), racetrack, forest, city and neon night. All geometry, stars, roads, lights and sky are authored procedurally. No copyrighted/private assets or paid model API.
2. **Graphics**: WebGL renderer with ACES tone mapping, real-time directional shadows, fog, emissive accents and RoomEnvironment PMREM lighting (a locally generated reflection environment, not external HDRI). Low/Medium/High switches limit render resolution and shadows; High tries bloom and SSAO. If post-processing is unsupported, preview falls back to the normal renderer. High can be slow on mobile and software renderers.
3. **Play and inspect**: Orbit, follow, free-camera WASD and automated cinematic orbit; playable vehicles with wheel animation/keyboard/gamepad/touch; four simple glowing checkpoints; interactive city door (E when close); reset challenge; PNG screenshots and optional short local WebM/MP4 recordings using MediaRecorder when supported. Other static GLBs can be inspected, but no automatic character rigging/walking or full physical collisions are claimed.

The preview content is never put in the editable scene root and is never saved to the GLB. Switching worlds and exiting restores the editor. It renders on the user's GPU through WebGL, so no cloud GPU rental; browser/device performance still varies.

## Test

On PRs affecting this editor, the `studio-tests.yml` workflow checks JS syntax and starts Chromium for a browser smoke test, editing and GLB download. Tests must pass before merging.

## Known limitations

This is an interactive **modeling editor MVP**, not feature parity with Blender or Sites. No advanced topology editing, Boolean mesh cutting, UV painting, animation timeline, rigging, physically accurate vehicle simulation, cloud library or collaboration yet. Custom GLB files from private repositories aren't copied into this public repo automatically. Imported multi-material meshes may be unified when the inspector's material settings are edited. Texture editing and advanced model formats are not supported. The generated project JSON uses Three.js serialization and can become large for textured assets.

Controls: G move, R rotate, S scale, F focus, Delete remove, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo. Drag gizmo handles to transform objects. On mobile use the onscreen buttons and touch orbit controls.

Privacy/cost: The public Pages website contains only public workshop code and procedural starter assets. Imported models and projects are processed in browser memory and stored locally only if the user saves them. GitHub Pages doesn't run the full DuoForge backend.


## Character Forge – genuine geometry (v1)

The new Character Forge panel lives in the EXISTING /workshop/studio/ editor. It does not create a second platform or change Sites.

- Skull mage starter model: fully volumetric editable mesh parts for a rounded cloak and hood, modeled skull and eye sockets, cloth details, jewelry and a curved staff. The back is explicitly modeled, not a reference photo stretched over a box.
- Geometry quality: mobile, balanced and high presets control the procedural mesh density. Three original palettes and a staff toggle are available. The model is added to the standard scene tree and supports existing transform, sculpt, Material Lab, undo/redo, browser-local save and regular GLB export.
- Image to geometry (limited): an uploaded transparent PNG or an isolated object on a uniform background can be traced into a genuine beveled 2.5D silhouette extrusion. Color is derived from an average of foreground pixels; no reference photograph is pasted onto a flat mesh. This is not high-quality single-image 360-degree AI reconstruction. The silhouette's unseen backside is manufactured, not inferred.
- Images are kept on-device, downscaled to at most 384 px for analysis (max input 12 MB), with limits on generated geometry. No paid services, uploaded models or new API keys are used.

Known limitations: Full generative 3D from arbitrary images (including hidden surfaces, texture inference, retopology and armature/animation) uses the OPTIONAL self-hosted TripoSR adapter in services/image-to-3d; its source and client are included, but the model weights and running GPU server are not. Without that explicitly installed separate service, Character Forge v1 uses a parametric modeler with a limited silhouette tool. No automatic rigging is claimed. GitHub Pages is separate from the live Sites platform.

tests/character-forge-smoke.mjs covers generating a volumetric character, editing it, exporting GLB, silhouette import and a mobile smoke check.

Optional TripoSR implementation and instructions: services/image-to-3d/README.md. The AI generation button checks for an authorized service on your own computer; it never claims AI is available when the model/server is missing.

## Creature Forge V2 — 4 one-click rigged presets (2026-10-29)

This additive module uses the **existing** Character Forge, Studio scene tree, Material Lab's free
procedural PBR surfaces, local WebGL rendering, rig bridge and regular GLB exporter. It does not
modify or claim deployment into the separate live Sites project.

**Studio workflow:** open `/workshop/studio/`, go to Character Forge → Creature Forge V2, choose
Castle Golem / Mountain Brute / Forest Guardian / Serpent (or type a matching Swedish description),
choose Mobile/Balanced/High, then press **Bygg, rigga och texturera**. Preview available animation
clips; export the finished scene with **Exportera GLB** (or Mobile GLB). No Work, paid API or external
GPU is required for these procedural creatures.

**Actual implementation:** mesh-based geometry on front, sides and back; textures (stone, bark,
leather, grass, tile-like scales) using procedural local CanvasTexture/PBR; distinct deformable
`THREE.SkinnedMesh` limbs on humanoids and a curved, bone-chain, skinned serpent body;
2+ embedded bone animations per preset. Bone names are unique across instances and all clips
are forwarded to `GLTFExporter`, instead of being silently discarded. The output remains editable.

**Honest limitations:** presets are stylized/procedural, not Meshy-like photogrammetric quality;
typing new adjectives does **not** synthesize a new sculpt or estimate hidden geometry. The
existing optional image→3D TripoSR adapter remains separate and requires a self-hosted model;
it does not automatically rig the resulting model. Animation rigging covers generated presets,
not arbitrary uploaded GLBs. These presets are not fully anatomical muscle simulation.
Export is scene-wide, including other objects already present. New design, retopology, 4K
textures and high-fidelity single-photo 3D are separate engineering tasks.

**Automated checks:** `node tests/creature-forge-smoke.mjs` in `studio-tests.yml` tests each
preset in Chromium, GLB mesh/skins/animations/PBR/texture chunks, animation playback, undo,
and mobile prompt routing. Never treat documentation or a PR as proof of passing CI.
