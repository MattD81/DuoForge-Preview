# DuoForge Mobile Studio UX – bygg direkt på telefonen

Implementerad för den **befintliga** 3D-verkstaden i `workshop/studio/`, inte en separat mobilapp.

## Grundprincip

Den tidigare telefonvyn lade hela objektpanelen och inställningarna **under** 3D-vyn i en lång webbsida, vilket gjorde det svårt att skapa och se resultatet samtidigt.

Den nya vyn använder en fast **3D-canvas** högst upp och en **nedre, självständigt rullningsbar verktygslåda**, med sex tryckvänliga knappar längst ned:

- **Skapa** → Character Forge (knappar för Värld, Former, Bibliotek), utan att dölja 3D-modellen.
- **Objekt** → objekthierarki, ångra, gör om, markera och hantera scenelement.
- **Material** → Material Lab/PBR, färg, texturer.
- **DNA** → Shape DNA, tre varianter och geometrikontroller.
- **Justera** → position/rotation/skala, skulptera, förhandsvisa och export.
- **Visa 3D** → fäll ihop verktygslådan och ge modellen mer plats. Ett tryck öppnar verktygen igen.

Det befintliga projektet/GLB-innehållet, spar-/importkontroller, Three.js-canvas, t.ex. Character Forge och Material Lab **återanvänds**. Inga duplicerade objekt eller andra projekt-ID skapas. Smala fönster eller korta touch-skärmar får denna layout, stora skärmar behåller det ursprungliga trekolumnsgränssnittet.

## Telefonvänliga detaljer

- Dynamisk höjd efter toppmenyn, safe-area för iPhone Home Indicator, 44px-ish tryckytor och 16px inputfält för att undvika oavsiktlig Safari-zoom.
- Spara/Exportera/Importera ligger först i toppmenyn, övriga befintliga handlingar finns genom horisontell svepning.
- Flytta/Rotera/Skala och 3D-kameran är kvar. Tryck på objekten i scenen eller välj via Objekt-tabben.
- Snabbkommandon på 3D-canvas: Ångra, Gör om, Fokus. I spel-/renderläge göms dockan; 3D-vyn får full area.
- Porträtt: verktygen använder en begränsad del av höjden och resterande del av fönstret är riktig interaktiv 3D.
- Kort liggande telefon: börjar med verktygen infällda. När de öppnas läggs de över canvas nederdel i stället för att göra canvasen nästan obrukbar.

## Vad som *inte* gjorts

Inga egna iOS-appar, lokala neurala GPU-modeller, gratis AI-bild→3D-motorer eller ändringar i live ChatGPT Sites. Denna UX låter användaren utnyttja befintliga verktyg på telefon, men förändrar inte AI-genereringens kvalitet.

## Test

`.github/workflows/mobile-studio-ux.yml` kör Playwright med 390×844 porträtt, 844×390 touch-landskap och 1440×900 desktop. Kontrollpunkter omfattar skapande av riktig 3D, tillgängliga tabbar, egna sidopanelers scroll, ångra/gör om, spara lokalt, ladda ned GLB, infälld/full canvas och regressionskontroll på desktop.

CI är syntetisk mobilsimulering och **inte** en körning på fysisk iPhone. Bekräfta även på en riktig enhet.
