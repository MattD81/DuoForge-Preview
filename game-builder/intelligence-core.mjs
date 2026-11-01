/**
 * DuoForge Intelligence Core V1.
 * Deterministic and offline: checks evidence from the EXISTING Game Builder.
 * Does not execute code, call AI, inspect private repositories or write to Sites.
 */
export const INTELLIGENCE_KNOWLEDGE=Object.freeze([
  {id:"black-screen",title:"Svart skärm eller WebGL-fel",keywords:"svart skärm webgl grafik rendering canvas 3d",advice:"Kontrollera att WebGL startar, att canvas har storlek och att filernas modulvägar finns. Prova lägre grafikprofil innan du ändrar motor.",source:"https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API"},
  {id:"modules",title:"Saknade JavaScript-moduler",keywords:"module import three failed resolve specifier javascript 404",advice:"Kontrollera importmap, sökvägar och att filerna verkligen ingår i ZIP-exporten. ES-moduler måste köras från en webbserver.",source:"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules"},
  {id:"glb",title:"GLB, texturer och rättigheter",keywords:"glb gltf modell textur material asset import licens säkerhet",advice:"Kontrollera GLB-filens format, inbäddade texturer, rättigheter och modellens storlek. Importen är inte en automatisk licenskontroll.",source:"https://github.com/KhronosGroup/glTF"},
  {id:"mobile",title:"Mobil, touch och gamepad",keywords:"mobil gamepad touch iphone samsung tv knapp kontroll portrait landscape",advice:"Testa båda bildförhållandena, knapparnas klickyta och fysisk gamepad på riktig enhet. En DOM-kontroll bevisar inte fysisk funktion.",source:"https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API"},
  {id:"gpu",title:"Mobil GPU och stabil bildfrekvens",keywords:"fps prestanda gpu webgl mobil kvalitet upplösning",advice:"Börja med adaptiv upplösning, lägre kvalitet, instansering och färre samtidiga ljuskällor. Mät på den faktiska enheten.",source:"https://threejs.org/manual/#en/optimize-lots-of-objects"},
  {id:"quality",title:"Kontroller före publicering",keywords:"test kvalitet fel kontroll publicera export qa smoke",advice:"Kör lokala kontroller, öppna den exporterade ZIP-versionen via webbserver och provspela på mobil innan du publicerar.",source:"https://github.com/trimstray/the-book-of-secret-knowledge"},
  {id:"security",title:"Säker import och beroenden",keywords:"säkerhet malware beroenden licens zip import skanning",advice:"Kör aldrig skript från okända ZIP-filer automatiskt. Granska ursprung och licens, använd begränsade rättigheter och skanna beroenden separat.",source:"https://github.com/aquasecurity/trivy"}
]);
const normalizeText=text=>String(text??"").toLocaleLowerCase("sv-SE");
const terms=text=>new Set(normalizeText(text).match(/[\p{L}\p{N}]{3,}/gu)||[]);
export function searchIntelligenceKnowledge(query,limit=4){
  const wanted=terms(String(query??"").slice(0,300));
  if(!wanted.size)return [];
  return INTELLIGENCE_KNOWLEDGE.map((record,index)=>{
    const title=normalizeText(record.title),keywords=normalizeText(record.keywords),advice=normalizeText(record.advice);
    const score=[...wanted].reduce((n,word)=>n+(title.includes(word)?4:0)+(keywords.includes(word)?3:0)+(advice.includes(word)?1:0),0);
    return {record,index,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index)
    .slice(0,Math.max(0,Math.min(7,Number.isFinite(limit)?Math.floor(limit):4))).map(x=>x.record);
}
const DIAGNOSTICS=[
  {code:"MODULE_MISSING",pattern:/failed to resolve module|cannot find module|module specifier|failed to fetch dynamically imported|404.*\.m?js/i,
   title:"JavaScript-modul saknas",fix:"Kontrollera importmap och relativa filsökvägar. Säkerställ att JS-modulen följer med i exporten; testa via en webbserver.",lookup:"modules"},
  {code:"WEBGL",pattern:/webgl|context lost|context creation|renderingsfel/i,
   title:"3D-renderingen kunde inte starta",fix:"Kontrollera WebGL-stöd och webbläsarens fel, prova grafikprofil Prestanda och starta om spelet.",lookup:"black-screen"},
  {code:"MODEL",pattern:/\.glb|\.gltf|failed to load.*model|modellfel|draco/i,
   title:"3D-modell kunde inte laddas",fix:"Kontrollera filformat, inbäddade texturer, filstorlek och att modellen har tillåtna användningsrättigheter.",lookup:"glb"},
  {code:"STORAGE",pattern:/quotaexceeded|localstorage|storage.*denied|securityerror/i,
   title:"Lokal lagring blockerad",fix:"Kontrollera webbläsarens lagringsinställningar och exportera en ZIP som säkerhetskopia. Rensa inte data utan backup.",lookup:"quality"},
  {code:"INPUT",pattern:/gamepad|pointer|touch|controller/i,
   title:"Problem med styrning",fix:"Testa touchknappar och Gamepad API var för sig samt växla mellan 9:16 och 16:9.",lookup:"mobile"}
];
export function diagnoseGameError(message){
  const input=String(message??"").slice(0,1000);
  if(!input.trim())return null;
  const found=DIAGNOSTICS.find(x=>x.pattern.test(input));
  return found?{code:found.code,title:found.title,fix:found.fix,lookup:found.lookup}:
    {code:"UNKNOWN",title:"Fel utan känd signatur",fix:"Kopiera det exakta felmeddelandet, notera projektversionen och kontrollera webbläsarkonsolen. Ändra inte fungerande källkod på chans.",lookup:"quality"};
}
function finding(id,status,title,evidence,action){
  return {id,status,title,evidence,action};
}
/**
 * All arguments are observed values supplied by the existing builder UI.
 * ok = local observation only, manual = untested; no simulated test result.
 */
export function buildIntelligenceReport({
  project=null,runtime=false,state=null,canvas=null,controls=null,assetCount=0,
  storageReadable=null,fps=null,errorText="",exportAvailable=null
}={}){
  const results=[];
  const validProject=!!project&&typeof project.id==="string"&&project.id.length>0&&
    Number.isSafeInteger(project.revision)&&project.revision>0;
  results.push(finding("project",validProject?"ok":"fail","Projekt & version",
    validProject?"Projekt "+project.id+" · revision "+project.revision:"Projekt-ID eller revision saknas.",
    "Behåll samma projekt-ID och återgå till senaste sparade revision om det behövs."));
  results.push(finding("runtime",runtime&&state?"ok":"fail","Spelmotorns status",
    runtime&&state?"Runtime och spelstatus kan avläsas.":"Ingen fungerande runtime/spelstatus kunde verifieras.",
    "Öppna Provspela, kontrollera WebGL-fel och kör om kontrollen."));
  const canvasOK=!!canvas&&canvas.exists===true&&canvas.width>0&&canvas.height>0;
  results.push(finding("canvas",canvasOK?"ok":"fail","3D-yta",
    canvasOK?Math.round(canvas.width)+" × "+Math.round(canvas.height)+" CSS-pixlar.":"Ingen synlig canvas i spelområdet.",
    "Kontrollera att 3D-motorn renderar inuti #viewport."));
  const buttonsOK=!!controls&&controls.moves>=4&&controls.actions>=3;
  const outside=Number(controls?.outside)||0;
  results.push(finding("controls",!buttonsOK||outside>0?"fail":"ok","Touchkontroller",
    !buttonsOK?"Riktnings- eller actionknappar saknas.":outside>0?outside+" knapp(ar) ligger utanför kontrollområdet.":"DOM-knappar finns inuti kontrollområdet (inte ett fysiskt touchtest).",
    "Kontrollera mobilens stående och liggande läge samt riktig gamepad."));
  const measured=typeof fps==="number"&&Number.isFinite(fps)&&fps>0&&fps<1000;
  results.push(finding("performance",!measured?"manual":fps<25?"fail":fps<40?"warn":"ok","Uppmätt bildfrekvens",
    measured?Math.round(fps)+" FPS i den aktiva webbläsaren.":"Ingen användbar FPS-mätning ännu.",
    "Välj grafikprofil Prestanda eller Adaptiv och provspela på faktisk mobil/TV."));
  const count=Number.isSafeInteger(assetCount)&&assetCount>=0?assetCount:0;
  results.push(finding("assets",count<=6?"ok":"fail","GLB-importgräns",
    count+" av högst 6 placerade modeller. Detta kontrollerar inte filernas licenser.",
    "Minska antalet modeller eller dela upp scenen. Kontrollera licens och ursprung separat."));
  results.push(finding("storage",storageReadable===true?"ok":storageReadable===false?"fail":"manual","Lokal lagring",
    storageReadable===true?"Lagring kan läsas i denna session.":storageReadable===false?"Browserlagring är blockerad.":"Lagring har inte kontrollerats.",
    "Exportera ZIP regelbundet. Lagring i Preview synkroniseras inte med Sites."));
  results.push(finding("export",exportAvailable===true?"ok":exportAvailable===false?"fail":"manual","Exportförutsättningar",
    exportAvailable===true?"Grundläggande ZIP-webb-API:er finns (ingen ZIP har testexporterats).":"ZIP-API:er ej verifierade.",
    "Gör en riktig ZIP-export och testa i en webbserver före publicering."));
  const diagnostic=diagnoseGameError(errorText);
  if(diagnostic)results.push(finding("diagnostic","warn",diagnostic.title,"Feltext identifierad: "+diagnostic.code,diagnostic.fix));
  results.push(finding("security","manual","Säkerhets- och licensgranskning",
    "Externa ZIP-filer, beroenden och GLB-licenser har INTE skannats automatiskt.",
    "Granska källor, behörigheter och licenser. Kör separat säkerhetsskanning före produktion."));
  const counts={ok:0,warn:0,fail:0,manual:0};
  for(const r of results)counts[r.status]++;
  return {projectId:validProject?project.id:null,revision:validProject?project.revision:null,
    results,counts,readyForPublish:false,
    note:"Lokala indikativa kontroller, inte publiceringsgodkännande. Ingen automatisk reparation eller Sites-synk."};
}
