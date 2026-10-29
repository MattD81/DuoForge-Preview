# DuoForge LookDev Studio – cinematisk 3D-visning

**Status:** opt-in i befintliga GitHub Preview 3D Studio, utvecklingsbranch.
Ingen ny plattform, inga externa modeller, inga betalda API:er, ingen Work,
inga ändringar av Sites-produktionen.

## Vad användaren får
- **Graphite Studio:** neutral mörk produktfotografering med kantljus.
- **Soft Daylight:** jämnt dagsljus för korrekt materialgranskning.
- **Golden Hour:** varm filmisk scen med sval fyllnadsbelysning.
- **Neon Noir:** kontrollerad cyan/magenta ljussättning för spelobjekt.
- **Miljöreflektioner:** lokalt genererad Three.js RoomEnvironment/PMREM (om stödd).
- **Kontrast och exponeringskontroll:** justera ljus utan att ändra material.
- **Adaptiva skugggränser:** tajtare directional shadow camera runt 3D-objekt,
  vilket ger bättre texeldensitet än tidigare fasta ±25 meter för små objekt.
- **Hjälprutnät:** kan visas vid behov; dolt för rena presentationer.
- **Normal vy:** återställer exakt editorbelysning, tidigare bakgrund, grid,
  skugggränser, miljöreflektioner och exponering.

## Hur man använder
Öppna `/workshop/studio/`, bläddra till **LookDev Studio** i den högra
sidopanelen, välj en av fyra profiler och tryck **Aktivera LookDev**.
Använd **Anpassa skuggor** efter större förändringar i objektplacering.
**Normal vy** återställer den ordinarie 3D-redigeraren.

LookDev är ett frivilligt *visningslager*: belysning och hjälpljus ligger i
scenen utanför projektets `root`. Exporterad GLB/JSON och ångra-historiken
påverkas inte. Detta är inte ett materialgenererings- eller AI-modelleringsverktyg.

Vid aktiv Render World/Fusion eller V5-rendering skjuts kontrolländringar upp
tills Studio-vyn är tillbaka, så att andra pipeline-lägen kan återställa sina
egna scensnapshots utan konflikter.

## Teknik & avgränsningar
Three.js r180, WebGL2, PMREMGenerator och befintlig ACES/sRGB-pipeline.
Profiler styr riktade ljus, skuggbounds, skylight, färgexponering och
bakgrund; de rör inte mesh- eller glTF-material. PMREM bygger på en
syntetisk studio och **är inte** ett verkligt högupplöst HDR-foto.
Inga area-light softboxes, äkta path tracing, SSAO/SSR eller DLSS utlovas.
Vill man ha dem krävs separat kompatibilitetsarbete och verkliga GPU-mätningar.

## Test
- `node --test tests/lookdev-presets.test.mjs`
- `node --test tests/gpu-deluxe-v5.test.mjs`
- `node tests/gpu-deluxe-v5-smoke.mjs` (desktop/mobil Chromium via Actions)
- Gamla V2-, V5- och övriga Studio-tester körs i GitHub Actions.

## Nästa visuella steg
1. Texturgranskning med sRGB/normal/roughness, miljöspegel av HDRI från
   lokalt godkända CC0-tillgångar samt UV/texel-budgetrapport.
2. Kamera och bildkomposition: 35/50/85mm-presets, DOF, framing och
   automatisk turntable-export i Film Studio.
3. Professionell effektstack via opt-in WebGL postprocessing och framtida
   WebGPU/TSL efter compatibility och GPU-performance-mätningar.
4. Delad LookDev-konfiguration mellan 3D-verkstad, Film Studio och spelmotor
   via versionssatt format. Finns inte i Sites i denna PR.
