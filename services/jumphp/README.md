# DuoForge + JumPHP/WebAssembly — Adapter V1

Detta är en **frivillig 2D-motoradapter** för **DuoForge-Preview**. Den lägger inte till en PHP-tolk i DuoForge Sites och ersätter inte existerande JS/WebGL/3D-motorer.

## Skapa och bygg med JumPHP

JumPHP är en extern öppen källkodsmotor (MIT) för PHP-spel. Installera och bygg enligt [JumPHPs officiella instruktioner](https://jumphp.net/engine) och [lokal byggdokumentation](https://jumphp.net/docs/en-local). Typiskt arbetsflöde:

```sh
composer create-project jumphp/jumphp my-games
cd my-games
bin/jumphp new mitt-spel "Mitt spel"
bin/jumphp install mitt-spel
bin/jumphp run mitt-spel
bin/jumphp build mitt-spel
```

Kommandona ovan använder JumPHPs egen verktygskedja, med Docker. Kör dem i en separat byggmiljö eller CI — **inte** i GitHub Pages eller i webbläsaren. Verifiera vilken katalog motorn producerade; den måste innehålla fungerande `index.html`, lokal `.wasm`-runtime och samtliga spelresurser. Hela den katalogen publiceras, inte bara manifestet.

Från DuoForge-Preview-repots rot:

```sh
node services/jumphp/pack.mjs /path/to/compiled-web-folder mitt-spel "Mitt spel"
```

Kommandot **skapar endast manifestet** och kontrollerar att `index.html` och minst en `.wasm` finns. Det bevisar inte att WebAssembly-builden fungerar i en webbläsare, och kör inte PHP eller tester. Om din JumPHP-build använder delad fjärr-runtime måste den först göras självständig eller packaren anpassas.

## Publicering och speltest

1. Publicera **hela den färdigbyggda spelmappen** på en HTTPS-server med korrekt MIME-typ `application/wasm`, exempelvis en separat GitHub Pages-origin.
2. Se till att `https://game-host.example/spel/duoforge-game.json` är publikt läsbar. Andra origins måste tillåta CORS för manifestet.
3. Öppna `game-builder/jumphp/` i DuoForge-Preview och klistra in manifestadressen. Manifestschemat finns i `duoforge-game.schema.json`.
4. Spela direkt i den inbäddade rutan när värdens CSP/`X-Frame-Options` tillåter detta. Annars väljer du länken för separat flik.

**Säkerhet:** WebAssembly är inte automatiskt säker kod. Kör spel på en separat origin från inloggning, databaser och hemligheter. Adaptern bäddar bara in externa origins, ger inte åtkomst till DuoForges interna konton och skickar inga tokens. PHP-källkod går inte att importera utan föregående byggsteg.

**Mobil / gamepad:** JumPHP styr sina kontroller. Adaptern ger möjlighet till fullscreen och gamepad i iframe men emulerar inte fysiska knappar eller DuoForge-QR-kontroller. Sådan styrbrygga, verklig Sites-integration, WASM-build i CI och verifiering på mobil återstår.

**Licenser:** Välj egna spelfigurer och grafik. Sonic-namnet, figuren och spelgrafiken är inte fria bara för att en fan-remake kan spelas online.

## API-kontrakt

Ett giltigt manifest bredvid spel-exporten:

```json
{
  "schemaVersion": 1,
  "engine": "jumphp-wasm",
  "id": "mitt-spel",
  "title": "Mitt spel",
  "entry": "./index.html",
  "width": 960,
  "height": 540,
  "controls": ["keyboard", "touch", "gamepad"]
}
```

Adaptern verifierar basfält och same-directory entry-sökväg. Detta är ett återanvändbart transportkontrakt för framtida integration till den **befintliga** DuoForge Sites Game Player, inte ett löfte om att Sites redan stöder importerade WASM-spel.
