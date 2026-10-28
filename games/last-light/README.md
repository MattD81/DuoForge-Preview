# LAST LIGHT — DuoForge interactive 3D cinema showcase

A playable, original storm rescue experience under `/games/last-light/` on **existing** DuoForge GitHub Pages. No new platform, server, model API, work credits or private content.

## V2 – more detailed scenery, same original game

- Eight genuinely **triangulated coastal heightfields** with stratified granite, wet shoreline and moss vertex colors, replacing the prior faceted sphere-shaped islands. Landscape is procedural with deterministic saved seeds, not satellite topography or photogrammetry.
- **Instanced wind-shaped pine forests and rocks**, scalable mobile/film rendering budgets to preserve responsiveness. The fishing harbor now has actual wood piers, posts, lit four-sided houses and warm framed windows.
- Stone lighthouses now follow terrain height and include doors, several sets of windows, balcony railing and synced rotating light beams.
- Original 7-band spectral ocean is retained. A **subtle dynamic wake** now follows the Aurora stern without large random white foam specks. Low-power sky shader on mobile; detailed multi-octave cloud sky in film mode.
- Use the in-game **GRAFIK: FILM / MOBIL** selector; it reloads the scene and starts a new mission. On software GPUs the engine can force the low-power renderer.
- The renderer is still WebGL, not an actual WebGPU/path-traced photorealism solution. No external assets/APIs, no Work.

## What is real

- Uses **the actual existing ocean-water.mjs shader**: seven-direction spectral waves, CPU matched height/slope, PBR water reflections, whitecap controls and weather.
- Uses the existing **atmosphere-scattering.mjs** solar model (analytic Rayleigh/Mie-inspired phase functions). Sky, water and the 3D sun use the same direction. This is not full volumetric atmosphere or ray tracing.
- Original procedurally built Aurora rescue ship with smooth watertight loft hull, four-sided textured superstructure, stanchions/lifelines, life rafts, signal mast, lighthouse/searchlight effects, rotating radar and propellers. GLB export from the scene is provided.
- Four unique real-time missions, speed-based rescue trigger, deterministic navigation/autopilot, real steering and damping, ship wave-following. Camera: chase/deck/film. Touch controls and WebAudio-generated optional ambience.
- Device DPR adaptation; low geometry preset automatically selected for mobile. **WebGL** is active rendering backend, not WebGPU.

## Run

Open `/DuoForge-Preview/games/last-light/` on GitHub Pages, or serve this repository with `python3 -m http.server 8080` and open `http://localhost:8080/games/last-light/`. Static file:// won't work due to ES modules and CDN CORS.

Steer A/D or ◀/▶, throttle W or GAS, brake S or BROMS. P toggles autopilot; C cycles camera; M toggles sound. Reach each orange SOS ring slower than 11 m/s within 12 m. Four rescues before the storm timer wins.

## Verification

```bash
node --test games/last-light/gameplay.test.mjs games/last-light/coastal-terrain.test.mjs
node --check games/last-light/main.mjs
# Independent GitHub Actions last-light-tests.yml runs Playwright desktop/iPhone smoke and real GLB export.
```

Constraints: The procedural vessel is original geometry, **not** scan/reconstruction of a private ship GLB; wave water is spectral rather than full Navier–Stokes fluid dynamics. The published Github Pages demo remains distinct from the primary DuoForge Sites project library until the Sites bridge can import it. Some audio and quality effects depend on hardware/browser.
