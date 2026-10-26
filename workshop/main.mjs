import * as THREE from "https://esm.sh/three@0.186.1";
import {GLTFLoader} from "https://esm.sh/three@0.186.1/examples/jsm/loaders/GLTFLoader.js";
const $=id=>document.getElementById(id), canvas=$("scene"), status=$("status");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x182035);
const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x52617a,2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(5,8,9);scene.add(sun);
const camera=new THREE.PerspectiveCamera(50,1,.01,1000);camera.position.set(5,4,7);camera.lookAt(0,0,0);
const grid=new THREE.GridHelper(16,16,0x4b6179,0x34415a);scene.add(grid);
let model=null,modelUrl=null, config=null;const keys=["mass","radius","suspension"];
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener("resize",resize);resize();
function draw(){requestAnimationFrame(draw);renderer.render(scene,camera)}draw();
function defaultConfig(name){return {schema:"duoforge-vehicle@1",name,model:{uri:"Coastal_Buggy_Pro.glb",upAxis:"Y",forwardAxis:"+Z",unit:"m",rotationDeg:[0,0,0]},wheels:[["front_L",true],["front_R",true],["rear_L",false],["rear_R",false]].map(([id,steer])=>({id,mesh:"wheel_"+id+"_tire",pivot:[0,0,0],steer,drive:!steer})),driverSeat:[0,0,1],physics:{massKg:820,wheelRadiusM:.45,suspensionTravelM:.22},version:1}}
function setStatus(s){status.textContent=s}
function orientModel(){
 if(!model||!config)return;
 const deg=config.model.rotationDeg||[0,0,0];
 model.position.set(0,0,0);
 model.rotation.set(...deg.map(v=>THREE.MathUtils.degToRad(v)));
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);
 const center=bounds.getCenter(new THREE.Vector3());
 // Geometry may be offset from its origin; center the rotated result, not the unrotated one.
 model.position.set(-center.x,-bounds.min.y,-center.z);
 model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
 const radius=Math.max(size.length(),1);
 camera.position.set(radius*.8,radius*.65,radius*1.1);
 camera.lookAt(0,size.y*.42,0);
 camera.updateProjectionMatrix();
 $("orientation").textContent="Rotation X/Y/Z: "+deg.join("° / ")+"°";
}
document.querySelectorAll("[data-rotate]").forEach(button=>button.addEventListener("click",()=>{
 if(!model||!config)return setStatus("Importera en GLB först.");
 const axis=Number(button.dataset.rotate),deg=config.model.rotationDeg||[0,0,0];
 deg[axis]=(deg[axis]+90)%360;config.model.rotationDeg=deg;orientModel();
 setStatus("Modellen roterad. Spara inställningar för att behålla läget.");
}));
$("resetRotation").onclick=()=>{if(!model||!config)return;config.model.rotationDeg=[0,0,0];orientModel();};
$("autoRotation").onclick=()=>{if(!model||!config)return;config.model.rotationDeg=guessVehicleRotation(model);orientModel();setStatus("Föreslagen fordonsorientering applicerad. Kontrollera hjulen och justera vid behov.");};
function guessVehicleRotation(root){
 // Evaluate all six quarter-turn orientations (plus 180 flips), choosing a
 // horizontal vehicle with wheels below its body when wheel geometry is detectable.
 const original=root.rotation.clone(),originalPosition=root.position.clone();
 const wheels=[];root.traverse(n=>{if(n.isMesh&&/wheel|tire|hjul|dack|tyre/i.test(n.name)){const b=new THREE.Box3().setFromObject(n);if(!b.isEmpty())wheels.push(b.getCenter(new THREE.Vector3()));}});
 const options=[];for(const x of [0,90,180,270])for(const y of [0,90,180,270])for(const z of [0,90,180,270])options.push([x,y,z]);
 let best=[0,0,0],bestScore=-Infinity;
 for(const angles of options){
  root.position.set(0,0,0);root.rotation.set(...angles.map(THREE.MathUtils.degToRad));root.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(root),size=b.getSize(new THREE.Vector3());
  if(!size.length())continue;
  // Strongly prefer the smallest vertical extent for vehicles.
  let score=-(size.y/Math.max(size.x,size.z,0.001))*10;
  if(wheels.length>=2){
   const wheelCenters=[];root.traverse(n=>{if(n.isMesh&&/wheel|tire|hjul|dack|tyre/i.test(n.name)){const wb=new THREE.Box3().setFromObject(n);wheelCenters.push(wb.getCenter(new THREE.Vector3()));}});
   if(wheelCenters.length){const avg=wheelCenters.reduce((sum,v)=>sum+v.y,0)/wheelCenters.length;score+=(b.getCenter(new THREE.Vector3()).y-avg)*2/Math.max(size.y,.001);}
  }
  // Prefer no extra rotation when candidates are otherwise equivalent.
  score-=angles.filter(a=>a!==0).length*.005;
  if(score>bestScore){bestScore=score;best=angles;}
 }
 root.rotation.copy(original);root.position.copy(originalPosition);root.updateMatrixWorld(true);
 return best;
}
function syncForm(){if(!config)return;$("name").value=config.name;$("mass").value=config.physics.massKg;$("radius").value=config.physics.wheelRadiusM;$("suspension").value=config.physics.suspensionTravelM}
function readForm(){if(!config)throw Error("Importera en GLB först");config.name=$("name").value.trim();config.physics.massKg=Number($("mass").value);config.physics.wheelRadiusM=Number($("radius").value);config.physics.suspensionTravelM=Number($("suspension").value);if(!config.name||config.physics.massKg<=0||config.physics.wheelRadiusM<=0||config.physics.suspensionTravelM<0||!keys.every(k=>Number.isFinite(Number($(k).value))))throw Error("Kontrollera fordonsinställningarna")}
$("file").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;if(!file.name.toLowerCase().endsWith(".glb"))return setStatus("Endast .glb stöds.");if(modelUrl)URL.revokeObjectURL(modelUrl);modelUrl=URL.createObjectURL(file);setStatus("Läser GLB…");try{const gltf=await new GLTFLoader().loadAsync(modelUrl);if(model)scene.remove(model);model=gltf.scene;const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());if(!Number.isFinite(size.length())||size.length()===0)throw Error("Modellen har ingen synlig geometri");scene.add(model);const names=new Set();model.traverse(n=>{if(n.name)names.add(n.name)});config=defaultConfig(file.name.replace(/\.glb$/i,""));config.model.uri=file.name;const saved=localStorage.getItem("duoforge:vehicle:"+file.name);if(saved){try{const parsed=JSON.parse(saved);if(parsed.schema===config.schema)config=parsed}catch{}}config.model.rotationDeg=Array.isArray(config.model.rotationDeg)&&config.model.rotationDeg.length===3?config.model.rotationDeg:guessVehicleRotation(model);if(!saved)config.model.rotationDeg=guessVehicleRotation(model);orientModel();const found=config.wheels.filter(w=>names.has(w.mesh));syncForm();setStatus("GLB inläst: "+file.name+"\nIdentifierade hjul: "+found.length+"/4"+(found.length<4?"\nTilldela hjulnamn i modellen innan spel-export.":""));}catch(err){setStatus("Kunde inte läsa GLB: "+err.message)}})
$("save").onclick=()=>{try{readForm();localStorage.setItem("duoforge:vehicle:"+config.model.uri,JSON.stringify(config));setStatus("Inställningar sparade lokalt. GLB-filen sparas inte.")}catch(e){setStatus(e.message)}};
$("export").onclick=()=>{try{readForm();const blob=new Blob([JSON.stringify(config,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="vehicle-config.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setStatus(e.message)}};
