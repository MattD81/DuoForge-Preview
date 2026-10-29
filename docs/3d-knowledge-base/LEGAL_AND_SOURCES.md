# Källregister och licenskontroll — kontrollerat 2026-10-29

> Materialet är sammanfattad teknisk information, inte importerade modellvikter eller kopierad tredjepartskod. Referenser används för granskning, inte automatisk installeringsrätt. Licenser måste kontrolleras igen innan distribution.

| Primär källa | Vad vi använder | Licens/tillgänglighet att kontrollera |
| --- | --- | --- |
| https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | GLB/glTF, PBR, skin, animation, normal, färgrymd | Standard |
| https://www.khronos.org/gltf/pbr | Material/normal/roughness | Teknisk referens |
| https://github.com/KhronosGroup/glTF-Validator | Formaliserad validering | Kontrollera tillbehör/runtime |
| https://github.com/KhronosGroup/glTF-Sample-Assets | Testfall och referensmeshar | **Per asset** – blandade CC0/CC-BY/andra licenser |
| https://docs.blender.org/manual/en/latest/ | Sculpt, retopo, UV, bake, Rigify, export | Dokumentation; Blender/GPL som program |
| https://docs.blender.org/manual/en/latest/animation/armatures/skinning/introduction.html | Skillnad parent/bone och riktig deformation | Documentation |
| https://docs.blender.org/manual/en/latest/addons/rigify/index.html | Rigify, riggmallar | GPL för addon |
| https://gltf-transform.dev/ | Draco/Meshopt/KTX2/WebP och processning | MIT huvudverktyg; enskilda codecs kan skilja sig |
| https://github.com/microsoft/TRELLIS.2 | High-fidelity image→3D PBR med GPU | MIT **modell/kod**, nvdiffrast/nvdiffrec separata |
| https://microsoft.github.io/TRELLIS.2/ | Kvalitets-/hastighetsuppgifter | Tests på NVIDIA H100, inte en iPhone |
| https://github.com/microsoft/TRELLIS | Äldre image-to-3D pipeline | MIT huvudrepo; moduler separat |
| https://huggingface.co/stabilityai/TripoSR | Snabb single-image 3D | MIT modellkort och källkod |
| https://github.com/VAST-AI-Research/TripoSR | Kod till TripoSR | MIT repo, kontrollera weights |
| https://huggingface.co/TencentARC/InstantMesh | Bild→multi-view→mesh | Modellkort Apache-2.0, verifiera repo |
| https://github.com/facebookresearch/sam-3d-objects | SAM 3D Objects | SAM License, inte MIT; kräver granskning |
| https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE | Hunyuan3D 2.1 licens | **BLOCKERAS inom EU** enligt geografisk exkludering |
| https://github.com/colmap/colmap | SfM / MVS / mesh från foton | BSD (beroenden separat) |
| https://github.com/alicevision/Meshroom | Fotogrammetri + graf | MPL-2.0, separata noder/beroenden |
| https://github.com/isl-org/Open3D | Point cloud, meshing, retopo-stöd | MIT |
| https://github.com/facebookresearch/pytorch3d | Differentiable rendering/mesh | BSD |
| https://github.com/google/filament/blob/main/docs/Materials.md.html | Fysikaliska material/IBL | Dokumentation |
 
## SÄRSKILT: Hunyuan 3D 2.1 i Sverige/EU

Licensen säger ordagrant att dess territorium utesluter Europeiska unionen, Storbritannien och Sydkorea. Eftersom DuoForge utvecklas i Sverige ska **ingen kod/vikter från denna licens kopplas in eller distribueras i DuoForge** utan separat dokumenterad, giltig licenslösning. Att projektet är publikt på GitHub är *inte* ett undantag.

## Säkerhet och copyright

- Härma generella tekniker, **inte** skyddade figurers geometri/konstverk eller originalkällkod. Illustrationsbild med reklam är inte automatisk licens för återskapande.
- Spara tillverkningskedjans licenser/proveniens, respektera tredjepartsassets CC-BY credits och avregistrering av användargenererat innehåll.
- Många modeller har restriktioner för hosting och vissa för träning eller output som används för destillation. Bygg aldrig modellträning utan att kontrollera vikt- och datasetlicens.
- GDPR/personbilder: hantera känsliga bilder separat, kör helst lokalt och begär ett aktivt opt-in vid uppladdning.

## Källhygien

Vid större uppgradering: granska primärkällornas README/LICENSE på nytt, dokumentera datum och modellrevision, byt inte bas på tredjepartsbloggar. Registrera nya poster i `knowledge.json` med status/krav/begränsning; gamla råd är inte automatiskt korrekta.
