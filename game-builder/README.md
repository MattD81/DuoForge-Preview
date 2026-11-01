# DuoForge Intelligent Game Builder V1

**Ursprunglig DuoForge-plattform är ChatGPT Sites.** Den här modulen är en separat, offentlig och gratis **GitHub Preview**-funktion i det befintliga repositoryt. Den skapar inte ett nytt konto, en ny plattform eller en hemlig kopia av Sites. Ingen Work körs.

## Vad som faktiskt fungerar

1. Ange en svensk spelidé eller förbättring i textfältet.
2. Regelbaserad promptplanner (`planner.mjs`) tolkar igenkännbara önskemål om **3D-action/arena**, hav/skog/stad/ruiner, väder, antal banor/fiender/kristaller (även "utan fiender" och "inga kristaller"), grafikläge, karaktärstyp och spelnamn.
3. En **riktig spelbar WebGL 3D-motor** (`runtime.mjs`) skapar en procedurvärld, fiende-AI, kamp, HP, samlarobjekt och portal som leder vidare till nästa bana. Spela med WASD/piltangenter, J/K/Space, mobilknappar eller en redan ansluten Bluetooth/USB-gamepad.
4. Samma projekt behåller **ID och övriga konfigurationer**, uppdateras inkrementellt, får historik och ångra. Projektet sparas i webbläsarens lokala lagring. Det är ingen server-synk.
5. Återanvänder **befintliga Ocean Cinema V5** (7-band WebGL) och **GPU Deluxe** för adaptiv upplösning från `workshop/studio/`.
6. Exportera en **riktig ZIP** med `project.json`, `index.html`, `package.json` med `three`, komplett runtime och de berörda Studio-motorernas källkod. ZIP-spelet har inte en länk som ersättning för kod. Server krävs för ES-moduler och Three CDN kräver internet.

Ingen AI-LLM ingår ännu i prompttolkningen; den är deterministisk och kör lokalt. V1 kan **inte** skapa valfri 3D-modell, fullt nya spelmekaniker, valfritt racing-spel, online-multiplayer, fotorealistisk rendering eller importera och skriva över ett befintligt Sites-projekt från webbläsaren. Unsupported-förfrågningar synliggörs i UI.

## Spela

**Preview:** `/DuoForge-Preview/game-builder/`

**För export:** Starta t.ex. `python3 -m http.server 8000` i ZIP-katalogen och öppna `http://localhost:8000/`. För att använda ett genererat spel i riktiga DuoForge behöver spelet laddas upp till GitHub och därefter **importeras som ett spel** via befintlig GitHub Discovery. Import av Builder som verktyg till Sites behöver en separat säker Sites-anslutning. Återanvänd projekt-ID vid uppdateringar.

## Tester

- `node --test tests/intelligent-builder.test.mjs`
- `node --check game-builder/{planner,runtime,builder,export}.mjs` (kör var och en)
- `node tests/intelligent-builder-smoke.mjs` efter att startat HTTP-server på 8080 och installerat Playwright/Chromium.

CI verifierar faktiska WebGL-spelytor, iPhone-emulerat responsivt läge, sparning, uppdatering av samma ID, ångra, export till ZIP och att ZIP faktiskt innehåller spelets källfiler. En grön emulatortest är **inte** ett verkligt iPhone Safari-prestandabevis.

## Arkitektur och säkerhet

- `planner.mjs` = input -> validerad, bounded config + minimal patch + tydlig unsupported-lista.
- `runtime.mjs` = en enhetlig realtidsmotor som accepterar `config`; kan återskapas vid redigering och disponerar gamla scener.
- `builder.mjs` = användarflöde, lokal lagring och versionshantering. Inga tokens/nycklar skickas.
- `export.mjs` = lokal ZIP Store/CRC32 och inhämtning av bara offentliga statiska modul-filer från samma Preview-host.

**Nästa riktiga integrationsfas:** Via en auktoriserad Sites-kodåtkomst, exponerade MCP-verktyg eller en dokumenterad versionerad API koppla plan/projektdiff till ett existerande Sites-spel. Gör det först när källan går att läsa/testa. GitHub Preview och Sites delar inte automatiskt databas eller spelprojekt.

## Magic Asset Library — juridiskt försiktig beta

Under `/game-builder/` finns nu i den här utvecklingsgrenen en separat **GLB-import i befintliga spelvärlden**, med x/z-position, rotation, direkt storleksändring och stöd för modellens första animation. Modellen sparas i den öppna fliken och i den exporterade ZIP-filen. Importerade modeller ligger **inte** i Sites och överlever **inte sidomladdning** förrän man exporterat spel-ZIP.

Source Library visar **Kenney, två uttryckligen CC0-licensierade KayKit-paket och Poly Haven**, officiell licenskälla och verifierad frivillig stöd-/donationslänk. En uppladdning kräver uttryckligt rättighetsintyg. Filer med okänd licens, fel källa, extern GLB-textur, storlek över 8 MB eller obekräftat ursprung blockeras. Det är inte en frisedel för andra filer i samma webbshop. Krediter och ursprung följer med som `CREDITS.md` + `ASSET_MANIFEST.json` i ZIP-exporten.

All kod och policy, avgränsning till Preview och framtida granskning inför Sites finns i [ASSET_POLICY.md](./ASSET_POLICY.md). **Rapier/Yuka/Navcat, extern asset-spegel, större Asset Vault och generativ AI är inte installerade av denna ändring.**

Tester: `node --test tests/safe-asset-library.test.mjs tests/intelligent-builder.test.mjs` samt befintlig browser-smoke i Actions.


## Architect V1 – visuell spelstudio (november 2026)

**UI över samma fungerande Game Builder, inte en ny plattform.** `architect-ui.mjs` och `architect-ui.css` lägger till en responsiv fyrastegsstudio: **Idé → Spelregler → Provspela → Leverera**. Den öppnas på den befintliga `/game-builder/`-adressen och använder befintliga `builder.mjs`, `planner.mjs`, WebGL-runtime, GLB-import, versionshistorik och ZIP-export.

- **Idé:** svensk prompttolkning med förhandsgranskning av vilka stödda spelvärden som hittats, med varningar för begränsningar.
- **Spelregler:** visuell inspector med redigerbara fält för värld, ljus/väder, genre, figur, grafik, banor, fiender och föremål. En tillämpning uppdaterar samma projekt-ID, uppdaterar runtime, ökar revisionen och fungerar med **Ångra**.
- **Logikvy:** visar motorns faktiskt implementerade nivå-/fiende-/samlings-/portalflöde utifrån sparad config. Detta är en **visning av befintlig mekanik**, inte en fritt programmerbar Blueprint-editor.
- **Provspela:** växla mellan responsiva förhandsvisningar av 16:9 och 9:16 utan att byta motor. Detta simulerar bildförhållanden, inte verklig iPhone-/TV-hårdvara.
- **Test:** explicit, lokal kontroll av runtime, canvas, kontroller, projekt-ID/revision, localStorage, ZIP-webb-API och GLB-gräns. Fysisk gamepad och Safari/TV-prestanda måste testas manuellt.
- **Leverera:** återanvänder existerande ZIP-export. Det finns ingen osäker direktpublicering till Sites.

**Ärlig status:** Inga nya AI-modeller/AI-API:er har anslutits; textförståelsen är fortsatt lokal och regelbaserad. Det finns ingen tillgång till produktionskoden i Sites, så den här ändringen kan köras i GitHub Preview men är **inte** installerad i den publicerade huvudplattformen. För AI-agenter, valfria logiknoder och Sites-projektpublicering behövs dokumenterade, auktoriserade API:er och end-to-end-tester.

**Tester:** `node --test tests/architect-ui.test.mjs tests/intelligent-builder.test.mjs` och `node tests/intelligent-builder-smoke.mjs` via befintligt testsystem.

## Cloud Engine — valbar assistent (GitHub Preview)

`cloud-assistant.mjs` och `cloud-assistant.css` lägger till ett mobilanpassat modellval i **befintliga** `/game-builder/` (inte en ny byggare).
- **DuoForge lokalt** är standard och använder befintlig `planner.mjs` utan serveranrop.
- **Cloudflare Llama** och **Cloudflare GLM Flash** syns men är **avaktiverade tills en riktig, autentiserad Sites-backend bekräftar anslutningen**. De erbjuder endast separata, granskningsbara kodförslag och ändrar inte spelprojekt eller publicerar något på egen hand.
- Webbläsaren anropar enbart **samma origin** på `GET /api/duoforge/ai/status` och `POST /api/duoforge/ai/proposal`. Den får **aldrig** tillgång till Cloudflare Account ID, API-token, Worker BRIDGE_TOKEN eller GitHub-token.
- `POST /proposal` skickar endast `{prompt,model,projectId,revision}`. Backend måste ta actor-ID från validerad Sites-session, kontrollera projektägarskap/revision, skydda mot CSRF, skicka separat Workersecret server-till-server och uppfylla PR/test/granskning innan eventuell kod används.
- Om endpoint saknas (vilket gäller GitHub Pages) förblir 3D-spelbyggaren lokalt fungerande. Inga betalda anrop försöks och ingen Cloudflare-anslutning utlovas.

**Cloudflare-backendkod** finns separat i privata `MattD81/DuoForge-Platform/cloudflare/`. Den är inte automatiskt installerad i Sites. För riktig drift krävs D1-binding, Workers Free-kontroll, server-secret och behörig Sites-backend. Inga nya användare eller projekt skapas av den här UI-förändringen.

**Tester:** `node --test tests/cloud-assistant.test.mjs`, inkluderat i Game Builder CI.
