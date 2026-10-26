# DuoForge 3D Studio (GitHub Pages)

A self-contained, browser-based 3D editor at `/workshop/studio/`. It works with Three.js over a CDN, the existing public GitHub model catalog `/workshop/models.json` and browser-local project saves. No paid AI, Work, model server, database or private access tokens are required.

## Implemented

- Scene hierarchy with nested meshes/groups and object selection by click.
- Transform gizmos (move, rotate, scale), world/local axes, grid snapping, orbit camera.
- Inspector: object name, visible, transforms, PBR base color, roughness, metalness, opacity and wireframe.
- Primitive geometry, reusable procedural house/cart/tree presets from GitHub catalog.
- GLB import **without guessing or modifying model axes**; manual rotation by gizmos and inspector.
- GLB export, editable Three.js scene JSON export/import, PNG screenshots.
- Browser-local saved scenes in IndexedDB, no cloud sync.
- Undo/redo (up to 35 steps), duplication, deletion and place object on ground.
- Desktop and mobile layout, keyboard shortcuts.

## Test

On PRs affecting this editor, the `studio-tests.yml` workflow checks JS syntax and starts Chromium for a browser smoke test, editing and GLB download. Tests must pass before merging.

## Known limitations

This is an interactive **modeling editor MVP**, not feature parity with Blender or Sites. No vertex sculpting, Boolean mesh cutting, UV painting, animation timeline, rigging, physically accurate vehicle simulation, cloud library or collaboration yet. Custom GLB files from private repositories aren't copied into this public repo automatically. Imported multi-material meshes may be unified when the inspector's material settings are edited. Texture editing and advanced model formats are not supported. The generated project JSON uses Three.js serialization and can become large for textured assets.

Controls: G move, R rotate, S scale, F focus, Delete remove, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo. Drag gizmo handles to transform objects. On mobile use the onscreen buttons and touch orbit controls.

Privacy/cost: The public Pages website contains only public workshop code and procedural starter assets. Imported models and projects are processed in browser memory and stored locally only if the user saves them. GitHub Pages doesn't run the full DuoForge backend.
