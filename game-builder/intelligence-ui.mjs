/**
 * DuoForge Intelligence Center V1: add-on to Architect's EXISTING test panel.
 * No network requests, no separate accounts, no background code changes.
 */
import {buildIntelligenceReport,searchIntelligenceKnowledge,diagnoseGameError} from "./intelligence-core.mjs";

function element(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=String(text);
  return el;
}
function observedControls(){
  const host=document.getElementById("controls");
  if(!host)return {moves:0,actions:0,outside:0};
  const bounds=host.getBoundingClientRect(),buttons=host.querySelectorAll("[data-move],[data-action]");
  let outside=0;
  for(const button of buttons){
    const rect=button.getBoundingClientRect();
    if(rect.width>0&&rect.height>0&&bounds.width>0&&bounds.height>0&&
       (rect.left<bounds.left-2||rect.top<bounds.top-2||
        rect.right>bounds.right+2||rect.bottom>bounds.bottom+2))outside++;
  }
  return {moves:host.querySelectorAll("[data-move]").length,
    actions:host.querySelectorAll("[data-action]").length,outside};
}
function collectEvidence({getConfig,getGame,getAssets,errorText}){
  const game=getGame?.(),canvas=document.querySelector("#viewport canvas"),rect=canvas?.getBoundingClientRect();
  let readable=false;
  try{window.localStorage.getItem("duoforge-intelligent-builder-v1");readable=true;}catch{}
  const feedback=document.getElementById("feedback");
  const currentError=errorText?.trim()||
    (feedback?.classList.contains("error")?feedback.textContent:"");
  return {
    project:getConfig?.(),runtime:!!game,state:game?.state||null,
    canvas:{exists:!!canvas,width:rect?.width||0,height:rect?.height||0},
    controls:observedControls(),assetCount:getAssets?.()?.length||0,
    storageReadable:readable,
    exportAvailable:typeof Blob!=="undefined"&&typeof fetch==="function",
    fps:typeof game?.state?.fps==="number"?game.state.fps:null,
    errorText:String(currentError||"").slice(0,400)
  };
}
export function mountIntelligenceCenter({getConfig,getGame,getAssets}={}){
  const inspector=document.getElementById("architectInspector");
  const tabs=inspector?.querySelector(".architect-tabs");
  if(!inspector||!tabs||!getConfig||!getGame)return null;
  if(inspector.querySelector('[data-panel="intelligence"]'))return null;
  const tab=element("button","architect-tab","✦ Intelligence");
  tab.type="button";tab.dataset.pane="intelligence";tab.setAttribute("role","tab");
  tab.setAttribute("aria-selected","false");tabs.append(tab);
  const pane=element("section","architect-pane intel-pane");
  pane.dataset.panel="intelligence";pane.setAttribute("role","tabpanel");pane.hidden=true;
  pane.append(element("div","sectiontag","INTELLIGENCE CORE · LOKAL BETA"));
  pane.append(element("h3","","Din spelkvalitetsagent"));
  pane.append(element("p","","Kontrollera just det här spelet, hitta troliga fel och få förslag på åtgärder. Inga AI-anrop, installationer eller kodändringar sker automatiskt."));
  const summary=element("p","intel-summary","Inga kontroller körda för den här revisionen.");
  summary.setAttribute("role","status");
  const scan=element("button","primary intel-button","✓ Analysera spelet");
  scan.type="button";
  const results=element("div","intel-results");
  results.setAttribute("aria-live","polite");
  const errorLabel=element("label","intel-field");
  errorLabel.append(element("span","","Felmeddelande (valfritt)"));
  const errorInput=element("textarea","intel-textarea");
  errorInput.placeholder="Klistra in t.ex. Failed to resolve module specifier three";
  errorInput.rows=2;errorInput.maxLength=400;
  errorLabel.append(errorInput);
  const troubleshoot=element("button","secondary intel-button","⚒ Föreslå felsökning");
  troubleshoot.type="button";
  const advice=element("div","intel-advice");
  advice.setAttribute("role","status");
  const knowledgeTitle=element("h4","","Sök i DuoForges kunskapsbank");
  const searchLabel=element("label","intel-field");
  searchLabel.append(element("span","","Sökord"));
  const searchInput=element("input","intel-input");
  searchInput.type="search";searchInput.maxLength=300;
  searchInput.placeholder="T.ex. GLB, gamepad, svart skärm, FPS";
  searchLabel.append(searchInput);
  const lookup=element("button","secondary intel-button","⌕ Sök lösningar");
  lookup.type="button";
  const knowledge=element("div","intel-knowledge");
  const footer=element("p","intel-disclaimer",
    "Detta är lokala indikationer, inte fullständig säkerhetsskanning, AI-reparation eller ett publiceringsgodkännande. Kontroll på riktig iPhone, TV och GitHub CI återstår.");
  const actions=element("div","intel-actions");
  const git=element("a","","GitHub-källkod ↗");
  git.href="https://github.com/MattD81/DuoForge-Preview";git.target="_blank";git.rel="noopener noreferrer";
  const guide=element("a","","Kunskapskällan ↗");
  guide.href="https://github.com/trimstray/the-book-of-secret-knowledge";guide.target="_blank";guide.rel="noopener noreferrer";
  actions.append(git,guide);
  pane.append(summary,scan,results,errorLabel,troubleshoot,advice,knowledgeTitle,searchLabel,lookup,knowledge,footer,actions);
  inspector.querySelector(".architect-linkgrid")?.before(pane);
  if(!pane.isConnected)inspector.append(pane);
  function renderReport(report){
    results.replaceChildren();
    summary.textContent=report.counts.ok+" OK · "+report.counts.warn+" varningar · "+
      report.counts.fail+" fel · "+report.counts.manual+" behöver manuellt test. Revision "+(report.revision??"?")+".";
    for(const item of report.results){
      const row=element("article","intel-result intel-"+item.status);
      const head=element("div","intel-result-head");
      const badge=element("span","intel-badge",item.status==="ok"?"OK":item.status==="fail"?"FEL":item.status==="warn"?"VARNING":"MANUELLT");
      head.append(badge,element("strong","",item.title));
      row.append(head,element("p","",item.evidence),element("small","",item.action));
      results.append(row);
    }
  }
  function runChecks(){
    const report=buildIntelligenceReport(collectEvidence({getConfig,getGame,getAssets,errorText:errorInput.value}));
    renderReport(report);return report;
  }
  function showAdvice(){
    advice.replaceChildren();
    const feedback=document.getElementById("feedback");
    const message=errorInput.value.trim()||(feedback?.classList.contains("error")?feedback.textContent:"");
    const issue=diagnoseGameError(message);
    if(!issue){
      advice.textContent="Inget felmeddelande angivet. Kör Analysera spelet för att se aktuella kontroller.";
      return null;
    }
    advice.append(element("strong","",issue.title),element("p","",issue.fix),
      element("small","","Förslag för manuell granskning – ingen kod har ändrats."));
    return issue;
  }
  function showKnowledge(){
    const matches=searchIntelligenceKnowledge(searchInput.value,4);
    knowledge.replaceChildren();
    if(!matches.length){
      knowledge.append(element("p","","Ingen matchning. Prova kortare ord som GLB, modul, mobil eller FPS."));
      return matches;
    }
    for(const entry of matches){
      const row=element("article","intel-tip");
      row.append(element("strong","",entry.title),element("p","",entry.advice));
      const source=element("a","","Läs originalkälla ↗");source.href=entry.source;
      source.rel="noopener noreferrer";source.target="_blank";row.append(source);knowledge.append(row);
    }
    return matches;
  }
  tab.addEventListener("click",()=>{
    inspector.querySelectorAll("[data-pane]").forEach(el=>el.setAttribute("aria-selected",String(el===tab)));
    inspector.querySelectorAll("[data-panel]").forEach(el=>el.hidden=el!==pane);
  });
  scan.addEventListener("click",runChecks);
  troubleshoot.addEventListener("click",showAdvice);
  lookup.addEventListener("click",showKnowledge);
  searchInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();showKnowledge();}});
  function invalidate(){
    results.replaceChildren();
    summary.textContent="Projektet kan ha ändrats. Kör Analysera spelet igen för aktuell revision.";
  }
  return Object.freeze({runChecks,invalidate,showAdvice,showKnowledge});
}
