/**
 * DuoForge Studio mobile comfort pass.
 * Adds presentation controls around EXISTING Studio and Render World; forwards to
 * original buttons. No scene recreation, new data store, or duplicated engine state.
 */
const MOBILE_STUDIO_QUERY = "(max-width: 720px), (max-height: 500px) and (pointer: coarse)";
const byId = id => document.getElementById(id);
function makeButton(id, label, text){
 const button = document.createElement("button");
 button.id = id;
 button.type = "button";
 button.setAttribute("aria-label", label);
 button.textContent = text;
 return button;
}
export function initMobileStudioComfort(){
 const topbar = document.querySelector(".topbar");
 const actions = topbar?.querySelector(".top-actions");
 const preview = byId("renderWorldOverlay");
 const previewTop = preview?.querySelector(".render-world-top");
 const hud = preview?.querySelector(".render-world-hud");
 if(!topbar || !actions || !previewTop || !hud || byId("mobileRenderOptionsToggle"))return;

 // Compact header: preserve the original save/import/export actions and their listeners.
 const toolbar = document.createElement("div");
 toolbar.className = "mobile-top-controls";
 const save = makeButton("mobileQuickSave","Spara scenen","💾");
 save.title="Spara projekt";save.addEventListener("click",()=>byId("saveProject")?.click());
 const more = makeButton("mobileHeaderMore","Öppna projektkommandon","⋯");
 more.setAttribute("aria-controls","mobileTopActions");
 more.setAttribute("aria-expanded","false");
 actions.id="mobileTopActions";
 const closeHeader=()=>{
  document.body.classList.remove("mobile-header-open");
  more.setAttribute("aria-expanded","false");
 };
 more.addEventListener("click",()=>{
  const opened=document.body.classList.toggle("mobile-header-open");
  more.setAttribute("aria-expanded",String(opened));
 });
 toolbar.append(save,more);topbar.append(toolbar);
 actions.addEventListener("click",e=>{
  if(e.target.closest("button,label,a"))closeHeader();
 });

 // Mobile Render World: one slim line for world, settings and a guaranteed Exit.
 const options=makeButton("mobileRenderOptionsToggle","Fler inställningar för renderad värld","⚙");
 options.setAttribute("aria-controls","renderWorldOverlay");
 options.setAttribute("aria-expanded","false");
 previewTop.append(options);
 const closeOptions=()=>{
  document.body.classList.remove("mobile-preview-options-open");
  options.setAttribute("aria-expanded","false");
  options.textContent="⚙";
 };
 options.addEventListener("click",()=>{
  const opened=document.body.classList.toggle("mobile-preview-options-open");
  options.setAttribute("aria-expanded",String(opened));
  options.textContent=opened?"✕ Inställningar":"⚙";
  if(opened)closeHud();
 });
 // Screenshot captured in Safari showed a large vehicle-test HUD covering the scene.
 // Keep checkpoints visible as a status chip, expand on explicit user request.
 const hudToggle=makeButton("mobileHudDetailsToggle","Visa teststatus och återställning","▾");
 hudToggle.setAttribute("aria-expanded","false");
 hudToggle.setAttribute("aria-controls","renderMissionStatus");
 hud.querySelector(".render-hud-heading")?.append(hudToggle);
 const closeHud=()=>{
  document.body.classList.remove("mobile-hud-expanded");
  hudToggle.setAttribute("aria-expanded","false");
  hudToggle.textContent="▾";
 };
 hudToggle.addEventListener("click",()=>{
  const opened=document.body.classList.toggle("mobile-hud-expanded");
  hudToggle.setAttribute("aria-expanded",String(opened));
  hudToggle.textContent=opened?"▴":"▾";
  if(opened)closeOptions();
 });
 // A scene tap dismisses expanded overlays, while the scene keeps all touch events.
 document.querySelector(".viewport")?.addEventListener("pointerdown",event=>{
  if(event.target.closest(".render-world-top,.render-world-hud,.film-studio-overlay"))return;
  closeOptions();closeHud();closeHeader();
 },{passive:true});
 // Reset overlays on every entry/exit, including indirect entry from a Studio tool.
 let wasActive=false;
 const sync=()=>{
  const active=!preview.hidden;
  if(active!==wasActive){
   closeOptions();closeHud();closeHeader();
   wasActive=active;
  }
 };
 const observer=new MutationObserver(sync);
 observer.observe(preview,{attributes:true,attributeFilter:["hidden"]});
 observer.observe(document.body,{attributes:true,attributeFilter:["class"]});
 sync();
 // When options open and Film Studio launches, prioritize the film editor.
 byId("filmOpen")?.addEventListener("click",closeOptions);
 byId("renderExit")?.addEventListener("click",()=>{closeOptions();closeHud();});
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if(document.body.classList.contains("mobile-preview-options-open"))closeOptions();
  else if(document.body.classList.contains("mobile-hud-expanded"))closeHud();
  else closeHeader();
 });
 const mq=window.matchMedia(MOBILE_STUDIO_QUERY);
 mq.addEventListener?.("change",()=>{
  if(!mq.matches){closeOptions();closeHud();closeHeader();}
 });
}
