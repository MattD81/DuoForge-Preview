// DuoForge Shape DNA Lab: selected meshes, deterministic candidate search, safe GLB mesh detail.
// No AI model, external fetch, hidden image upload, new platform or background computation.
import * as THREE from "three";
import {evolveSurface,inspectMeshData,proposeSeeds,SHAPE_DNA_VERSION} from "./shape-dna-core.mjs";

const MAX_TOTAL_VERTICES=95000;
const blocked=/eye|ögon|öga|pupil|glow|ljus|glas|glass|mouth|tand|tooth|silver|gold|krom|chrome|emissive|eye socket|öppning|uvula/i;
function surfaceKind(o,requested){
 if(requested!=="auto")return requested;
 const name=(o.name||"")+" "+(o.parent?.name||"");
 if(blocked.test(name))return null;
 const mat=Array.isArray(o.material)?o.material[0]:o.material;
 const kind=String(mat?.userData?.duoforgeSurface||"");
 if(/slott|castle|golem|sten|rock|mur|brick|rubble|fortress/i.test(name)||["stone","brick","concrete"].includes(kind))return "stone";
 if(/wood|forest|tree|root|bark|gren|trä|rot|branch/i.test(name)||["wood","bark"].includes(kind))return "bark";
 if(/snake|scal|orm|fjäll|serpent|dragon/i.test(name))return "scales";
 if(/hud|skin|arm|leg|body|torso|cloth|mantel|robe|muscle|bröst|bål|huva/i.test(name)||["leather","grass"].includes(kind))return "organic";
 return "organic";
}
function eligibleMeshes(object,kind){
 const all=[];object.traverse(o=>{
  if(!o.isMesh||!o.visible||!o.geometry?.attributes?.position)return;
  const p=o.geometry.attributes.position;
  if(p.isInterleavedBufferAttribute||p.itemSize!==3||p.count<80)return;
  const type=surfaceKind(o,kind);
  if(!type)return;
  all.push({mesh:o,kind:type});
 });
 const vertices=all.reduce((n,x)=>n+x.mesh.geometry.attributes.position.count,0);
 if(vertices>MAX_TOTAL_VERTICES)throw Error("Modellen har "+vertices.toLocaleString("sv-SE")+" punkter. Shape DNA begränsar bearbetning till "+MAX_TOTAL_VERTICES.toLocaleString("sv-SE")+" på mobilen. Markera en mindre del.");
 if(!all.length)throw Error("Hittade inga lämpliga meshytor. Välj en modell eller en detaljrik mesh (minst 80 punkter).");
 return {all,vertices};
}
function snapshotMeshData(eligible){
 return eligible.map(({mesh,kind})=>{
  const g=mesh.geometry,pos=g.attributes.position,index=g.index;
  // New typed arrays ensure a candidate never mutates imported geometry.
  const positions=new Float32Array(pos.array);
  const normals=g.attributes.normal?.itemSize===3&&!g.attributes.normal.isInterleavedBufferAttribute?
   new Float32Array(g.attributes.normal.array):null;
  return {mesh,kind,source:g,positions,normals,indices:index?new Uint32Array(index.array):null,
   uv:g.attributes.uv?.array||null};
 });
}
function evaluate(snapshot,seed,intensity){
 let sum=0,weight=0,maxFlip=0,maxShift=0;
 const assets=[];
 for(const data of snapshot){
  const result=evolveSurface({positions:data.positions,normals:data.normals,indices:data.indices,
   uv:data.uv,kind:data.kind,seed,intensity});
  assets.push({mesh:data.mesh,source:data.source,kind:data.kind,result});
  const w=result.report.vertices;weight+=w;sum+=result.report.fitness*w;
  maxFlip=Math.max(maxFlip,result.report.flipFraction);maxShift=Math.max(maxShift,result.report.relativeShift);
 }
 return {seed,assets,fitness:Math.round(sum/Math.max(1,weight)),maxFlip,maxShift,
  changed:assets.filter(x=>x.result.report.maxShift>1e-9).length};
}
export function initShapeDnaLab({root,getSelected,notify,pushHistory,dirty,refreshTree,updateStats,updateInspector}){
 const sidebar=document.querySelector(".sidebar.left-panel");
 if(!sidebar||document.getElementById("shapeDnaLab"))return;
 const panel=document.createElement("section");panel.id="shapeDnaLab";panel.className="panel-section shape-dna-panel";
 panel.innerHTML=[
  '<div class="section-heading"><h2>🧬 Shape DNA Lab</h2><span class="mini-pill">Experiment V1</span></div>',
  '<p class="hint">Förädla vald 3D-modell med fraktal ytrelief som följer form och material. Tre lokala varianter, geometrikontroll och ett klick för att välja. Ingen extern AI.</p>',
  '<label class="field-label" for="dnaKind">Materialets mikrostruktur</label>',
  '<select id="dnaKind"><option value="auto">Automatisk • analyserar meshdelar</option><option value="stone">Sten • sprickor</option><option value="bark">Bark • fibrer</option><option value="organic">Organisk • hud/tyg</option><option value="scales">Fjäll • orm/drake</option></select>',
  '<label class="field-label" for="dnaSeed">DNA-frö (samma frö ger samma form)</label>',
  '<input id="dnaSeed" type="number" min="1" max="2147483646" step="1" value="2026">',
  '<label class="range-line">Ytstruktur <input id="dnaIntensity" type="range" min=".08" max="1" step=".04" value=".52"><output id="dnaIntensityOut">52 %</output></label>',
  '<div class="row two"><button id="dnaInspect">360°-geometrikoll</button><button id="dnaEvolve" class="accent">⚡ Testa 3 DNA-varianter</button></div>',
  '<p id="dnaStatus" role="status" class="hint">Markera en 3D-modell i objektträdet. Alla beräkningar sker i webbläsaren.</p>',
  '<div id="dnaResults" class="dna-results" aria-live="polite"></div>',
  '<p class="hint">Testpoängen avser <b>geometrisk stabilitet</b>, inte konstnärlig kvalitet. Riggvikter/UV förblir kvar på originalmeshen. För högfidelitet från foto krävs även 3D-rekonstruktion och retopologi.</p>'
 ].join("");
 const existing=document.getElementById("characterForge");
 if(existing)existing.insertAdjacentElement("afterend",panel);
 else sidebar.append(panel);
 const $=id=>panel.querySelector("#"+id);
 let busy=false,selection=null,plans=[];
 function clearResults(){plans=[];selection=null;$("dnaResults").replaceChildren();}
 $("dnaIntensity").oninput=()=>{$("dnaIntensityOut").textContent=Math.round(Number($("dnaIntensity").value)*100)+" %";clearResults()};
 $("dnaKind").onchange=clearResults;$("dnaSeed").oninput=clearResults;
 function status(s){$("dnaStatus").textContent=s;}
 function baseSelection(){
  const selected=getSelected();
  if(!selected||!selected.parent)throw Error("Markera först ett objekt eller en modell i scenträdet.");
  const data=eligibleMeshes(selected,$("dnaKind").value);
  return {selected,data};
 }
 $("dnaInspect").onclick=()=>{
  clearResults();
  try{
   const {selected,data}=baseSelection();
   const meshes=data.all.map(x=>inspectMeshData(x.mesh.geometry.attributes.position.array,
     x.mesh.geometry.index?.array||null,x.mesh.geometry.attributes.uv?.array||null));
   const tris=meshes.reduce((n,x)=>n+x.triangles,0),uv=meshes.filter(x=>x.hasUV).length;
   const skinny=meshes.filter(x=>x.depthRatio<.025).length;
   let skinned=0;selected.traverse(o=>{if(o.isSkinnedMesh)skinned++;});
   status("6-riktningskontroll (geometrins xyz-utbredning): "+data.all.length+" meshar / "+
    data.vertices.toLocaleString("sv-SE")+" punkter / "+tris.toLocaleString("sv-SE")+
    " trianglar. UV: "+uv+"/"+meshes.length+" · mycket tunna lokala meshar: "+skinny+
    " · skinnade delar: "+skinned+". Detta är en dimensionsanalys, inte 6 renderade kamerabilder.");
  }catch(err){status(err.message);notify(err.message,5000)}
 };
 function makeButton(plan,label){
  const button=document.createElement("button");button.type="button";
  button.className="dna-pick";button.textContent=label;
  button.onclick=()=>{
   if(busy)return;
   if(selection!==getSelected()||!selection?.parent){status("Markeringen har ändrats. Kör analysen igen.");clearResults();return}
   // Atomic check before any commit: all geometry is still the same source.
   if(plan.assets.some(a=>a.mesh.geometry!==a.source||!a.mesh.parent)){
    status("Meshens geometri har ändrats. Generera nya kandidater.");clearResults();return;
   }
   if(!plan.changed){status("Den här varianten gav ingen säker synlig förändring.");return}
   try{
    pushHistory();
    for(const a of plan.assets){
     const geo=a.source.clone();geo.setAttribute("position",new THREE.Float32BufferAttribute(a.result.positions,3));
     geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
     a.mesh.geometry=geo;
     a.mesh.userData.duoforgeShapeDNA={version:SHAPE_DNA_VERSION,seed:plan.seed,
      kind:a.kind,technicalFitness:plan.fitness,originalGeometry:a.source.uuid};
    }
    dirty();updateStats();updateInspector();refreshTree();
    status("Variant "+plan.seed+" tillämpad på "+plan.changed+" meshar. GLB exporteras i toppmenyn. Ångra återställer tidigare form.");
    notify("Shape DNA-variant "+plan.seed+" applicerad — ingen AI-kostnad.",4400);
    clearResults();
   }catch(err){console.error(err);status(err.message);notify(err.message,6000)}
  };
  return button;
 }
 $("dnaEvolve").onclick=async()=>{
  if(busy)return;
  clearResults();
  let selected,snapshot;
  try{
   const data=baseSelection();selected=data.selected;snapshot=snapshotMeshData(data.data.all);
   selection=selected;
   busy=true;$("dnaEvolve").disabled=true;$("dnaInspect").disabled=true;
   const intensity=Number($("dnaIntensity").value);
   const seeds=proposeSeeds(Number($("dnaSeed").value));
   for(let i=0;i<3;i++){
    status("Beräknar yta "+(i+1)+"/3 … Inga bilder eller filer laddas upp.");
    // Yield to UI to keep the phone responsive between CPU-bound candidates.
    await new Promise(resolve=>setTimeout(resolve,0));
    plans.push(evaluate(snapshot,seeds[i],intensity));
   }
   plans.sort((a,b)=>b.fitness-a.fitness);
   for(let i=0;i<plans.length;i++){
    const p=plans[i],box=document.createElement("div");box.className="dna-result";
    const label=i===0?"Rekommenderad":"Alternativ "+(i+1);
    const heading=document.createElement("strong");heading.textContent=label+" · DNA "+p.seed;
    const hint=document.createElement("small");hint.textContent="Geometrisk stabilitet "+p.fitness+"/100 · "+
     p.changed+" ytor ändras · max "+(p.maxShift*100).toFixed(2)+" % av lokal diagonal";
    box.append(heading,hint,makeButton(p,"Använd "+label.toLowerCase()));$("dnaResults").append(box);
   }
   status("Tre förändringar beräknade. Välj variant; ingen geometri har ändrats ännu.");
  }catch(err){clearResults();status("Shape DNA: "+err.message);notify(err.message,5000)}
  finally{busy=false;$("dnaEvolve").disabled=false;$("dnaInspect").disabled=false}
 };
}
