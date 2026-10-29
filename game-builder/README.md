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
