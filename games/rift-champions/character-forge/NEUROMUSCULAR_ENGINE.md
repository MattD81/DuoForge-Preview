# DuoForge Human Motion Engine V1 – neuromuskulär spelmotor

**Installerad i GitHub-grenen:** `games/rift-champions/character-forge/`, som tillägg till den **befintliga** Character Forge V3. Använder originalets GLB-laddning, Three.js-skelett och ansiktsmorphs. Ingen ny plattform och ingen ChatGPT Work-körning. Använder inga betalda API:er.

## Funktioner som verkligen är implementerade

- **72 namngivna rörelsefriheter (DoF)** för bål, nacke, axlar, armbågar, underarmar, handleder, höft, knän, anklar, tår och **framtida** fingrar (fem fingrar × tre leder × två händer). Alla kan få egna graderade målvinklar och ledgränser. V3-modellerna innehåller inte dessa 72 separata skelettkanaler – kontrollen **visar hur många som faktiskt kan mappas** i importerad GLB.
- **144 schematiska agonist-/antagonistaktuatorer** (två per ledkanal). Dessa är förenklade **muskelgrupper**, inte 144 individuellt anatomiskt segmenterade och verifierade människomuskler. Varje aktuator har en aktiverings-/avaktiveringstid, enkel Hill-inspirerad force–length–velocity-proxy, passiv elastisk stretch och en approximerad momentarm.
- **27 rörelsemallar:** gång, löpning, sprint, knäböj, sittande, hopp, landning, sträckning, lyft, tryck, drag, slag, spark, blockering, vinkning, klättring, krypning, vridning, dans, bugning, balans, grepp, pekning, andning, vila och stående.
- **Godtyckliga rörelser** kan skrivas med `setCustomPose({"right.index.middle": 75, "spine.twist": 15})`; samtidiga delrörelser kan läggas över en baspose med `setOverlay("wave", {weight:.8,mask:[...]})`.
- 120 Hz begränsad intern steglängd, vinkelbegränsning, antagonistiska muskelkrafter, tröghet och dämpning; interpolerade övergångar mellan rörelsemönster; schematisk fotkontakt; 8 befintliga ansiktsuttryck och opt-in muskelsvällnings-morph **endast om det faktiskt finns i GLB**.
- Valbar demonstration på **befintliga** kael/vex V3-GLB i Character Forge. Inbyggda GLB-animationer och BVH-import fortsätter fungera; muskelläge startas/stoppas separat, återställer ursprunglig pose. På mobilen finns alla nya kontroller i panelen.

## Vetenskaplig inspiration, avgränsningar och licenser

- OpenSim's Hill-type muskler beskriver aktiva kontraktionselement, passiv elastisk vävnad, senor, pennationsvinkel och dynamisk jämvikt. Detta V1 **imiterar endast förenklad aktivering, aktiv/passiv force–length–velocity och joint-space torque**. Det löser inte riktiga muskelbanor, vävnadsdeformation eller full muskel–senjämvikt. Källa: https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim33/pages/53674401/Millard%2B2012%2BMuscle%2BModels
- MuJoCo beskriver muskelaktuatorer med normaliserad muskellängd/-hastighet och kraft. Referens: https://mujoco.readthedocs.io/en/stable/modeling.html
- glTF 2.0 specificerar skinnade mesh-vertices (`JOINTS_0`, `WEIGHTS_0`, inverse bind matrices), animationer och morph-targets: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- OpenSim är Apache 2.0: https://github.com/opensim-org/opensim-core , men **ingen OpenSim-kod kopieras eller integreras här**. Three.js omfattas av MIT. Filerna är egen DuoForge-kod och använder inga externa muskelmodeller/mocap-dataset.

**Detta är inte en fysiologiskt korrekt representation av alla människans rörelser eller alla individuella muskler.** Det är en ärlig, utbyggbar och mätbar grundmotor för spel. Skillnaden är viktig: en faktisk komplett simulator kräver kalibrerade muskelfästen, segmentmassor, nervstyrning, senornas elasticitet, flerskiktad hud/fascia, biomekaniska experiment, omvärldskontakt, balans/IK, anatomiskt korrekta finger-/ansiktsriggar samt validering mot rörelsemätning.

## Nästa faser för *faktisk* muskeldragning och mjuk vävnad

1. **Anatomisk GLB V4:** 100–200+ riggben efter modellens krav, identifierbara fingrar och ögon, 4/8 normaliserade vertex-skinvikter, rätt bindmatriser, före-/eftermätning av deformation i axlar och leder. Ansiktsblendshapes för uttryck. Originalmodellernas 21 leder räcker inte för full fingermotorik.
2. **Muskelvolym i rörelse:** sculptade muskellager, definierade origin/insertion/via points, verkliga momentarmar, flex- och kompressionsblendshapes samt skin-/tissue-simulering. Testa utan att förstöra GLB eller skapa en överlagd 2D-bild.
3. **Fysik & balans:** markkontakt, pelvis/foot IK, gravitationskrafter, fall, recovery, fotisättning, riggkalibrering och aktionsdrivna motorprogram; uppmätta 3D-krafter i stället för proxy.
4. **Högprecisionsvalidering:** öppna rörelsedataset med kända licenser, calibrerade biomekaniska modellparametrar, jämför mot OpenSim/MuJoCo där möjligt, utan att låtsas att animationer bevisar biologisk korrekthet.
5. **Gemensam motor:** koppla till befintliga DuoForge 3D Workshop, Cinema och spelprojekt via en versionerad motor-API, utan att kopiera/duplicera programmoduler.

## API

```js
import {NeuromuscularEngine} from './biomechanics-core.mjs';
const body=new NeuromuscularEngine({massKg:75,intensity:.85});
body.setMotion('walk');
body.setOverlay('wave',{weight:.7,mask:['left.shoulder.flex','left.elbow.flex']});
for(let i=0;i<120;i++)body.step(1/120);
const data=body.snapshot(); // joints, strongest muscles, force estimates, face
body.setCustomPose({'right.index.middle':60,'spine.twist':15});
```

## Test och release

```bash
node --test tests/biomechanics-core.test.mjs tests/biomechanics-adapter.test.mjs
```
Node-adaptertester kräver befintliga MIT Three.js `three@0.180.0` via npm i CI (ingen betaltjänst). Browser- och iPhone-tester med de publicerade V3-modellerna är fortfarande ett separat kvalitetssäkringssteg. **Kod i en PR ändrar inte Sites**, och GitHub Pages uppdateras först efter merge/publicering.
