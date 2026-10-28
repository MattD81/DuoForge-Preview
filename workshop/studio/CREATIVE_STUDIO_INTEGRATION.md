# DuoForge Creative Studio – integration (faser 1–4)

**Status:** GitHub-preview, privat utkast i separat PR. Inte publicerat i Sites.
Mål: förbättra den befintliga DuoForge-verkstaden, inte skapa en ny Sites-app eller kopiera användarprojekt till GitHub Pages.

## Fas 1 – Gemensamt arbetsflöde
- \`studio.mjs\` monterar \`creative-hub.mjs\` i den **befintliga** högerspalten.
- All modellering, GLB-export, Render World och Film Studio använder fortfarande samma scen och render-loop.
- Inga befintliga routes eller projekt-ID:n byts ut.
- Det autentiserade Sites-API:t finns **inte** i det här publika GitHub-projektet. En faktisk Sites-import ska använda den fristående, serverorienterade \`creative-site-contract.mjs\`, INTE ett öppet klientendpunkt eller API-nycklar i webbläsaren.

## Fas 2 – Enhetliga resurser och grafik
- Markera objekt och välj **Spara markerat i lokalt bibliotek**.
- GLB sparas som binär Blob i en separat IndexedDB-databas: \`duoforge-creative-assets-local\`.
- SHA-256 används för att undvika exakt identiska kopior. Samma namn med olika hash behandlas som en ny version, inte som en säker dubblett.
- Valbar pixelratio-profil för 3D-redigeraren: energisnål, balanserad, hög. Den ändrar inte Render Worlds separata postprocess-/kvalitetsinställningar.
- Inga resurser laddas automatiskt upp till en molnserver. Lokal lagring fungerar endast på samma webbläsare/enhet/ursprung.

## Fas 3 – Spel och film
- Knappen **Exportera spelpaket** skapar en enda ZIP med \`<scennamn>.glb\` och \`duoforge-creative.json\`.
- Manifestet är \`duoforge-creative-scene@1\` och anger filnamn, SHA-256, koordinatkonvention, scenobjekt och kompatibilitetsinformation.
- ZIP packas lokalt i webbläsaren utan externa bibliotek. Nuvarande pakettak 50 MB.
- **Testspela** öppnar befintlig Render World. **Filmvärld** öppnar samma miljö där Film Studio redan finns. Kamera, ljus och GLB delas i samma arbetsyta; ingen ny videomotor har skapats.
- Import av ZIP direkt in i *riktiga* DuoForge Sites är ännu inte kopplad. Tills dess packar man upp ZIP och importerar GLB via ett befintligt kompatibelt arbetsflöde; JSON-filen är ett förberedande överföringskontrakt.

## Fas 4 – Resursassistent (grund)
- Lokal regelbaserad sökning efter fordon, byggnader, natur, fartyg och karaktärer.
- Visar vilka modeller som redan finns och vilka kategorier som saknas.
- Med ett uttryckligt klick kan högst fem hittade modeller återanvändas i scenen.
- Detta är **inte** en generativ AI-agent. Ingen autonom kodändring, nätverkssökning, automatisk riggning, ny geometri eller externt AI-anrop görs.

## Sites-adapter som måste kopplas till riktig backend
\`creative-site-contract.mjs\` exporterar \`attachCreativeAsset({manifest,model,projectId,session,authorize,findAsset,storeAsset,linkAsset})\`.

1. Kör enbart från betrodd Sites-serverkontext. \`session\` kommer från faktisk serverautentisering, aldrig från JSON-manifestet.
2. \`authorize\` kontrollerar privat projektägarskap och rättigheten \`creative:asset-write\` **innan** läsning eller skrivning.
3. Verifiera manifestets schema, GLB-containerhuvud, 50 MB-gränsen och SHA-256.
4. \`findAsset\` måste söka inom den autentiserade ägarens tillåtna lagringsutrymme – aldrig globalt bland andra användares privata resurser.
5. \`storeAsset\` skriver binären i säker privat lagring, och \`linkAsset\` kopplar asset-ID till det **befintliga** spelprojektet. Båda bör vara idempotenta/transactionella. Logga aldrig privata filbytes eller tokens.
6. Validera glTF-innehållet ytterligare på servern innan en fil tillåts användas i produktion (resurser, texturer, tillåtna tillägg, animationer, storlek och licens).
7. När Sites-koden är tillgänglig: anslut import till den redan existerande GitHub-/spelbiblioteksfunktionen. Skapa inte dubbla spel eller ersätt privata assets.

Observera: funktionens mockade tester verifierar kontraktets beteende. Det betyder **inte** att ett autentiserat Sites-server-API har driftsatts.

## Kontroll
- \`node --test tests/creative-core.test.mjs tests/creative-site-contract.test.mjs\`
- \`node tests/creative-hub-smoke.mjs\` med befintlig lokal HTTP-server och Playwright.
- PR:n kör även existerande studio-smoke och regressionstester.

## Kvar före produktionsrelease
- Få fram verkliga Sites-källan och dess nuvarande API, uppladdningsflöde, projektägarskap och filbyggare.
- Installera kompatibel Three.js-version och kontrollera isolerad spelbyggare (CDN-import från GitHub Preview får inte kopieras rakt in).
- Säker multiuser-resurslagring, mobiltest, verkliga GLB-tester samt prestandamätningar.
- Efter godkänt kodgransknings-/CI-resultat: koppla Sites och publicera i en separat, uttryckligt godkänd release.

Ingen Work-körning, extern AI-tjänst, extern GPU eller ny Sites-app används av denna implementation.
