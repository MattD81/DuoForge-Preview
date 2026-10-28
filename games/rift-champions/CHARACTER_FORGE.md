# RIFT CHAMPIONS — 3D Character Forge v2

This is the existing RIFT CHAMPIONS 3D game, upgraded with two new articulated glTF 2.0 PBR fighters. The model-building code lives in `build-models.mjs` and is compiled into GLB at GitHub Pages deploy time; no cloud AI service, paid GPU or Work credits are used.

## 3D character pipeline

- Custom anatomical loft geometry, sculpted faces, individual eyes, nose and lips, tailored armor, boots, gloves, hair and rear detailing.
- 16 PBR material types, 3 procedurally baked tangent-space normal maps, glTF `KHR_materials_clearcoat` on select armor surfaces, and emissive effects.
- A named joint hierarchy (head, shoulders/elbows/hands, hips/knees/shins/feet) maps to the existing RIFT CHAMPIONS attack poses.
- Materials and detailing are batched by joint, reducing draw calls on mobile.
- GLB files `models/kael.glb` and `models/vex.glb` are generated in the deploy workflow and accessible as direct model links on GitHub Pages.
- If assets cannot load, existing original characters remain in play; the 2D fighting rules, HUD and input engine are not changed.

This is **procedural articulated geometry**, not 4K hand-sculpted photogrammetry, blendshapes or motion capture. Real on-device visual approval is still required.

## Verify

```
node --check build-models.mjs
node build-models.mjs
node --test tests/*.test.mjs
```

The live demo is `/DuoForge-Preview/games/rift-champions/`. The public GLB assets will be at `/DuoForge-Preview/games/rift-champions/models/kael.glb` and `vex.glb` after successful Pages deployment. Don't deploy to Sites or edit existing private project IDs.
