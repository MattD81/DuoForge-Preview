# DuoForge Coding Engine — 3D-KB arbetsinstruktion (för framtida integration)

Denna fil är ett **läsbart arbetskontrakt**, inte en dold systemprompt, inte modellträning och inte bevis för att live Sites-agenten kan läsa GitHub.

## När du får uppdraget "bygg en snygg GLB"

1. Läs `README.md`, `PIPELINES.md`, `MESH_MATERIAL_RIG.md`, `AI_MODELS.md` och `QUALITY_GATES.md`; använd `knowledge.json` som teknikregister. Läs bara relevanta kodfiler i Studio.
2. Identifiera input: `prompt | single_image | multiview | photo_set | existing_mesh`. Bestäm `game_asset | film_asset`, `mobile | desktop`, `static | animated`.
3. Välj **först** aktiv och licensgodkänd pipeline från de befintliga adaptrarna; fråga inte efter betald tjänst om ett lokalt alternativ finns.
4. Om användaren vill ha resultat "på nolltid": använd verkliga lokala templates/procedural engine och kalla dem mallar, inte fotorealistisk rekonstruktion. Tidskrävande AI/retopo/rigg får inte påstås klara utan faktisk körning.
5. Bevara modellens kompletta 360° geometri och kontrollera baksida; ingen bild draperad över primitivt plan.
6. Vid rörlig organisk mesh: skinning + anatomiska loopar + animations-test. Höga skulptdetaljer ska kunna bakas till normalkartor.
7. Exportera GLB med material, texturer, skins och animationer; verifiera efter reimport. Fäll hellre ut en **faktisk bristlista** än att kalla ofullständig GLB färdig.
8. Extern AI-inferens kräver explicit val, kontrollerad kostnad och lämplig licens. **Förbjud Hunyuan3D-2.1 i EU** med nuvarande publika licens.
9. Publik GitHub Pages kan inte exekvera lokal CUDA AI åt användaren. Skriv aldrig "installerat i Sites" utan Sites-diff och test.
10. För integration: inventera `workshop/studio/character-forge.mjs`, `image-to-3d-client.mjs`, `material-lab.mjs`, `studio.mjs`, `cinema-rig.mjs` och relevanta bryggor. Behåll projekt-ID, databas, UI och användarens inställningar.

## Prioriterad smart arkitektur (förslag, ännu inte installerat)

```
ReferenceInput + License/Consent + TargetBudget
  -> TechniqueSelector(knowledge.json, current capabilities)
  -> AssetJob.create(idempotencyKey, revision)
  -> PipelineAdapter(procedural | TripoSR | TRELLIS2 | COLMAP)
  -> MeshCleanup -> Retopo/UV/Bake -> RigAndClips
  -> GLTFExporter -> KhronosValidator -> DeviceProfileCheck
  -> Preview360/DeformationReview -> VersionedAssetLibrary
```

Även om en adapter är registrerad måste den rapportera `available`, `hardwareReady`, `licenseApproved` och `executionVerified` från verkliga kontroller. Ingen "fantom-AI" som låtsas köras.

## Mall för ärligt svar

- **Klart i repo:** namnge filer/commit/PR och testresultat.
- **Går att provköra:** ge publicerad URL bara om branch är mergad/publicerad.
- **Saknas:** berätta vilka adapters, GPU, retopo, textur eller rigg som är otillgängliga.
- **Nästa steg:** liten verifierbar ändring i befintliga filer; ingen Work utan användarens tillstånd.

## Utvärdera visuell kvalitet

Konsekvent referensfoto: fram, bak, sidor, 3/4, clay, neutral PBR, deformering. Även maskinella metrics (CLIP-sim, Chamfer, normal consistency) kan vilseleda och ska kompletteras med visuell granskning av baksida, anatomiska proportioner och mobilfidelitet.
