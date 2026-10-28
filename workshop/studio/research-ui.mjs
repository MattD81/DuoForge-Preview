import {auditScene,checkWebGPU} from "./research-performance.mjs";

export function initResearchPanel({root,toGLB,download,safeFilename,notify}){
 const $=id=>document.getElementById(id);
 const audit=$("researchAudit"),mobile=$("exportMobileGLB");
 if(!audit||!mobile)return;
 const format=n=>n.toLocaleString("sv-SE");
 function updateAudit(){
  const r=auditScene(root);
  $("researchAuditSummary").textContent=`${format(r.triangles)} trianglar · ${r.meshes} meshar · ${r.materials} material · ${r.textureCount} texturer · ${r.skinned} riggade`;
  $("researchAuditWarnings").textContent=r.issues.length?r.issues.join(" "):
   "Inga budgetvarningar. Kontrollera även FPS, filstorlek och bildkvalitet på din måltelefon.";
  return r;
 }
 audit.addEventListener("click",updateAudit);
 mobile.addEventListener("click",async()=>{
  if(mobile.disabled)return;
  mobile.disabled=true;
  try{
   updateAudit();
   notify("Exporterar mobilprofil – originalet lämnas oförändrat …",7000);
   const blob=await toGLB(1024);
   download(safeFilename()+"-mobil.glb",blob);
   notify("Mobil-GLB klar ("+(blob.size/1024).toFixed(0)+" kB). Kontrollera storlek och bild i spelet.",4500);
  }catch(error){
   console.error(error);notify("Mobil-GLB misslyckades: "+error.message,5500);
  }finally{mobile.disabled=false;}
 });
 updateAudit();
 checkWebGPU().then(gpu=>{
  $("researchGpuStatus").textContent=gpu.detail+" · aktiv studiorenderare: WebGL";
 }).catch(()=>{$("researchGpuStatus").textContent="Aktiv studiorenderare: WebGL";});
 return {updateAudit};
}
