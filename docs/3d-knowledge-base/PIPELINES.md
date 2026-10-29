# Beslutsträd: vägen till snygg GLB

**Arbetsprincip:** välj rätt källa, inte en universalmetod. Generering kan vara snabb medan kontroll och justering tar tid.

| Input | Snabbt första utkast | Bästa kvalitet | Dolda ytor? | Rigg automatiskt? |
|---|---|---|---|---|
| Text, utifrån känd kategori | Parametrisk mall + procedurmesh | Originalskulptur / text-till-bild + multi-view + rekonstruktion | Mallens baksida modelleras | Bara kända riggmallar |
| En referensbild | TripoSR (lokal service) eller liknande frivillig modell | TRELLIS.2 med kompatibel GPU, därefter manuell cleanup | AI gissar | Vanligen **nej** |
| Framsida/sida/baksida i flera bilder | Multi-view conditioning / manuell modellering | Multi-view rekonstruktion + texture baking | Mer visuell evidens | Vanligen **nej** |
| 30–100+ överlappande foton av föremål | COLMAP + MVS / Meshroom | Fotoskanning + manual cleanup | Ja, om täckningen finns | Nej |
| Organisk varelse för närstrid | Skulptera volymer, sedan retopo | Högpoly-skulpt → quad-retopo → normal bake → rig | Ja | Kräver riktad rigg |
| Arkitektur, fordon, hård yta | Procedur, Boolean/CAD/hard surface | Bevels, weighted normals, UV trim sheets, material-ID | Ja | Styva pivoter/bones |
| Lång böjlig kropp (orm, tentakel) | Sweep längs spline | Loops längs kroppen + spline/IK-rigg + anisotropa detaljer | Ja | Egen kedjerigg |
| Ansikte/händer | Blockout + riggmall | Anatomisk skulpt, deformationstester, expressions/morphs | Ja | Delvis, kräver finjustering |

## Produktionssteg som måste bevaras

1. **Brief och rättigheter:** vad ska modellen föreställa, referensens licens, användning och målhårdvara.
2. **Siluett:** fem kameror: fram, bak, vänster, höger, 45°. Visa form före färg. Skilj meshen från projicerat foto.
3. **Högpoly:** bygg former och skulptera sekundära/tertiära detaljer (bark, muskelfibrer, stenporer, fjäll).
4. **Spelmesh:** ny låg-/mellanpoly-topologi med loopar runt axlar, armbågar, höfter, knän, käke och böjlig hals. Auto-remesh är inte likvärdigt med bra animationstopologi.
5. **UV/texture sets:** undvik kraftiga UV-stretch, lägg seams på mindre synliga områden, stabil texeldensitet.
6. **Baka normal/AO/curvature:** högpoly → lågpoly (cage, tangent-space normal); kontrollerat PBR-färgflöde.
7. **Material:** baseColor, metallic, roughness, normal, AO, emissive; använd transmission/clearcoat/sheen endast efter runtimekontroll.
8. **Rigg:** automatiska benmallar för igenkända varelser; manuella viktfixar i veck/leder. Separera riggstruktur och animationsklipp.
9. **Animation:** idle, walk/slither, attack, hit, death; checka att fotkontakter inte glider och att skinning inte kollapsar.
10. **Tre profiler:** mobile, desktop, cinema. Bevara master högpoly separat. Använd LOD och GPU-vänlig texturkompression efter featurekontroll.
11. **Export:** glTF 2.0 binary GLB, Y-up, rätt skala/rotation, kontrollera i *separat* importmiljö.
12. **QA:** Khronos Validator + egna visuella/riggtester; automatiska tester får inte ersätta mänsklig bildgranskning.

## Materialspecifika spelrecept

**Slottsgolem:** blockout i individuella stenar och valv → bevel + varied cracks → moss masks → huv, torn och portar i 360° → separata ben för stenarmar → idle/walk/strike.

**Muskeljätte:** proportioner i neutral pose → skulpterad muskelvolym och leder → ren retopo kring skuldror/armbågar/knän → hudnormal och roughness → correctives på krökta leder → basrörelser.

**Skogsväktare:** sammanhängande torso + rötter → bark i verklig geometri där siluetten kräver → material med trim/grönska → grenarna följer egna små rigs → kontrollera att tunna grenar inte penetrerar kroppen.

**Ormvarelse:** spline som central axel → ringar med jämn tvärsnittsdeformation → bendy chain och viktad skinning → fjäll mest i normal/color maps, större fjäll/horn i mesh → slither + strike.

## Felsökning

- Ser modellen ut som ett täcke över kroppen? **Fotoprojektion** ersätter inte korrekt 360° geometri/UV; rekonstruera baksidan.
- Ser modellen rund/plastig ut? För mycket sphere primitives + enhetlig roughness; arbeta med secondary forms, normal maps och silhouette.
- Ser den vulgär eller anatomiskt fel ut? Ta fram neutral referens, proportioner från flera vinklar, fixera silhouette i grå clay-shading före hudmaterial.
- Rör sig benet men kroppen klipper? Kontrollera vertex bone weights, bind pose, inverseBindMatrices, mesh skinIndex och joints.
- Rendern är svart? Kontrollera texturer/missing extension/lights/normal direction/material shader.
- Mobil hackar? Mät faktisk GPU frametime, draw calls, triangles, texture memory och antalet skinned vertices, *inte bara GLB-storlek*.
