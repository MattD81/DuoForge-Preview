import {auditIntegrations,summarizeAudit} from "./core.mjs";

const $=id=>document.getElementById(id);
const labels={
  wired:["Kopplad i källan","good"],
  "module-unavailable":["Källfil saknas","bad"],
  "import-missing":["Import saknas","bad"],
  "startup-missing":["Startanrop saknas","bad"],
  "app-unavailable":["Studio kan inte läsas","bad"]
};
function render(results){
  const holder=$("results");
  holder.replaceChildren();
  for(const item of results){
    const card=document.createElement("article");
    card.className="card";
    const top=document.createElement("div");top.className="card-top";
    const title=document.createElement("h2");title.textContent=item.name;
    const badge=document.createElement("span");badge.className="state "+(labels[item.state]?.[1]||"wait");
    badge.textContent=labels[item.state]?.[0]||"Okänd status";
    const detail=document.createElement("p");detail.textContent=item.detail;
    top.append(title,badge);card.append(top,detail);holder.append(card);
  }
  const summary=summarizeAudit(results);
  $("summary").textContent=summary.issues
    ? `${summary.wired}/${summary.total} kopplingar hittades · ${summary.issues} behöver ses över`
    : `Alla ${summary.total} kontrollerade moduler har källkopplingar`;
}
async function run(){
  $("summary").textContent="Kontrollerar Studio och moduler …";
  $("refresh").disabled=true;
  try{
    const results=await auditIntegrations({baseUrl:import.meta.url});
    render(results);
  }catch(error){
    $("summary").textContent="Kontrollen kunde inte starta";
    $("results").textContent=error instanceof Error?error.message:String(error);
  }finally{$("refresh").disabled=false}
}
$("refresh").addEventListener("click",run);
const canvas=document.createElement("canvas");
$("environment").textContent=
  `WebGL: ${canvas.getContext("webgl2")||canvas.getContext("webgl")?"stöds":"saknas"} · Gamepad API: ${"getGamepads" in navigator?"stöds (ansluten handkontroll mäts inte)":"saknas"} · Källkontroll: endast GitHub Preview`;
run();
