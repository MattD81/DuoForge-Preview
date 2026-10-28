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
