import {route3D,filter3D} from "./advisor.mjs";
const $=id=>document.getElementById(id);
const create=(tag,cls="",txt="")=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=txt;return el};
const catNames={"allow":"Källa kontrollerad","review":"Licensgranskning krävs","blocked_eu":"Blockerad inom EU"};
let kb=null;
function showCards(){
 if(!kb)return;
 const items=filter3D(kb,{search:$("search").value,area:$("category").value,showBlocked:$("showBlocked").checked});
 $("count").textContent=items.length+" av "+kb.techniques.length+" tekniker";
 const list=$("cards");list.replaceChildren();
 if(!items.length){list.append(create("p","", "Inga tekniker matchade sökningen."));return}
 for(const t of items){
  const card=create("article","card");card.append(create("h3","",t.title));
  const meta=create("div","meta");meta.append(create("span","tag",t.area));
  meta.append(create("span","tag "+(t.licenseStatus==="blocked_eu"?"danger":t.licenseStatus==="review"?"risk":""),catNames[t.licenseStatus]));
  card.append(meta,create("p","",t.goal),create("p","limitation","Begränsning: "+t.limitation),create("p","","Licens: "+t.license));
  const link=create("a","","Läs primärkällan ↗");link.href=t.sources[0];link.rel="noopener noreferrer";link.target="_blank";card.append(link);list.append(card);
 }
}
function advise(){
 if(!kb)return;
 const result=route3D($("prompt").value,kb);
 const out=$("recommendation");out.replaceChildren();
 out.append(create("b","","Rekommenderad kedja:"));
 const list=create("ol");
 for(const t of result.techniques){const item=create("li");item.append(create("strong","",t.title));item.append(create("span",""," — "+t.goal));list.append(item)}
 out.append(list);
 out.append(create("p","",result.caveat));
 if(result.requiresGPU)out.append(create("p","","OBS: Externa verktyg i listan är forskningsalternativ, inte installerade på GitHub Pages. Kör inget utan uttryckligt val och kontroll av GPU/licens."));
}
async function start(){
 try{
  const r=await fetch("./knowledge.json",{cache:"no-cache"});if(!r.ok)throw Error("HTTP "+r.status);
  const value=await r.json();if(!value?.techniques?.length)throw Error("Tom katalog");
  kb=value;
  const areas=[...new Set(kb.techniques.map(t=>t.area))].sort((a,b)=>a.localeCompare(b,"sv"));
  for(const label of areas){const o=document.createElement("option");o.value=o.textContent=label;$("category").append(o)}
  $("search").oninput=showCards;$("category").onchange=showCards;$("showBlocked").onchange=showCards;
  $("advise").onclick=advise;$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter")advise()});
  for(const btn of document.querySelectorAll("[data-example]"))btn.addEventListener("click",()=>{$("prompt").value=btn.dataset.example;advise()});
  showCards();
 }catch(e){$("count").textContent="Laddningsfel";$("cards").append(create("p","", "Kunskapsdatabasen kunde inte laddas: "+e.message))}
}
start();
