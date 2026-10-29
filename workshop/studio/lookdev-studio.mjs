/**
 * DuoForge LookDev: non-destructive film/product lighting for the existing editor.
 * Generated environment stays in the browser; root meshes and GLB are untouched.
 */
import * as THREE from "three";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {lookdevSettings,lookdevShadowExtent} from "./lookdev-presets.mjs";

export function initLookdevStudio({
 renderer,scene,root,ground,grid,sun,skyLight,notify=()=>{},isBusy=()=>false
}={}){
 if(!renderer||!scene||!root||!ground||!grid||!sun||!skyLight)
  throw Error("LookDev requires the existing DuoForge Studio scene and lights");
 const parent=document.querySelector(".sidebar.right-panel")||document.querySelector(".sidebar");
 if(!parent)return null;
 const panel=document.createElement("section");
 panel.id="lookdevStudio";panel.className="panel-section lookdev-studio";
 panel.setAttribute("aria-label","DuoForge LookDev ljus och presentation");
 panel.innerHTML=[
  '<div class="section-heading"><h2>✦ LookDev Studio</h2><span class="mini-pill">PRO LOOK</span></div>',
  '<p class="hint">Fotoljus, PBR-reflektioner och filmiska färgtoner. Ändrar aldrig dina modeller eller GLB-filer.</p>',
  '<label class="field-label" for="lookdevPreset">Ljusmiljö</label>',
  '<select id="lookdevPreset" aria-label="Välj ljusmiljö">',
  '<option value="studio">Graphite Studio · produktljus</option>',
  '<option value="daylight">Soft Daylight · dagsljus</option>',
  '<option value="golden">Golden Hour · filmiskt</option>',
  '<option value="neon">Neon Noir · spelgrafik</option>',
  '</select>',
  '<label class="field-label" for="lookdevExposure">Exponering <output id="lookdevExposureValue" for="lookdevExposure">100%</output></label>',
  '<input id="lookdevExposure" type="range" min="60" max="160" step="5" value="100" aria-label="Justera exponering">',
  '<label class="lookdev-check"><input id="lookdevGrid" type="checkbox"> Visa hjälprutnät</label>',
  '<div class="lookdev-buttons">',
  '<button type="button" id="lookdevEnable" aria-pressed="false" class="accent-outline">✦ Aktivera LookDev</button>',
  '<button type="button" id="lookdevFit">Anpassa skuggor</button>',
  '<button type="button" id="lookdevOff">Normal vy</button>',
  '</div>',
  '<p id="lookdevStatus" class="hint" role="status" aria-live="polite">Redo · aktivera för professionell ljussättning.</p>'
 ].join("");
 parent.insertBefore(panel,parent.firstElementChild);
 const $=id=>panel.querySelector("#"+id);
 const fill=new THREE.DirectionalLight(0xcad8ff,0);
 const rim=new THREE.DirectionalLight(0xffffff,0);
 fill.name="LookDev temporary fill light";rim.name="LookDev temporary rim light";
 fill.position.set(-7,5,3);rim.position.set(-5,7,-7);
 fill.castShadow=false;rim.castShadow=false;
 fill.userData.previewOnly=true;rim.userData.previewOnly=true;
 let active=false,dirty=false,disposed=false,baseline=null,preset="studio",exposure=1,
  showGrid=false,environment=null,failedEnvironment=false;
 function getEnvironment(){
  if(environment||failedEnvironment)return environment?.texture||null;
  const generator=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  try{
   environment=generator.fromScene(room,.035);
   return environment.texture;
  }catch(error){
   failedEnvironment=true;
   console.warn("LookDev reflection fallback:",error);
   return null;
  }finally{room.dispose();generator.dispose()}
 }
 function capture(){
  const camera=sun.shadow.camera;
  return {
   background:scene.background,environment:scene.environment,
   environmentIntensity:scene.environmentIntensity,
   exposure:renderer.toneMappingExposure,
   hemisphere:skyLight.intensity,skyColor:skyLight.color.clone(),
   groundColor:skyLight.groundColor.clone(),
   sunIntensity:sun.intensity,sunColor:sun.color.clone(),sunPosition:sun.position.clone(),
   shadow:{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,
    normalBias:sun.shadow.normalBias,width:sun.shadow.mapSize.x,height:sun.shadow.mapSize.y},
   grid: grid.visible,groundOpacity:ground.material.opacity
  };
 }
 function restore(){
  if(!baseline)return;
  scene.background=baseline.background;
  scene.environment=baseline.environment;
  scene.environmentIntensity=baseline.environmentIntensity;
  renderer.toneMappingExposure=baseline.exposure;
  skyLight.intensity=baseline.hemisphere;
  skyLight.color.copy(baseline.skyColor);
  skyLight.groundColor.copy(baseline.groundColor);
  sun.intensity=baseline.sunIntensity;
  sun.color.copy(baseline.sunColor);sun.position.copy(baseline.sunPosition);
  sun.shadow.normalBias=baseline.shadow.normalBias;
  const camera=sun.shadow.camera;
  camera.left=baseline.shadow.left;camera.right=baseline.shadow.right;
  camera.top=baseline.shadow.top;camera.bottom=baseline.shadow.bottom;
  camera.updateProjectionMatrix();
  sun.shadow.mapSize.set(baseline.shadow.width,baseline.shadow.height);
  sun.shadow.needsUpdate=true;
  grid.visible=baseline.grid;
  ground.material.opacity=baseline.groundOpacity;
  scene.remove(fill,rim);
  baseline=null;
 }
 function fitShadows(){
  const box=new THREE.Box3().setFromObject(root);
  const extent=lookdevShadowExtent(box);
  const camera=sun.shadow.camera;
  camera.left=-extent;camera.right=extent;camera.top=extent;camera.bottom=-extent;
  camera.updateProjectionMatrix();
  sun.shadow.normalBias=.007;
  sun.shadow.mapSize.set(Math.min(window.devicePixelRatio||1,1.5)>=1.5?1536:1024,
   Math.min(window.devicePixelRatio||1,1.5)>=1.5?1536:1024);
  sun.shadow.needsUpdate=true;
  return extent;
 }
 function apply(){
  if(!active){restore();dirty=false;return}
  if(isBusy())return;
  if(!baseline)baseline=capture();
  const p=lookdevSettings(preset,exposure);
  const pmrem=getEnvironment();
  scene.background=new THREE.Color(p.background);
  if(pmrem)scene.environment=pmrem;
  scene.environmentIntensity=p.environment;
  renderer.toneMappingExposure=p.exposure;
  skyLight.intensity=p.hemisphere;
  skyLight.color.setHex(p.sky);
  skyLight.groundColor.setHex(p.ground);
  sun.color.setHex(p.key);sun.intensity=p.keyPower;
  sun.position.fromArray(p.keyPosition);
  fill.color.setHex(p.fill);fill.intensity=p.fillPower;
  rim.color.setHex(p.rim);rim.intensity=p.rimPower;
  if(!fill.parent)scene.add(fill);
  if(!rim.parent)scene.add(rim);
  ground.material.opacity=p.shadow;
  grid.visible=showGrid&&baseline.grid;
  fitShadows();
  $("lookdevEnable").setAttribute("aria-pressed","true");
  $("lookdevEnable").textContent="✦ LookDev aktiv";
  $("lookdevStatus").textContent=p.name+" · PBR "+(pmrem?"miljöreflektioner":"utan PMREM")+
   " · full modellgeometri · skuggor anpassade";
  dirty=false;
 }
 function setActive(value){
  if(disposed)return;
  active=Boolean(value);dirty=true;
  $("lookdevEnable").setAttribute("aria-pressed",String(active));
  if(!active){
   $("lookdevEnable").textContent="✦ Aktivera LookDev";
   $("lookdevStatus").textContent="Normal vy · originalbelysningen återställs.";
  }
  if(isBusy()){
   $("lookdevStatus").textContent="Ljusändringen väntar tills förhandsvisningen avslutas.";
  }else apply();
 }
 $("lookdevEnable").onclick=()=>setActive(!active);
 $("lookdevOff").onclick=()=>setActive(false);
 $("lookdevPreset").onchange=e=>{preset=e.target.value;dirty=true;if(active&&!isBusy())apply()};
 $("lookdevExposure").oninput=e=>{
  exposure=Number(e.target.value)/100;
  $("lookdevExposureValue").textContent=e.target.value+"%";
  dirty=true;if(active&&!isBusy())apply();
 };
 $("lookdevGrid").onchange=e=>{
  showGrid=Boolean(e.target.checked);dirty=true;if(active&&!isBusy())apply();
 };
 $("lookdevFit").onclick=()=>{
  if(!active){notify("Aktivera LookDev först.");return}
  if(isBusy()){notify("Avsluta förhandsvisningen för att anpassa skuggorna.");return}
  const extent=fitShadows();
  $("lookdevStatus").textContent="Skuggor anpassade till modellen · frustum ±"+extent+" m";
 };
 function update(){if(!disposed&&dirty&&!isBusy())apply()}
 function dispose(){
  if(disposed)return;
  // Do not mutate another active renderer on page unload.
  if(!isBusy())restore();
  disposed=true;environment?.dispose();environment=null;
  scene.remove(fill,rim);panel.remove();
  window.removeEventListener("pagehide",dispose);
 }
 window.addEventListener("pagehide",dispose,{once:true});
 return Object.freeze({update,dispose,get active(){return active}});
}
