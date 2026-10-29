---
applyTo: "workshop/studio/**,docs/3d-knowledge-base/**,services/image-to-3d/**"
---
# DuoForge 3D modeling development rules

For GLB, image-to-3D, retopology, UV, PBR, rigging, materials, or animation changes:
- Consult `docs/3d-knowledge-base/README.md` and `AGENT_PLAYBOOK.md`, then the relevant sections of `PIPELINES.md`, `AI_MODELS.md`, `MESH_MATERIAL_RIG.md`, and `QUALITY_GATES.md`.
- Treat `knowledge.json` as **research catalog only**, not installed model capabilities.
- Never present a single-image silhouette extrusion as full 360° reconstruction.
- Protect existing 3D Studio and the separate live Sites platform; do not create duplicates or incur paid services.
- Hunyuan3D-2.1 published license excludes the EU: block it in Sweden unless separate licensed rights are documented.
- New or edited GLBs need full technical GLB validator and actual motion/visual/device checks.
- Do not claim a PR is published or deployed before CI + merge + site delivery are verified.
