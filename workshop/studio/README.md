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

## Creative Studio: gemensamt resursflöde (utvecklingsgren)

En ny panel binder ihop lokalt GLB-bibliotek, grafikprofiler, ZIP-export till spel, Render World/Film Studio och en regelbaserad resursassistent utan att ersätta den befintliga redigeraren. **Sites-lagring och automatisk direktimport är ännu inte anslutna.** Se [integrationsplanen](./CREATIVE_STUDIO_INTEGRATION.md) för teststatus, säkerhetskrav och återstående arbete.

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
