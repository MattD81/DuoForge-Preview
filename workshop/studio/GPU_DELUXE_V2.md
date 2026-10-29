# DuoForge GPU Deluxe V2 – adaptiv grafik, GPU-tid och ray tracing-prototyp

**Plats:** befintliga DuoForge GitHub Preview, särskilt [3D Studio](../../workshop/studio/). Utvecklar inte en separat plattform. Detta är **inte** en ändring av den autentiserade ChatGPT Sites-produktionen.

## Vad som faktiskt fungerar i V2

### 1. Riktig GPU-tidsmätning (WebGL2)
- `createGpuTimer(renderer)` använder **`EXT_disjoint_timer_query_webgl2`** när webbläsaren och enheten exponerar tillägget.
- Asynkrona tidsfrågor runt faktiska render-pass mäter GPU-tid i millisekunder. Ingen `gl.finish()`, synkron blockering eller CPU-tid felmärkt som GPU-tid.
- Frågor läses bara när `QUERY_RESULT_AVAILABLE` är sant. Skydd mot kapslade queries, överfull kö, GPU-disjoint, saknat stöd och context loss.
- I Studio visas GPU-tid i V2-panelen. Stormblade visar GPU-tid i prestandastatusen. Intelligent Game Builder samlar in riktiga GPU-mätningar i renderloopen.
- Saknas extension visas **"GPU-timer stöds inte"**; inga påhittade siffror.

### 2. Temporal uppskalning – **inte DLSS/AI ännu**
- Valbart i befintliga 3D-studion: **⚡ GPU Deluxe V2 → Temporal uppskalning**.
- Scenen renderas med en lägre intern upplösning (utifrån mobil-/datorbudget), rekonstrueras till displayupplösning och blandas med **historik när kameran står stilla**.
- Shadern klipper historiska färger mot närliggande aktuella pixelvärden, för att minska eftersläpning/ghosting. Vid kamerarörelse sätts historikvikten till noll.
- **Ingen neural modell**, inga rörelsevektorer, ingen djupbaserad disocclusion, ingen kopia av NVIDIA DLSS/AMD FSR/Intel XeSS. Vid snabba rörelser kan temporal kvalitet vara sämre än framtida motion-vector-baserad rekonstruktion.
- Den ursprungliga GPU Deluxe V1-upplösningsregulatorn och dess egna grafiklägen påverkas inte.

### 3. Egen analytisk ray tracing-prototyp
- Valbart i samma Studio-panel: **✦ Ray tracing (prototyp)**.
- WebGL-fragmentskuggning beräknar **primära ray–sphere-intersektioner**, närmaste träff, **sekundära skuggstrålar**, diffust ljus och **en reflekterad studs**, samt ett matematiskt golv.
- Hämtar upp till **12 bounding spheres** från faktiska synliga meshdelar i ditt nuvarande 3D-projekt, med respektive materials färg och metalliskhet. Detta är en **proxyvisualisering** som bara approximativt motsvarar GLB-objektens riktiga former.
- **Inte en generell, produktionsklar ray tracer av trianglar eller path tracer.** Inte heller en ersättning för hårdvaruaccelererad RTX/DXR. Mobilrenderingen körs med begränsat pixelantal.
- Alla effekter är opt-in. Normal 3D-editorn är standard; vid aktiverad Render World / Film Studio återgår renderingen till den befintliga pipelinen. **Sparade scener, GLB-export och projekt lagras oförändrat**.

## Testning och gränser
- `node --test tests/gpu-deluxe-v2.test.mjs` testar query-livscykel, disjoint, köbegränsning, shaderkontrakt och integrationspunkter.
- `node tests/gpu-deluxe-v2-smoke.mjs` testar temporal-, raytrace- och off-knapparna i Chromium på dator och emulerad mobil efter att server/Playwright startat enligt `.github/workflows/studio-tests.yml`.
- GitHub Actions ska verifieras före merge. En godkänd Chromium-emulering är inte ett bevis på god prestanda i riktig iPhone/Safari.
- På enheter utan WebGL-stöd ska den gamla editorn användas som tidigare. Ray trace-proxy och uppskalning måste testas på riktig hårdvara innan bred aktivering.

## Nästa steg mot de tre stora målen
1. **Neural AI-uppskalning:** en fritt licensierad och tränad modell med dokumenterad licens, opt-in WebGPU/WASM-inferens, motion vectors, depth, temporala historikbuffertar och profilerad strömförbrukning. Detta ingår **inte** i V2.
2. **Bättre GPU-statistik:** tidsmätning per render-pass och individuell adaptiv budget. GPU-timer är redan riktig där tillägget finns.
3. **Riktig modellraytracing:** BVH för verklig GLB-triangelgeometri, materialtexturer, flera ljus, stabil ackumulering och hårdvaruaccelererad WebGPU-fallback. V2:s analytiska prototyp är en begränsad utgångspunkt, inte färdig BVH.

## Kostnad, säkerhet och produktionsgräns
Allt kör lokalt i webbläsaren med befintlig GPU/Three.js. Ingen Work, extern AI-nyckel, betald modell eller moln-GPU. GitHub Pages är bara Preview: för att integrera Studio V2 i riktiga ChatGPT Sites krävs fortfarande åtkomst till och testning av Sites-koden.
