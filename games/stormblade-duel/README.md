# STORMBLADE — The Last Longship

**Spelbar 3D-demo för DuoForge GPU Deluxe**, byggd i befintliga publika GitHub Pages-preview (inte en ny spelplattform).

## Spela
Öppna `/games/stormblade-duel/` via GitHub Pages efter granskning/merge.
Tryck **Starta duellen**. Besegra Skadi med Ragnar inom 90 sekunder.

- WASD / pilar: gå på däcket.
- J: vanligt svärdhugg.
- K: kraftfullt hugg.
- Mellanslag: blockera.
- Shift: undvik.
- Mobil: onscreen-pilar, block, undvik, kraft och hugg.

## Byggt
- 3D-vikingaskepp från skräddarsydd båtskrovsgeometri, däckplankor, räcken, sköldar, rigg, tygsegel, tunnor och facklor.
- Två fullständigt volumetriska 3D-krigare med rustningar, hjälmar, ansikten, sköldar, svärd/yxa, mantlar, enkla ledanimationer.
- WebGL-shader för oceanvågor, analytiska yt-normaler och månsken; horisont, dimma, åskblixtar, 600 regnstråk och strids-partiklar.
- Spelbar AI-duell med hälsa, träffavstånd, två attacker, cooldown, block, undanmanöver, 90s nedräkning, start- och slutskärm.
- GPU Deluxe-integration via den befintliga `../../workshop/studio/gpu-deluxe.mjs` för adaptiv bildupplösning och optional spatial skärpepass. **NVIDIA/AMD/Intel levererar datorns faktiska GPU**; DuoForge är en webbläsar-renderingsmotor, inte virtuell GPU eller proprietär DLSS/FSR/XeSS.
- Inga betalda tjänster/Work. Three.js 0.180 från CDN kräver internet, och spelet ska köras via HTTPS/static server.

## Vad som INTE ingår ännu
Filmklipp/GLB-export, avancerad motion capture, fotorealistiska PBR-skinn, ray-traced GI och nätverksspel. Detta är en faktisk spelbar prototyp, men inte AAA-kvalitet.

## Kvalitetssäkring
`node --check games/stormblade-duel/{game,world}.mjs`, `node tests/stormblade-duel-smoke.mjs` med statisk server och Playwright. Testa särskilt Safari/iPhone och faktiska GPU:er före produktionsanvändning. Spelet publiceras inte automatiskt till ChatGPT Sites.

## Phase 2: faktisk delning av befintlig teknik

- **Ocean Cinema V5 från riktiga 3D Studio:** spelet importerar nu `createOceanSurface` från `workshop/studio/ocean-water.mjs`. Samma sju vågkomponenter, GGX/reflexionsshader, atmosfärsberäkning och diskret sjöskum används i både havsstudio och Stormblade. Skeppet får sin höjd och lutning från samma havsfunktioners CPU-referens i stället för en separat vågloop.
- **Character Forge V3 från Rift Champions:** en ny frivillig `V3-riggar`-knapp provar att läsa två riktiga publicerade GLB-modeller från det befintliga modellbiblioteket (`workshop/models/rift-kael-skinned-v3.glb` och `rift-vex-skinned-v3.glb`). Den återanvänder verifierings-/glTF-assetloader, AnimationMixer, skelettklipp och ansiktsmorpher från Rift Champions. Detta är *Kael/Vex*-modeller, inte nygjorda Ragnar/Skadi-modeller. Därför sker bytet bara på uttrycklig begäran.
- **Robust fallback:** om GLB saknas eller är inkompatibla fortsätter det spelbara stridssystemet med originalkrigarna. Ingen remote AI eller servergenerering startar.
- **Mobil och GPU:** ursprunglig GPU Deluxe, touchknappar och GPU-profilstyrning är kvar; V3-modeller laddas bara när användaren väljer dem.

### Ännu INTE integrerat i Stormblade

WebGPU/WGSL-compute, tränad neural upscaling, ReSTIR/path tracing, 3D Gaussian Splatting, Cinema-filmexport, fullständig filmregi och ett live prompt-till-spel-arbetsflöde i produktions-Sites. De finns antingen som separata prototyper, är delvis implementerade i andra verktyg eller är planerade. Använd dem inte som bevis för att allt redan är kopplat.

### V2-regression

`node tests/stormblade-duel-smoke.mjs` ska visa spelets Ocean Cinema v5-status och att Character Forge-knappen är tillgänglig. Testa i publicerad Pages-miljö för att säkerställa att de faktiska GLB-filerna går att ladda: lokala GitHub CI-kloner innehåller inte de bygggenererade 11–20 MB V3-modellerna.

## V3 – DuoForge Play Director & Studio-filmlook

- **Play Director V1:** återanvändbar, framerate-oberoende kameraregi som följer båda krigarna, arbetar i mobil/porträtt och widescreen, bevarar geografiska spelgränser och lägger till kort, dämpad kamerareaktion vid träff. Stridens faktiska positioner/HP påverkas inte.
- **Delad Studio-belysning:** `createCinematicLighting` från befintliga `workshop/studio/cinematic-lighting.mjs` är nu inkopplad. Knappen `Film av/Film noir/Naturligt/Gyllene` byter ljusregi, bevarar materialkartor och kan aktivera PCF-skuggor på större skärmar eller explicita kvalitetsläget.
- **Opt-in för renderingstunga effekter:** Filmlook är avstängd från början, och GPU Deluxe Auto fungerar utan dess extra skuggpass. Inget påstående om path tracing, Dolby Vision, DLSS eller neural uppskalning.
- **Verifiering:** `node --test tests/stormblade-play-director.test.mjs` kontrollerar mobilkomposition, kamera, bounds och dämpning; browser smoke kontrollerar hela filmlook-cykeln.
- **Drift:** publiceras enbart i GitHub Pages Preview efter grön CI, inte i den separata Sites-kodbasen.

### Nästa utvecklingsbehov
Riktiga skulpterade och vikingspecifika skinnade GLB-karaktärer med specialskrivna animationer, hår/tyg-fysik, shadow-quality device profiler, bättre animation timing och filmrendering med inspelningsbart output. Ingen av dessa är verifierad som färdig i V3.
