# Neonräven Turbo – JumPHP/WebAssembly source

**Detta är en faktisk PHP/JumPHP-implementation** av det ursprungliga arkadspelskonceptet Neonräven. Den använder `AbstractScene`, `Renderer`, `actions()`, och procedurgenererade pixelobjekt enligt JumPHPs officiella API. Den körs inte som PHP på Github Pages utan måste byggas av JumPHP (PHP 8.5 + SDL2/WebAssembly, Docker).

## Struktur
`config/project.yaml`, `config/input.yaml`, `src/Scene/TurboScene.php`.

## Kör så här
1. Skapa ett nytt JumPHP-skelett med dokumenterade `composer create-project jumphp/jumphp` och `bin/jumphp new neonraven-turbo`.
2. Kopiera dessa tre filer till `games/neonraven-turbo/` inne i det projektet.
3. Kör `bin/jumphp install neonraven-turbo`, `bin/jumphp run neonraven-turbo`, `bin/jumphp test neonraven-turbo`.
4. Bygg webbutgåvan: `bin/jumphp build neonraven-turbo`.
5. Kör `node services/jumphp/pack.mjs <mappen-med-index-html-och-wasm> neonraven-turbo "Neonräven Turbo"` från DuoForge-Preview-roten.
6. Publicera hela webb-builden via HTTPS. Kopiera manifestets URL till [JumPHP-previewadaptern](../../../game-builder/jumphp/).

**Viktigt:** Detta repository har inte kompilerat JumPHP-runtime till WebAssembly. Inte körtester mot JumPHP-Docker ännu. Syntax och logik behöver verifieras i en riktig JumPHP-installation innan publicering. PHP-versionen och DuoForge HTML5-prototypen har samma idé och liknande mekanik men är två separat implementerade spelklienter.

Spelkontroller: vänster/höger, mellanslag eller A hoppa, Shift eller X turbodash. Fem etapper, ringar, robotfiender, fjädrar, boostpaneler, checkpoints och poäng. Originalkaraktär och egna grafiska figurer utan externa sprites.

Officiell JumPHP API-referens: https://jumphp.net/docs/hello-world och https://jumphp.net/docs/plates-formes
