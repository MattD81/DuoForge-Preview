// DuoForge Studio Mobile Builder UX V1.
// One scene, one set of existing controls: the mobile drawer never duplicates project state.
// Compatible with portrait phones and short landscape/coarse-pointer screens; desktop untouched.
const mobileQuery=window.matchMedia("(max-width: 720px), (max-height: 500px) and (pointer: coarse)");
const targets={
 create:{title:"✦ Skapa 3D",side:"left",default:"#characterForge",
  shortcuts:[["Karaktär","#characterForge"],["Värld","#worldBuilderPanel"],["Former",".primitive-grid"],["Bibliotek","#library"]]},
 scene:{title:"▤ Objekt & historik",side:"left",default:".left-panel > .panel-section",
  shortcuts:[["Objekt","#hierarchy"],["Ångra","#undo"],["Gör om","#redo"]]},
 material:{title:"◈ Material & texturer",side:"right",default:"#materialLabPanel",
  shortcuts:[["PBR-material","#materialLabPanel"],["Färg","#surfaceTint"]]},
 dna:{title:"🧬 Shape DNA",side:"left",default:"#shapeDnaLab",
  shortcuts:[["DNA-varianter","#shapeDnaLab"],["Karaktär","#characterForge"]]},
 adjust:{title:"⚙ Redigera & exportera",side:"right",default:".right-panel > .panel-section",
  shortcuts:[["Justera",".right-panel > .panel-section"],["Skulptera","#sculptPanel"],["Testa","#renderWorldControls"],["Export",".right-panel .panel-section:last-child"]]}
};
const $=id=>document.getElementById(id);
export function initStudioMobileUX(){
 if($("mobileStudioDock"))return;
 const left=document.querySelector(".left-panel"),right=document.querySelector(".right-panel");
 const viewport=document.querySelector(".viewport"),topbar=document.querySelector(".topbar");
 if(!left||!right||!viewport||!topbar)return;
 left.id="mobileLeftEditor";right.id="mobileRightEditor";
 const sides={left,right};
 for(const [key,sidebar] of Object.entries(sides)){
  const head=document.createElement("div");
  head.className="mobile-sheet-head";
  head.innerHTML='<div class="mobile-sheet-head-text"><strong class="mobile-sheet-title"></strong><small class="mobile-sheet-hint">Dra i 3D-vyn för att rotera · nyp för zoom</small></div><div class="mobile-sheet-head-actions"><button type="button" class="mobile-sheet-undo" aria-label="Ångra">↶</button><button type="button" class="mobile-sheet-redo" aria-label="Gör om">↷</button><button type="button" class="mobile-sheet-close" aria-label="Visa större 3D-yta">⌄</button></div><div class="mobile-sheet-shortcuts" role="group" aria-label="Snabbval"></div>';
  sidebar.prepend(head);
  head.querySelector(".mobile-sheet-undo").onclick=()=> $("undo")?.click();
  head.querySelector(".mobile-sheet-redo").onclick=()=> $("redo")?.click();
  head.querySelector(".mobile-sheet-close").onclick=()=>setDrawerOpen(false);
 }
 const dock=document.createElement("nav");
 dock.id="mobileStudioDock";dock.className="mobile-studio-dock";
 dock.setAttribute("aria-label","Mobil verkstad");
 const tabs=[["create","✦","Skapa"],["scene","▤","Objekt"],["material","◈","Material"],["dna","🧬","DNA"],["adjust","⚙","Justera"]];
 for(const [key,icon,label] of tabs){
  const b=document.createElement("button");b.type="button";b.dataset.mobileTab=key;
  b.setAttribute("aria-label",label+" i mobilverkstaden");b.setAttribute("aria-pressed","false");
  b.innerHTML='<span aria-hidden="true">'+icon+'</span><small>'+label+'</small>';
  b.onclick=()=>{if(active===key&&open){setDrawerOpen(false);return}activate(key,true)};
  dock.append(b);
 }
 const preview=document.createElement("button");preview.type="button";preview.id="mobilePreviewToggle";
 preview.setAttribute("aria-label","Växla mellan 3D-förhandsvisning och verktyg");
 preview.innerHTML='<span aria-hidden="true">⛶</span><small>Visa 3D</small>';
 preview.onclick=()=>setDrawerOpen(!open);
 dock.append(preview);
 document.body.append(dock);
 const quick=document.createElement("div");quick.className="mobile-canvas-actions";
 quick.setAttribute("role","group");quick.setAttribute("aria-label","Snabba 3D-kommandon");
 for(const [id,label,icon] of [["undo","Ångra","↶"],["redo","Gör om","↷"],["focusSelection","Fokusera modellen","◎"]]){
  const b=document.createElement("button");b.type="button";b.className="mobile-canvas-action";b.dataset.forward=id;
  b.title=label;b.setAttribute("aria-label",label);b.textContent=icon;
  b.onclick=()=>$(id)?.click();
  quick.append(b);
 }
 viewport.append(quick);
 let active="create",open=!(window.innerWidth>window.innerHeight&&window.innerHeight<500);
 const headerObserver=new ResizeObserver(entries=>{
  if(mobileQuery.matches&&entries[0]){
   const height=entries[0].target.getBoundingClientRect().height;
   document.documentElement.style.setProperty("--mobile-studio-header",Math.ceil(height)+"px");
  }
 });
 headerObserver.observe(topbar);
 function scrollTarget(selector,side){
  const sidebar=sides[side];
  const item=document.querySelector(selector);
  if(!item||!sidebar.contains(item))return;
  const box=sidebar.getBoundingClientRect(),target=item.getBoundingClientRect();
  const head=sidebar.querySelector(".mobile-sheet-head");
  const next=Math.max(0,sidebar.scrollTop+target.top-box.top-(head?.offsetHeight||0)-10);
  sidebar.scrollTo({top:next,behavior:"auto"});
 }
 function activate(key,reveal=false,selector=null){
  if(!targets[key])return;
  active=key;
  if(reveal)open=true;
  sync();
  if(open&&mobileQuery.matches)
    requestAnimationFrame(()=>scrollTarget(selector||targets[key].default,targets[key].side));
 }
 function setDrawerOpen(value){open=Boolean(value);sync();
  if(open)requestAnimationFrame(()=>scrollTarget(targets[active].default,targets[active].side));
 }
 function sync(){
  const mobile=mobileQuery.matches;
  document.body.classList.toggle("mobile-sheet-open",mobile&&open);
  for(const [id,sidebar] of Object.entries(sides)){
   const isActive=mobile&&open&&targets[active].side===id;
   sidebar.dataset.mobileActive=String(isActive);
   if(mobile)sidebar.setAttribute("aria-hidden",String(!isActive));
   else sidebar.removeAttribute("aria-hidden");
  }
  for(const b of dock.querySelectorAll("[data-mobile-tab]")){
   b.setAttribute("aria-pressed",String(open&&active===b.dataset.mobileTab));
  }
  preview.setAttribute("aria-pressed",String(!open));
  preview.querySelector("small").textContent=open?"Visa 3D":"Verktyg";
  preview.title=open?"Minimera verktyg och visa större 3D":"Öppna mobilverktygen";
  const cfg=targets[active],sidebar=sides[cfg.side],head=sidebar.querySelector(".mobile-sheet-head");
  head.querySelector(".mobile-sheet-title").textContent=cfg.title;
  const shortcutRow=head.querySelector(".mobile-sheet-shortcuts");
  shortcutRow.replaceChildren();
  for(const [label,selector] of cfg.shortcuts){
   if(!document.querySelector(selector))continue;
   const button=document.createElement("button");button.type="button";button.textContent=label;
   button.onclick=()=>{
    if(selector==="#undo"||selector==="#redo"){$(selector.slice(1))?.click();return;}
    scrollTarget(selector,cfg.side);
   };
   shortcutRow.append(button);
  }
  if(mobile){
   const height=topbar.getBoundingClientRect().height;
   document.documentElement.style.setProperty("--mobile-studio-header",Math.ceil(height)+"px");
  }
  updateUndo();
 }
 function updateUndo(){
  const buttons={undo:$("undo"),redo:$("redo")};
  for(const [id,original] of Object.entries(buttons))
   for(const forwarded of [...document.querySelectorAll(".mobile-sheet-"+id),...quick.querySelectorAll('[data-forward="'+id+'"]')])
    forwarded.disabled=Boolean(original?.disabled);
 }
 const undo=$("undo"),redo=$("redo");
 if(undo&&redo){
  const obs=new MutationObserver(updateUndo);
  obs.observe(undo,{attributes:true,attributeFilter:["disabled"]});
  obs.observe(redo,{attributes:true,attributeFilter:["disabled"]});
 }
 mobileQuery.addEventListener("change",()=>{
  // Desktop reverts to original two-panel editor without reparenting any content.
  if(mobileQuery.matches&&window.innerHeight<500)open=false;
  sync();
 });
 window.addEventListener("orientationchange",()=>requestAnimationFrame(sync));
 sync();
}
