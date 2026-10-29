# DuoForge GPU Deluxe V5 – CINEMA V5

**Status:** två opt-in-lägen (full detalj PBR och experimentell ray tracing) i befintliga GitHub Preview 3D Studio. **Ingen ändring i ChatGPT Sites-produktionen**, ingen Work, inga API-nycklar, ingen betald GPU. Behåller GPU Deluxe V2 och ordinarie redigering.

## V5 Detail PBR (nytt i hybriduppdateringen)

Välj **V5 Detail PBR** i samma Studio-panel. Detta är ett **full-geometriskt rasterläge**
som använder Three.js befintliga WebGL-renderer, den riktiga scenens alla trianglar,
GLB-texturer och skelettanimationer. En procedurgenererad RoomEnvironment-miljö
ger PBR-metaller och roughness-material lokala reflexioner via PMREM där det stöds.
Inga modellfiler eller scener ändras eller laddas upp.

Balanced, Cinematic och Extreme styr **device pixel ratio** (max 1, 1,5, 2 för
dator; max 1, 1,25, 1,5 för mobil). Vid faktisk GPU-tid över 40 ms över flera
mätningar sänks DPR adaptivt (som lägst 60 % av profilens DPR) utan att ta bort
någon geometri. Vid stabil GPU-tid under 16 ms kan DPR återhämta sig.
Om GPU-tid inte går att mäta används profilens fastställda pixelgränser.
Originalmiljö och renderingsexponering återställs när V5 stängs av.

**Detail PBR är inte ray tracing eller neural AI-uppskalning.** Det är högfidelitets-
rendering av hela scenen. **V5 Ray Cinema** är kvar som separat experimentell
raytracing, med tidigare dokumenterade BVH/triangel- och texturbegränsningar.

## Vad som faktiskt är nytt

1. **Riktig triangelbaserad ray tracing i WebGL2**: scener i Studio packas till GPU-texturer med verkliga världskoordinater för triangelhörn. En egen median-splittad BVH reducerar antal intersektioner. GLSL ES 3.00 kör ray–triangle-tester (Möller–Trumbore), BVH AABB-tester, skuggstråle, grov ambient occlusion och en sekundär reflekterad stråle per pixel. Detta är *inte* hårdvaruaccelererad RTX/DXR.
2. **Progressiv multisampling/antialiasing**: pixelstrålar jitteras över bildrutor och blandas i separata ping-pong-render targets. Historiken rensas när kameran, projektgeometrin, profilen eller renderstorleken ändras. Ingen ghosting från gamla kameravinklar ska återanvändas.
3. **Bildförbättring**: lokal färgstyrd bilateral denoiser, tonmappning, lätt vignett och materialbaserad variation i roughness/metalness. Inte neuralt tränad brusreducering och inte fullständig PBR/texturmotor.
4. **Tre profiler**: Balanced, Cinematic, Extreme med strikt maxgräns för triangelurval (mobil 64/128/192; dator 192/384/768), rasterstorlek, och antal samples. Vid upprepade uppmätta GPU-tider över 45 ms skalas intern renderingsbudget automatiskt ner. Om enheten inte stöder GPU-timer används fasta profilgränser.
5. **Verklig GPU-tid**: återanvänder V2:s WebGL2 timestamp extension `EXT_disjoint_timer_query_webgl2` och visar GPU-ms i V5-panelen där tillgänglig.
6. **PNG-export** av den renderade V5-vyn via befintlig canvasyta. Alla GLB-modeller, scener och tidigare versioner är oförändrade.

## Så testar du

Öppna `/DuoForge-Preview/workshop/studio/`, leta upp **GPU Deluxe V5**, välj grafikprofil och tryck **V5 Ray Cinema**. Håll kameran stilla för att samla bildprov. För många objekt eller i mobil kan rendering bli långsam; gå tillbaka till **Normal vy**. V2:s knappar finns kvar.

## Viktiga begränsningar

- Systemet använder bara ett **utvalt begränsat urval verkliga trianglar** från scenen. Triangelkapasitet beror på profil. Mycket detaljerade importerade GLB-modeller reduceras genom sampling. Visa alltid `urval/total` i status.
- Skinnade/skelettanimerade mesh-mallar representeras av deras nuvarande statiska vertexbuffer och transform, **inte deformerade poser**. Procedurmaterial och texturbilder används inte i raytracern: geometrins grundmaterialfärg, roughness och metalness används.
- Enbart **förhandsvisning med en sekundär reflektionsstråle**, inte path tracing med många studsar eller fysiskt korrekt ljustransport.
- **Ingen neural AI-uppskalning som DLSS.** V2:s temporala rekonstruktion finns kvar separat; V5 fokuserar på verkliga trianglar, högre bildstabilitet och detalj i opt-in Cinema.
- WebGL2 krävs. V2 och normal rendering är fallback. Ingen installationskoppling till den riktiga Sites-källkoden ingår.

## Tester

- `node --test tests/gpu-deluxe-v5.test.mjs` validerar bounding, accelerationsträdets topologi, texturformat, skugg-/reflektionsshader och versionskompatibilitet.
- `node tests/gpu-deluxe-v5-smoke.mjs` provar faktiskt WebGL2-shaderprogram i Chromium i desktop och mobilstorlek, sedan fallback till V2.
- GitHub Actions `Test GPU Deluxe V5` ska passera före merge. Den längre 3D-studio-testsviten körs också på ändringen.

För att nå realistisk Cinema V6+ behövs full mesh/texture-aware materialpipeline, dynamisk BVH, GPU-profiler på verklig mobil, adaptiv spatial/temporal reprojection med motion vectors och (för neural uppskalning) licensierade tränade modeller och en exekveringsväg. Dessa saknas i V5.
