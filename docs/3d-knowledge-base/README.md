# DuoForge 3D Knowledge Engine — kunskapsbank

**Forskningsgranskning: 2026-10-29.** Version: `duoforge-3d-kb@1.0.0`. Ändamål: en **sökbar, källbelagd, versionshanterad och maskinläsbar** kunskapsbank för hur riktiga högkvalitativa, spelbara GLB-modeller skapas. Den bygger vidare på befintlig 3D Studio/Character Forge, inte en ny plattform. GitHub Pages-webbvy: `/docs/3d-knowledge-base/`. Data: `knowledge.json`. Ingen modellträning, GPU-server, betald API, Work eller automatisk publicering i Sites.

## Navigera

| Fil | Användning |
| --- | --- |
| [PIPELINES.md](PIPELINES.md) | Beslutsmodell: prompt, en bild, flera bilder, skanning, manuell/procedural sculpt |
| [MESH_MATERIAL_RIG.md](MESH_MATERIAL_RIG.md) | Mesh, retopologi, UV, PBR, normal bake, armature, weight paint, animation |
| [AI_MODELS.md](AI_MODELS.md) | Källkontrollerade moderna image-to-3D-modeller, GPU, kvalitet och begränsningar |
| [QUALITY_GATES.md](QUALITY_GATES.md) | Testbar pipeline, GLB, skinning, licenser, mobilprestanda, mätbara kvalitetsgrindar |
| [LEGAL_AND_SOURCES.md](LEGAL_AND_SOURCES.md) | Källor, uttryckliga licensundantag för EU och attributering |
| [AGENT_PLAYBOOK.md](AGENT_PLAYBOOK.md) | Så ska DuoForge Coding Engine / utvecklare använda kunskapen utan falska påståenden |
| [knowledge.json](knowledge.json) | Maskinläsbar katalog (id, användningsfall, krav, begränsning, källor) |

## Det viktiga: kvalitet är en pipeline, inte en filändelse

GLB/glTF 2.0 **kan** lagra mesh, material, texturer, skinning och animation. Men en perfekt skriven GLB kan ändå innehålla en ful modell. Kvalitet kommer från siluett, volym, anatomi, topologi, högfrekventa detaljer, UV-layout, texturer, skuggning, leder och test i spelmotorn.

Utgångsflöde: **referenser → blockout/rekonstruktion → skulptera → retopologi → UV → baka detaljer → PBR textur → rigg/weights → animera → LOD/komprimera → GLB → validera → mobil/desktop-test**.

## Lägesmarkering och ärlighet

- **Färdig lokalt:** sökbar kunskapsbank och beslutsregler; tips, källor och testlogik. Inte tränade modellvikter.
- **Finns i DuoForge Preview:** Three.js Studio, Character Forge, Material Lab, GLB-export och en valfri lokal TripoSR-adapter. Kontrollera faktisk revision innan kodändringar.
- **Ej utfört av denna kunskapsbank:** installation av TRELLIS.2/Hunyuan, moln- eller GPU-körning, 4K bakning, automatiserad AI-retopologi, full auto-rig från valfri bild, eller synk till live Sites.
- **Kritisk juridik:** Hunyuan3D-2.1:s licens utesluter EU. Använd inte den modellen för DuoForge i Sverige under den licensen. Andra vikter och beroenden har separata villkor.
- **Kritisk teknik:** en enda bild visar inte baksida eller dold geometri. Genererad baksida är en statistisk gissning tills den verifieras.

## Nästa tekniska åtgärder

1. Läs den befintliga Sites-versionen och relevanta Studio-moduler; jämför funktioner innan förändringar.
2. Introducera gemensamt `AssetJob`-schema: input type, rights, quality, budget, generation stage, GLB output, provenance.
3. Implementera adapter per tillgänglig runtime: `procedural/browser`, `local/triposr`, `multiview/colmap`, `gpu/trellis2` **endast om GPU finns och användaren optat in**.
4. Bygg asset QA som faktiskt läser GLB och verifierar geometri, UV, material, tex, rigg, klipp, filstorlek.
5. Jämför 360° mot referens på minst fem vinklar och välj omgenerera / manuell retusch.
6. Behåll extern modellkörning frivillig; den här katalogen skickar ingen bild någonstans.

Referenser och exakta länkar finns i [LEGAL_AND_SOURCES.md](LEGAL_AND_SOURCES.md).

## Sökbar webbvy

Efter merge och GitHub Pages-distribution: `https://mattd81.github.io/DuoForge-Preview/docs/3d-knowledge-base/`. Visar och filtrerar `knowledge.json`, och ger **lokala regelbaserade rekommendationer**. Ingen modellinferens sker och inga referensbilder skickas. Licensblockerade modeller är dolda som standard. En länk finns även i befintliga 3D Studio.
