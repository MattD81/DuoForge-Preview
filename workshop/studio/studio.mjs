import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TransformControls} from "three/addons/controls/TransformControls.js";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {GLTFExporter} from "three/addons/exporters/GLTFExporter.js";

const $=id=>document.getElementById(id);
const canvas=$("scene");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x101d30);
const camera=new THREE.PerspectiveCamera(48,1,.01,3000);
camera.position.set(7,5,9);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
scene.add(new THREE.HemisphereLight(0xffffff,0x344964,2.15));
const sun=new THREE.DirectionalLight(0xffffff,2.55);
sun.position.set(8,14,7);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-25;sun.shadow.camera.right=25;
sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
sun.shadow.normalBias=.02;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.2}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(200,100,0x456077,0x273b54);grid.position.y=.005;scene.add(grid);
const axes=new THREE.AxesHelper(3);axes.visible=false;scene.add(axes);
const root=new THREE.Group();root.name="DuoForge Studio";scene.add(root);
const orbit=new OrbitControls(camera,canvas);
orbit.enableDamping=true;orbit.dampingFactor=.075;
orbit.target.set(0,1,0);orbit.minDistance=.15;orbit.maxDistance=1000;
const transform=new TransformControls(camera,canvas);
scene.add(transform.getHelper());
transform.setMode("translate");
transform.addEventListener("dragging-changed",e=>{orbit.enabled=!e.value});
transform.addEventListener("mouseDown",()=>{pushHistory();});
transform.addEventListener("mouseUp",()=>{updateInspector();refreshTree();dirty();});
transform.addEventListener("objectChange",()=>{updateInspector();updateStats();});
const boundsHelper=new THREE.BoxHelper(new THREE.Object3D(),0x4df5c0);
boundsHelper.visible=false;scene.add(boundsHelper);

let selected=null, isDirty=false, projectId=null;
const sculpt={enabled:false,dragging:false,mesh:null};
const past=[],future=[],MAX_HISTORY=35;
const loader=new GLTFLoader(),exporter=new GLTFExporter();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let downPoint=null,toastTimer,viewportTimer;
let inputHistoryArmed=false;

function notify(message,timeout=2700){
 const toast=$("toast");toast.textContent=message;toast.classList.add("show");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),timeout);
 const status=$("viewportMessage");status.textContent=message;status.classList.add("visible");
 clearTimeout(viewportTimer);viewportTimer=setTimeout(()=>status.classList.remove("visible"),timeout);
}
function resize(){
 const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);resize();
function animate(){
 requestAnimationFrame(animate);orbit.update();
 if(selected){
  boundsHelper.setFromObject(selected);
  boundsHelper.visible=!new THREE.Box3().setFromObject(selected).isEmpty();
 }else boundsHelper.visible=false;
 renderer.render(scene,camera);
}animate();
function cloneState(){
 const copy=root.clone(true);
 copy.traverse(obj=>{if(obj.isMesh&&obj.material){
  obj.material=Array.isArray(obj.material)?obj.material.map(m=>m.clone()):obj.material.clone();
 }});
 return {tree:copy,name:$("projectName").value};
}
function pushHistory(){
 past.push(cloneState());if(past.length>MAX_HISTORY)past.shift();future.length=0;
 updateUndoButtons();
}
function restore(state){
 select(null);root.clear();
 const clone=state.tree.clone(true);
 for(const child of [...clone.children])root.add(child);
 $("projectName").value=state.name;
 refreshTree();updateStats();fitScene();dirty();updateUndoButtons();
}
function undo(){if(!past.length)return;future.push(cloneState());restore(past.pop());}
function redo(){if(!future.length)return;past.push(cloneState());restore(future.pop());}
function updateUndoButtons(){$("undo").disabled=!past.length;$("redo").disabled=!future.length}
$("undo").onclick=undo;$("redo").onclick=redo;
function dirty(){isDirty=true;$("saveIndicator").textContent="Ändringar är inte sparade";}
function saved(){isDirty=false;$("saveIndicator").textContent="Sparad lokalt · "+new Date().toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"})}
window.addEventListener("beforeunload",event=>{if(isDirty){event.preventDefault();event.returnValue="";}});

function allMeshes(parent){const arr=[];parent.traverse(o=>{if(o.isMesh)arr.push(o)});return arr;}
function firstMaterial(obj){
 const mesh=allMeshes(obj)[0];if(!mesh)return null;
 return Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
}
function selectedInsideRoot(obj){while(obj&&obj!==root){if(obj.parent===root)return true;obj=obj.parent}return false}
function select(obj){
 if(obj&&!selectedInsideRoot(obj))obj=null;
 if(sculpt.enabled&&obj!==selected)toggleSculpt(false);
 selected=obj;
 transform.detach();if(selected&&!sculpt.enabled)transform.attach(selected);
 refreshTree();updateInspector();
 $("duplicate").disabled=!obj;$("deleteObject").disabled=!obj;
}
function refreshTree(){
 const list=$("hierarchy");list.replaceChildren();
 let count=0;
 function add(node,depth){
  if(depth>15||count++>350)return;
  const row=document.createElement("div");row.className="tree-row"+(node===selected?" active":"");
  row.style.setProperty("--depth",depth);row.setAttribute("role","treeitem");
  row.setAttribute("aria-selected",node===selected?"true":"false");
  const icon=document.createElement("span");icon.className="tree-icon";icon.textContent=node.isMesh?"◆":node.isGroup?"▣":"○";
  const name=document.createElement("span");name.className="tree-name";name.textContent=node.name||node.type;
  const eye=document.createElement("button");eye.className="tree-eye";eye.textContent=node.visible?"◉":"○";eye.title="Visa / dölj";eye.setAttribute("aria-label","Visa eller dölj "+name.textContent);
  eye.onclick=event=>{event.stopPropagation();pushHistory();node.visible=!node.visible;refreshTree();updateInspector();dirty();};
  row.append(icon,name,eye);row.onclick=()=>select(node);
  row.ondblclick=()=>{select(node);fitScene(node)};
  list.append(row);
  for(const child of node.children)if(child.isMesh||child.isGroup) add(child,depth+1);
 }
 for(const child of root.children)add(child,0);
 $("objectCount").textContent=root.children.length;
 if(!root.children.length)list.textContent="Scenen är tom – skapa eller importera en modell.";
}
function updateStats(){
 let meshes=0,triangles=0;
 root.traverse(o=>{if(o.isMesh&&o.geometry){
  meshes++;const geo=o.geometry;
  triangles+=Math.floor((geo.index?geo.index.count:geo.attributes.position?.count||0)/3);
 }});
 $("sceneStats").textContent=meshes+" meshar • "+triangles.toLocaleString("sv-SE")+" trianglar";
}
function updateInspector(){
 const has=Boolean(selected);
 $("inspector").hidden=!has;$("emptySelection").hidden=has;
 $("sculptPanel").hidden=!has||!selected.isMesh;
 if(!has)return;
 $("objectName").value=selected.name||selected.type;
 $("objectVisible").checked=selected.visible;
 for(const [axis,key] of [["x","x"],["y","y"],["z","z"]]){
  $("p"+axis).value=Number(selected.position[key].toFixed(3));
  $("r"+axis).value=Number(THREE.MathUtils.radToDeg(selected.rotation[key]).toFixed(2));
  $("s"+axis).value=Number(selected.scale[key].toFixed(3));
 }
 const material=firstMaterial(selected);
 $("materialPanel").hidden=!material||!("color" in material);
 if(material&&("color" in material)){
  $("materialColor").value="#"+material.color.getHexString();
  for(const key of ["metalness","roughness","opacity"]){
   const value=typeof material[key]==="number"?material[key]:(key==="opacity"?1:.5);
   $(key).value=value;$(key+"Out").textContent=value.toFixed(2);
  }
  $("wireframe").checked=!!material.wireframe;
 }
}
const inspectorIds=["objectName","objectVisible","px","py","pz","rx","ry","rz","sx","sy","sz","materialColor","metalness","roughness","opacity","wireframe"];
const inspector=$("inspector");
inspector.addEventListener("focusin",e=>{if(inspectorIds.includes(e.target.id)&&!inputHistoryArmed){pushHistory();inputHistoryArmed=true;}});
inspector.addEventListener("focusout",()=>{setTimeout(()=>{if(!inspector.contains(document.activeElement))inputHistoryArmed=false;},0);});
function applyInspector(event){
 if(!selected)return;
 const id=event.target.id;if(!inspectorIds.includes(id))return;
 if(!inputHistoryArmed){pushHistory();inputHistoryArmed=true}
 selected.name=$("objectName").value.trim()||"Objekt";
 selected.visible=$("objectVisible").checked;
 for(const axis of ["x","y","z"]){
  if(Number.isFinite(Number($("p"+axis).value))) selected.position[axis]=Number($("p"+axis).value);
  if(Number.isFinite(Number($("r"+axis).value))) selected.rotation[axis]=THREE.MathUtils.degToRad(Number($("r"+axis).value));
  const size=Number($("s"+axis).value);if(Number.isFinite(size)&&size>0)selected.scale[axis]=size;
 }
 if(["materialColor","metalness","roughness","opacity","wireframe"].includes(id)){
  const color=new THREE.Color($("materialColor").value);
  for(const mesh of allMeshes(selected)){
   const original=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   const mapped=original.map(m=>{
    if(!m)return m;
    const next=m.clone();
    if("color" in next)next.color.copy(color);
    if("metalness" in next)next.metalness=Number($("metalness").value);
    if("roughness" in next)next.roughness=Number($("roughness").value);
    next.opacity=Number($("opacity").value);next.transparent=next.opacity<1;
    next.wireframe=$("wireframe").checked;next.needsUpdate=true;return next;
   });
   mesh.material=Array.isArray(mesh.material)?mapped:mapped[0];
  }
 }
 for(const key of ["metalness","roughness","opacity"])$(key+"Out").textContent=Number($(key).value).toFixed(2);
 refreshTree();updateStats();dirty();
}
inspector.addEventListener("input",applyInspector);
inspector.addEventListener("change",()=>{inputHistoryArmed=false;updateInspector()});
function fitScene(object=root){
 const box=new THREE.Box3().setFromObject(object);
 if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const radius=Math.max(size.length(),1);
 const direction=camera.position.clone().sub(orbit.target).normalize();
 if(direction.lengthSq()<.01)direction.set(.7,.5,1).normalize();
 const dist=radius/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*.8;
 orbit.target.copy(center);camera.position.copy(center).addScaledVector(direction,dist);
 camera.near=Math.max(.005,radius/400);camera.far=Math.max(100,radius*200);
 camera.updateProjectionMatrix();orbit.update();
}
$("focusSelection").onclick=()=>fitScene(selected||root);
$("resetCamera").onclick=()=>{orbit.target.set(0,1,0);camera.position.set(7,5,9);orbit.update()};
$("showGrid").onchange=e=>grid.visible=e.target.checked;
$("showAxes").onchange=e=>axes.visible=e.target.checked;
function setTool(mode){
 if(sculpt.enabled)toggleSculpt(false);
 transform.setMode(mode);
 for(const [id,m] of [["toolMove","translate"],["toolRotate","rotate"],["toolScale","scale"]])$(id).classList.toggle("active",m===mode);
}
function toggleSculpt(value){
 const next=typeof value==="boolean"?value:!sculpt.enabled;
 if(next&&!selected?.isMesh){notify("Välj ett enskilt mesh i objektträdet först.");return}
 sculpt.enabled=next;sculpt.dragging=false;sculpt.mesh=null;
 if(next){transform.detach();orbit.enabled=false}
 else{orbit.enabled=true;if(selected)transform.attach(selected)}
 $("sculptMode").classList.toggle("active",next);
 $("sculptMode").textContent=next?"Avsluta skulptering":"Skulptera mesh";
 canvas.style.cursor=next?"crosshair":"grab";
 if(next)notify("Skulpteringsläge på: dra på meshens yta.");
}
$("sculptMode").onclick=()=>toggleSculpt();
function raycastMesh(event,mesh){
 const rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return null;
 pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(pointer,camera);
 return raycaster.intersectObject(mesh,false).find(hit=>hit.face)||null;
}
function sculptAt(event){
 const mesh=sculpt.mesh;
 if(!mesh?.geometry?.attributes?.position)return;
 const hit=raycastMesh(event,mesh);if(!hit)return;
 mesh.updateMatrixWorld(true);
 const hitLocal=mesh.worldToLocal(hit.point.clone());
 const localNormal=hit.face.normal.clone().normalize();
 const scale=mesh.getWorldScale(new THREE.Vector3());
 const averageScale=Math.max(.001,(Math.abs(scale.x)+Math.abs(scale.y)+Math.abs(scale.z))/3);
 const radius=Number($("brushRadius").value)/averageScale;
 const strength=Number($("brushStrength").value)/averageScale;
 const positions=mesh.geometry.attributes.position,point=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){
  point.fromBufferAttribute(positions,i);
  const distance=point.distanceTo(hitLocal);
  if(distance>=radius)continue;
  const weight=Math.pow(1-distance/radius,2);
  point.addScaledVector(localNormal,strength*weight);
  positions.setXYZ(i,point.x,point.y,point.z);
 }
 positions.needsUpdate=true;
 mesh.geometry.computeVertexNormals();
 mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 dirty();
}
canvas.addEventListener("pointerdown",event=>{
 if(!sculpt.enabled||!selected?.isMesh||event.button!==0)return;
 if(!raycastMesh(event,selected))return;
 const positions=selected.geometry?.attributes?.position;
 if(!positions||positions.count>250000){notify("Skulptering stöds för meshar med högst 250 000 punkter.");return}
 pushHistory();
 selected.geometry=selected.geometry.clone();
 sculpt.mesh=selected;sculpt.dragging=true;
 canvas.setPointerCapture(event.pointerId);
 sculptAt(event);
},true);
canvas.addEventListener("pointermove",event=>{if(sculpt.enabled&&sculpt.dragging)sculptAt(event)},true);
function finishSculpt(){
 if(!sculpt.dragging)return;
 sculpt.dragging=false;sculpt.mesh=null;updateStats();updateInspector();
 notify("Meshens geometri ändrad. Ångra med Ctrl/Cmd+Z.");
}
canvas.addEventListener("pointerup",finishSculpt);
canvas.addEventListener("pointercancel",finishSculpt);
$("brushRadius").oninput=()=>{$("brushRadiusOut").textContent=Number($("brushRadius").value).toFixed(1)};
$("brushStrength").oninput=()=>{$("brushStrengthOut").textContent=Number($("brushStrength").value).toFixed(2)};
$("smoothNormals").onclick=()=>{
 if(!selected?.isMesh||!selected.geometry)return;
 pushHistory();selected.geometry=selected.geometry.clone();
 selected.geometry.computeVertexNormals();selected.geometry.computeBoundingSphere();
 dirty();notify("Ytnormaler uppdaterade.");
};

$("toolMove").onclick=()=>setTool("translate");
$("toolRotate").onclick=()=>setTool("rotate");
$("toolScale").onclick=()=>setTool("scale");
$("toolLocal").onclick=()=>{const next=transform.space==="world"?"local":"world";transform.setSpace(next);$("toolLocal").textContent=next==="world"?"Global":"Lokal"};
$("toggleSnap").onclick=()=>{
 const enabled=$("toggleSnap").classList.toggle("active");
 transform.setTranslationSnap(enabled?.5:null);transform.setRotationSnap(enabled?THREE.MathUtils.degToRad(15):null);transform.setScaleSnap(enabled?.25:null);
 $("toggleSnap").textContent=enabled?"Snäpp på":"Snäpp av";
};
canvas.addEventListener("pointerdown",e=>{downPoint={x:e.clientX,y:e.clientY}},true);
canvas.addEventListener("pointerup",e=>{
 if(sculpt.enabled)return;
 if(!downPoint)return;const d=Math.hypot(e.clientX-downPoint.x,e.clientY-downPoint.y);downPoint=null;
 if(d>5||transform.dragging)return;
 const rect=canvas.getBoundingClientRect();
 pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
 raycaster.setFromCamera(pointer,camera);
 const hits=raycaster.intersectObjects(root.children,true).filter(h=>h.object.isMesh&&h.object.visible);
 if(hits.length)select(hits[0].object);else select(null);
});
function addObject(kind){
 pushHistory();
 const geom=kind==="box"?new THREE.BoxGeometry(1,1,1):
 kind==="sphere"?new THREE.SphereGeometry(.6,32,20):
 kind==="cylinder"?new THREE.CylinderGeometry(.5,.5,1.2,32):
 kind==="cone"?new THREE.ConeGeometry(.65,1.4,32):
 kind==="torus"?new THREE.TorusGeometry(.7,.2,16,64):
 new THREE.PlaneGeometry(2,2);
 const material=new THREE.MeshStandardMaterial({color:0x35c9a3,metalness:.12,roughness:.58,side:THREE.DoubleSide});
 const obj=new THREE.Mesh(geom,material);obj.name=({box:"Kub",sphere:"Sfär",cylinder:"Cylinder",cone:"Kon",torus:"Torus",plane:"Plan"})[kind];
 obj.castShadow=true;obj.receiveShadow=true;
 obj.position.y=kind==="plane"?.01:kind==="torus"?.95:.72;
 if(kind==="plane")obj.rotation.x=-Math.PI/2;
 root.add(obj);select(obj);fitScene(obj);updateStats();dirty();notify(obj.name+" skapad.");
}
document.querySelectorAll("[data-add]").forEach(button=>button.onclick=()=>addObject(button.dataset.add));
function cloneEditable(obj){
 const copy=obj.clone(true);
 copy.traverse(o=>{if(o.isMesh&&o.material)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();});
 return copy;
}
function duplicate(){
 if(!selected)return;pushHistory();
 const copy=cloneEditable(selected);
 copy.name=(selected.name||"Objekt")+" kopia";copy.position.x+=1;selected.parent.add(copy);
 select(copy);updateStats();dirty();notify("Objekt duplicerat");
}
function removeSelected(){
 if(!selected)return;pushHistory();const parent=selected.parent;parent.remove(selected);
 select(null);updateStats();dirty();notify("Objekt borttaget");
}
$("duplicate").onclick=duplicate;$("deleteObject").onclick=removeSelected;
$("groundObject").onclick=()=>{
 if(!selected)return;const b=new THREE.Box3().setFromObject(selected);if(b.isEmpty())return;
 pushHistory();const before=selected.parent.worldToLocal(new THREE.Vector3(0,0,0));
 const after=selected.parent.worldToLocal(new THREE.Vector3(0,-b.min.y,0));
 selected.position.add(after.sub(before));updateInspector();dirty();notify("Objektet placerat på marken");
};
for(const [id,angle] of [["rotateXPlus",90],["rotateXMinus",-90]]){
 $(id).onclick=()=>{if(!selected)return;pushHistory();selected.rotation.x+=THREE.MathUtils.degToRad(angle);updateInspector();dirty();notify("Rotation X "+angle+"°")};
}
async function loadGLB(blob,name){
 const url=URL.createObjectURL(blob);
 try{
  const gltf=await loader.loadAsync(url);
  const object=gltf.scene;object.name=name||"Importerad GLB";
  if(new THREE.Box3().setFromObject(object).isEmpty())throw Error("Filen innehåller ingen synlig geometri.");
  pushHistory();root.add(object);
  object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  select(object);fitScene(object);updateStats();dirty();
  notify("GLB importerad. Ursprungliga axlar och rotationer har bevarats.");
 }finally{URL.revokeObjectURL(url)}
}
$("importFile").onchange=async e=>{
 const file=e.target.files?.[0];e.target.value="";
 if(!file)return;if(!file.name.toLowerCase().endsWith(".glb"))return notify("Välj en .glb-fil.");
 if(file.size>50*1024*1024)return notify("Max 50 MB per GLB i denna testversion.");
 try{notify("Läser GLB …",5000);await loadGLB(file,file.name.replace(/\.glb$/i,""))}
 catch(err){console.error(err);notify("Importfel: "+err.message,5000)}
};
function addPreset(kind,name){
 pushHistory();
 const g=new THREE.Group();g.name=name;
 function part(geometry,color,x,y,z,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.08}));
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
 }
 if(kind==="house"){
  part(new THREE.BoxGeometry(3,2.5,2.8),0xc2b69a,0,1.25,0);
  part(new THREE.ConeGeometry(2.4,1.5,4),0xa04d42,0,3.1,0,0,Math.PI/4,0);
  part(new THREE.BoxGeometry(.75,1.35,.07),0x614333,0,.68,1.43);
  for(const x of [-.95,.95])part(new THREE.BoxGeometry(.55,.55,.08),0x6fa6c7,x,1.75,1.45);
 }else if(kind==="cart"){
  part(new THREE.BoxGeometry(2.35,.5,3.5),0x22bf93,0,.77,0);
  part(new THREE.BoxGeometry(1.65,.7,1.8),0x375875,0,1.3,-.2);
  for(const x of [-1.21,1.21])for(const z of [-1.1,1.1]){
   part(new THREE.CylinderGeometry(.42,.42,.31,32),0x151d27,x,.43,z,0,0,Math.PI/2);
   part(new THREE.CylinderGeometry(.23,.23,.33,24),0xb5cad1,x,.43,z,0,0,Math.PI/2);
  }
  part(new THREE.BoxGeometry(1.45,.22,.23),0x9fb7b9,0,.52,1.82);
 }else if(kind==="tree"){
  part(new THREE.CylinderGeometry(.18,.28,2.4,12),0x68452b,0,1.2,0);
  for(const [y,height,r] of [[2.7,2.6,1.2],[3.4,2.1,.95],[4,1.5,.65]])part(new THREE.ConeGeometry(r,height,10),0x247a54,0,y,0);
 }else{future.length=0;past.pop();return notify("Okänd modelltyp.")}
 root.add(g);select(g);fitScene(g);updateStats();dirty();notify(name+" tillagd");
}
async function loadLibrary(){
 const response=await fetch("../models.json",{cache:"no-store"});
 if(!response.ok)throw Error("Ingen modellkatalog tillgänglig");
 const catalog=await response.json();const holder=$("library");holder.replaceChildren();
 for(const item of catalog.models||[]){
  if(typeof item.name!=="string")continue;
  const button=document.createElement("button");button.type="button";button.textContent=item.name;
  button.onclick=async()=>{
   try{
    if(item.kind==="primitive"){addObject(item.shape);return}
    if(item.kind==="preset"){addPreset(item.shape,item.name);return}
    if(item.kind==="glb"&&typeof item.path==="string"&&/^\.\/models\/[a-zA-Z0-9/_-]+\.glb$/.test(item.path)){
     const path="../"+item.path.slice(2);
     const response=await fetch(path);
     if(!response.ok)throw Error("Filen hittades inte i GitHub-biblioteket");
     await loadGLB(await response.blob(),item.name);return;
    }
    notify("Modellen saknar en giltig lokal GLB-sökväg");
   }catch(err){notify("Kan inte hämta modellen: "+err.message,5000)}
  };
  holder.append(button);
 }
}
function safeFilename(){return ($("projectName").value.trim()||"duoforge-modell").replace(/[^a-z0-9åäö_-]/gi,"_").slice(0,80)}
function download(filename,blob){
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),6000);
}
async function toGLB(){
 if(!root.children.length)throw Error("Scenen är tom.");
 return new Blob([await exporter.parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:2048})],{type:"model/gltf-binary"});
}
$("exportGLB").onclick=async()=>{
 try{notify("Skapar GLB …",7000);const blob=await toGLB();download(safeFilename()+".glb",blob);notify("GLB nedladdad ("+(blob.size/1024).toFixed(0)+" kB)");}
 catch(err){console.error(err);notify("Exportfel: "+err.message,6000)}
};
$("downloadProject").onclick=()=>{
 try{
  const json=JSON.stringify({format:"duoforge-studio@1",name:$("projectName").value,object:root.toJSON()},null,2);
  download(safeFilename()+".duoforge.json",new Blob([json],{type:"application/json"}));
  notify("Redigerbar projektfil nedladdad.");
 }catch(err){notify("Kunde inte skapa projektfil: "+err.message)}
};
$("screenshot").onclick=()=>{
 renderer.render(scene,camera);
 canvas.toBlob(blob=>{if(blob){download(safeFilename()+".png",blob);notify("Bild nedladdad.")}else notify("Kunde inte skapa bild")},"image/png");
};
$("projectName").addEventListener("change",dirty);
$("newScene").onclick=()=>{
 if(root.children.length&&!window.confirm("Skapa ny scen? Osparade ändringar går förlorade."))return;
 pushHistory();select(null);root.clear();projectId=null;
 $("projectName").value="Ny 3D-scen";updateStats();refreshTree();dirty();notify("Ny scen skapad");
};

// IndexedDB saves binary 3D projects, including geometry and materials, only on this device.
function database(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open("duoforge-studio-local",1);
  request.onupgradeneeded=()=>request.result.createObjectStore("projects",{keyPath:"id"});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function dbRequest(mode,run){
 const db=await database();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction("projects",mode),store=tx.objectStore("projects");
  const req=run(store);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  tx.onerror=()=>reject(tx.error);
 })}finally{db.close()}
}
$("saveProject").onclick=async()=>{
 try{
  const blob=await toGLB();
  if(!projectId)projectId=crypto.randomUUID();
  await dbRequest("readwrite",store=>store.put({id:projectId,name:$("projectName").value.trim()||"Min 3D-scen",updated:Date.now(),blob}));
  saved();notify("Projekt sparat lokalt på denna enhet.");
 }catch(err){console.error(err);notify("Kunde inte spara: "+err.message,6500)}
};
async function openLocalProject(item){
 if(root.children.length&&!window.confirm("Öppna sparat projekt och ersätt scenen? Osparade ändringar kan gå förlorade."))return;
 try{
  const blob=item.blob;const url=URL.createObjectURL(blob);
  let gltf;try{gltf=await loader.loadAsync(url)}finally{URL.revokeObjectURL(url)}
  select(null);root.clear();
  for(const child of [...gltf.scene.children])root.add(child);
  projectId=item.id;$("projectName").value=item.name;past.length=0;future.length=0;updateUndoButtons();
  refreshTree();updateStats();fitScene();saved();$("projectDialog").close();
  notify("Sparat projekt öppnat: "+item.name);
 }catch(err){console.error(err);notify("Kunde inte öppna projekt: "+err.message,6000)}
}
$("openProject").onclick=async()=>{
 $("projectDialog").showModal();
 const holder=$("savedProjects");holder.textContent="Läser sparade projekt …";
 try{
  const all=await dbRequest("readonly",store=>store.getAll());
  holder.replaceChildren();
  if(!all.length)holder.textContent="Du har inga sparade projekt på denna enhet.";
  for(const item of all.sort((a,b)=>b.updated-a.updated)){
   const row=document.createElement("div");row.className="saved-row";
   const label=document.createElement("div");label.className="saved-title";label.textContent=item.name;
   const timestamp=document.createElement("small");timestamp.textContent=new Date(item.updated).toLocaleString("sv-SE");
   label.append(timestamp);
   const open=document.createElement("button");open.textContent="Öppna";open.onclick=()=>openLocalProject(item);
   row.append(label,open);holder.append(row);
  }
  const importBtn=document.createElement("button");importBtn.textContent="Importera .duoforge.json från datorn";
  importBtn.onclick=()=>projectInput.click();holder.append(importBtn);
 }catch(err){holder.textContent="Lokalt sparande stöds inte i denna webbläsare: "+err.message}
};
const projectInput=document.createElement("input");projectInput.type="file";projectInput.accept=".json,application/json";projectInput.hidden=true;document.body.append(projectInput);
projectInput.onchange=async e=>{
 const file=e.target.files?.[0];e.target.value="";if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=="duoforge-studio@1"||!data.object)throw Error("Ogiltig projektfil");
  const imported=new THREE.ObjectLoader().parse(data.object);
  if(!imported.isObject3D)throw Error("Saknar giltig scen");
  if(root.children.length&&!window.confirm("Ersätta scenen med den importerade projektfilen?"))return;
  select(null);root.clear();for(const child of [...imported.children])root.add(child);
  $("projectName").value=data.name||"Importerad scen";projectId=null;
  past.length=0;future.length=0;updateUndoButtons();refreshTree();updateStats();fitScene();dirty();
  $("projectDialog").close();notify("Projektfil importerad – redo att redigeras.");
 }catch(err){notify("Projektimport misslyckades: "+err.message,6000)}
};

window.addEventListener("keydown",event=>{
 const target=event.target;
 if(target instanceof HTMLElement&&(target.matches("input,textarea,select")||target.isContentEditable))return;
 const key=event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;
 if(ctrl&&key==="z"){event.preventDefault();if(event.shiftKey)redo();else undo();return}
 if(ctrl&&key==="y"){event.preventDefault();redo();return}
 if(!ctrl&&!event.altKey){
  if(key==="g")setTool("translate");
  if(key==="r")setTool("rotate");
  if(key==="s")setTool("scale");
  if(key==="f")fitScene(selected||root);
  if(key==="escape"&&sculpt.enabled)toggleSculpt(false);
  if(key==="delete"||key==="backspace"){event.preventDefault();removeSelected()}
 }
});

// An editable starter kart makes the interface useful on its first visit.
addPreset("cart","DuoForge Kart – startmodell");
past.length=0;future.length=0;updateUndoButtons();isDirty=false;$("saveIndicator").textContent="Startmodell – inte sparad";
loadLibrary().catch(err=>{console.error(err);$("library").textContent="Modellbiblioteket kunde inte laddas.";});
notify("3D-studion är redo. Välj ett objekt och använd Flytta / Rotera / Skala.",4300);
