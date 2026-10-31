# DuoForge Magic Asset Library — säker beta (2026-10-31)

Den här implementationen läggs i den **befintliga** `game-builder/` i `DuoForge-Preview`. Den är **inte** en publicering till DuoForge Sites. Inga filer, databaser, konton eller behörigheter i Sites ändras.

## Fungerar i Preview-grenen

- Välj originalskapare eller **Eget originalverk**, ladda en **GLB med inbäddad geometri och textur**, bekräfta dina rättigheter och ange en HTTPS-länk till rätt paket/modell.
- Modellen visas i *samma spelbara 3D-värld*, inklusive standardiserad storlek, rotation, x/z-reglage och första inbäddade animationen om en sådan finns.
- Modell, källspår, upphovsperson, licens/ägandeintyg och frivillig skapardonation följer med en självständig ZIP-export som `project.json`, `ASSET_MANIFEST.json` och `CREDITS.md`.
- Fyra originalkällor med **länkar till officiell licens** och **länkar till skaparnas egna stödsidor** är synliga i gränssnittet. Inga donationer behandlas av DuoForge.
- Felaktig, för stor, externt länkad eller otillåten GLB vägras. Max sex filer à 8 MB (i minnet). Modeller behålls **inte efter sidomladdning** utan ZIP-export; permanent projektlagring kommer först efter auktoriserad Sites-integrering.
- Modeller och deras metadata lagras inte på DuoForge-servern vid Preview-import. Inga automatiska GitHub-importer eller speglar av tredjepartsbibliotek.

## Källor som kan användas — endast specifikt publicerat CC0-innehåll

| Skapare | Ursprung | Licensbevis | Frivilligt stöd |
|---|---|---|---|
| Kenney | https://kenney.nl/assets | https://kenney.nl/support | https://kenney.nl/donate |
| Kay Lousberg, Dungeon Remastered | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0 | https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/blob/main/LICENSE.txt | https://www.patreon.com/kaylousberg |
| Kay Lousberg, Adventurers | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 | https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/main/LICENSE.txt | https://www.patreon.com/kaylousberg |
| Poly Haven | https://polyhaven.com/models | https://polyhaven.com/license | https://polyhaven.com/donate |

**Säkerhetsprincip:** en generell CC0-profil innebär *inte* att ett slumpmässigt nedladdat objekt eller betalt specialpaket är fritt. Ange därför originalpaketets eller specifika modellens adress och bekräfta själv att filen tillhör det paketet. DuoForge testar URL-format/domän och kräver intyg men **kan inte automatiskt bevisa** att uppladdaren har upphovsrätten. Osäkra fall blockeras i en publik kuraterad katalog tills manuell granskning finns.

## Policy för lansering i riktiga Sites

1. Ingen automatisk spegling, import eller indexering av tredjepartsfiler före **individuell licens- och ursprungskontroll** med ursprungs-URL, SPDX-id, bevisdatum, licensfil, hash och tydlig skapare.
2. Bara CC0 eller uttryckligen rättighetsklarerade egenverk släpps in som nedladdningsbara modeller i version 1. MIT/Apache-kod hanteras separat med respektive fullständiga licenstext/notice innan bundling; ingår inte automatiskt.
3. En modell som lämnas in i Creator Upload ska kunna avpubliceras av ägaren; skapa incidentväg för upphovsrättsanspråk och blockera vidare nedladdning. Även spelbyggarens egna publicerade paket måste behålla krediter/källinformation.
4. Skydda andra rättigheter än copyright: företagsloggor, personlighets-/porträtträtt, skyddade varumärken, känsligt material och integritet. CC0 löser inte dessa frågor.
5. Donera-länkar visas utan uppmaningstvång, betalningsspårning, provison eller antydan om officiellt sponsorskap. Länkar ska gå direkt till verifierade originella upphovspersoner.
6. Sites-integrering kräver godkänd API-/kodbehörighet, verifiering mot senaste Sites-kod och testsäkrad bevaring av befintliga projekt-ID. **GitHub-kod blir inte automatiskt aktiv i Sites.**

## Teknik och avgränsning

Den här första fasen lägger **inte** till Rapier, Yuka, Navcat, Rocketbox, obegränsade modellarkiv, generativ AI eller automatiskt licensskannade miljoner filer. Dessa ska utvärderas separat och får inte marknadsföras som installerade. Endast gratis/CDN-baserad existing Three.js och intern DuoForge-spelrendering används.

Tester: `node --test tests/intelligent-builder.test.mjs tests/safe-asset-library.test.mjs`. Automatiserad browser-smoke och emulerad iPhone sker i GitHub Actions på PR.
