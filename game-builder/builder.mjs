import {BUILDER_VERSION,normalizeConfig,planGame} from "./planner.mjs";
import {startBuilderGame} from "./runtime.mjs";
import {downloadGame} from "./export.mjs";
import {CREATOR_SOURCES,MAX_ASSETS,assertSafeGlb,acceptAssetProvenance,cleanPlacement} from "./safe-assets.mjs";

const $=id=>document.getElementById(id);
const STORAGE="duoforge-intelligent-builder-v1";
const SUPPORTED={world:{ocean:"Hav",forest:"Skog",city:"Stad",ruins:"Ruiner"},
 weather:{storm:"Storm",sunset:"Solnedgång",clear:"Dagsljus",night:"Natt"},
 genre:{arena:"Strid",adventure:"Äventyr"},quality:{auto:"Adaptiv GPU",quality:"Hög grafik",performance:"Prestanda"}};
let game=null,config=null,history=[],busy=false,assets=[];
function store(){
 try{localStorage.setItem(STORAGE,JSON.stringify({config,history:history.slice(-10)}));}catch{}
}
function revive(){
 try{
  const item=JSON.parse(localStorage.getItem(STORAGE)||"null");
  if(item&&item.config){config=normalizeConfig(item.config);history=(item.history||[]).slice(-10).map(normalizeConfig);return;}
 }catch{}
 config=normalizeConfig({id:"duoforge-"+Date.now().toString(36),title:"Mitt första 3D-spel",world:"forest"});
 history=[];
}
function showFeedback(message,isError=false){
 const node=$("feedback");node.classList.toggle("error",isError);node.textContent=message;
}
function renderPlan(plan){
 const el=$("changes");el.replaceChildren();
 for(const change of plan.changes){
  const s=document.createElement("span");
  const label=SUPPORTED[change.field]?.[change.to]||change.to;
  const readable={world:"Miljö",weather:"Väder",levels:"Banor",enemies:"Fiender",collectibles:"Kristaller",genre:"Genre",hero:"Karaktär",quality:"Grafik",title:"Namn",status:"Status"};
  s.textContent=(readable[change.field]||change.field)+": "+label;el.appendChild(s);
 }
 $("engines").replaceChildren();
 for(const engine of plan.used){const s=document.createElement("span");s.textContent="✓ "+engine;$("engines").appendChild(s);}
 $("warnings").replaceChildren();
 for(const msg of plan.warnings){const div=document.createElement("div");div.className="warning";div.textContent="⚠ "+msg;$("warnings").appendChild(div);}
}
function onGameState(s){
 $("level").textContent="BANA "+Math.min(s.stage,s.levels)+"/"+s.levels;
 $("health").textContent="♥ "+s.life;
 $("progress").textContent="✦ "+s.collected+"/"+s.target+" · ⚔ "+s.remaining+" kvar";
 $("goal").textContent=s.won?"🏆 ALLA BANOR AVKLARADE":s.life===0?"Slut på liv – välj Börja om":
  s.notice;
 $("renderState").textContent="● "+s.backend+" · "+(s.fps||"—")+" FPS";
}
function mount(){
 game?.destroy();game=null;
 $("viewport").replaceChildren();
 $("gameTitle").textContent=config.title;
 $("identity").textContent="Projekt "+config.id+" · version "+config.revision+" · sparas lokalt";
 $("restart").disabled=false;
 try{
  game=startBuilderGame({host:$("viewport"),controls:$("controls"),config,onState:onGameState,
   assets,onAssetEvent:event=>{
    $("assetsFeedback").textContent=event.status==="error"?"Modellfel: "+event.message:"GLB synlig i spelvärlden.";
   }});
  $("renderState").textContent="● 3D-motorn igång";
 }catch(error){
  $("renderState").textContent="⨯ Renderingsfel";
  showFeedback("Kunde inte starta WebGL: "+String(error.message||error),true);
 }
 $("undo").disabled=!history.length;
}
async function updateFromPrompt(){
 if(busy)return;
 const prompt=$("prompt").value.trim();
 if(!prompt){showFeedback("Skriv vad spelet ska innehålla eller vilken ändring du vill göra.",true);return;}
 const plan=planGame(prompt,config);
 renderPlan(plan);
 if(plan.applied===0){
  showFeedback("Ingen ny förstådd ändring. V1 kan uppdatera miljö, väder, genre, antal banor/fiender/kristaller och grafikläge."+
   (plan.warnings.length?" Se även begränsningarna nedan.":""));
  return;
 }
 history.push(config);if(history.length>10)history.shift();
 config=plan.config;store();mount();
 showFeedback("✓ Samma projekt uppdaterat till version "+config.revision+" med "+plan.applied+
 " riktiga inställningsändringar. Spela direkt eller skriv nästa ändring!");
}
$("build").addEventListener("click",updateFromPrompt);
$("undo").addEventListener("click",()=>{
 if(!history.length)return;
 config=normalizeConfig(history.pop());store();mount();
 showFeedback("↶ Återställde föregående projektversion. Spela och fortsätt redigera!");
});
$("newProject").addEventListener("click",()=>{
 // Deliberate user action: create a truly separate project ID.
 assets=[];renderAssets();
 history=[];config=normalizeConfig({id:"duoforge-"+Date.now().toString(36),revision:1,
  title:"Mitt nya 3D-spel"});
 store();mount();
 renderPlan({changes:[{field:"status",to:"Nytt spelprojekt skapat"}],used:[
  "GPU Deluxe – adaptiv upplösning","Procedurgenererad 3D-figur och hinder",
  "DuoPad – tangentbord, touch och Gamepad API","Kamera som följer spelaren"],warnings:[]});
 showFeedback("✓ Nytt spelprojekt skapat. Skriv en idé och bygg det här. Det tidigare lokala projektet kan inte återställas utan en ZIP-export.");
});
$("restart").addEventListener("click",()=>game?.restart());
for(const p of document.querySelectorAll("[data-preset]")){
 p.addEventListener("click",()=>{$("prompt").value=p.dataset.preset;$("prompt").focus();});
}
$("export").addEventListener("click",async()=>{
 if(busy)return;
 busy=true;$("export").disabled=true;$("export").textContent="◌ Packar spelet…";
 try{
  const report=await downloadGame(config,{assets});
  showFeedback("✓ Exporterade "+report.name+" med "+report.files+" filer ("+
   Math.round(report.bytes/1024)+" KB). Kör från en webbserver och importera via GitHub till DuoForge.");
 }catch(error){
  showFeedback("Exporten misslyckades: "+String(error.message||error)+". Projektet är kvar i webbläsaren.",true);
 }finally{busy=false;$("export").disabled=false;$("export").textContent="⬇ Exportera spelbar ZIP";}
});
revive();mount();
renderPlan(planGame("Skapa 3D-spel i "+({ocean:"hav",forest:"skog",city:"stad",ruins:"ruiner"}[config.world]),config));
showFeedback("✓ Intelligenta Game Builder är redo. Det här är en lokal 3D-mall med regelbaserad prompttolkning. Förändringar sparas i webbläsaren. Använd textfältet för att förbättra samma spel.");
Object.defineProperty(window,"__duoforgeBuilder",{value:Object.freeze({
 get config(){return config},get history(){return history.map(x=>x.revision)},
 get active(){return !!game},get game(){return game?.state||null},get assetCount(){return assets.length},
 plan:prompt=>planGame(prompt,config),version:BUILDER_VERSION
})});
