import * as THREE from "https://esm.sh/three@0.186.1";
import {GLTFLoader} from "https://esm.sh/three@0.186.1/examples/jsm/loaders/GLTFLoader.js";
import {GLTFExporter} from "https://esm.sh/three@0.186.1/examples/jsm/exporters/GLTFExporter.js";
import {OrbitControls} from "https://esm.sh/three@0.186.1/examples/jsm/controls/OrbitControls.js";

const $=id=>document.getElementById(id);
const canvas=$("scene");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.setClearColor(0x142037);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff,0x46617c,2.2));
const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(5,9,6);scene.add(sun);
const grid=new THREE.GridHelper(30,30,0x57748e,0x30445e);scene.add(grid);
const camera=new THREE.PerspectiveCamera(50,1,.01,2000);camera.position.set(5,4,7);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,.7,0);
const root=new THREE.Group();root.name="DuoForge model";scene.add(root);
const highlight=new THREE.BoxHelper(new THREE.Object3D(),0x35ebbe);highlight.visible=false;scene.add(highlight);
let selected=null;
const state={fileName:"Min modell",modelURL:null};
function notice(v){$("status").textContent=v}
function resize(){const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(canvas);resize();
function draw(){requestAnimationFrame(draw);controls.update();if(selected){highlight.setFromObject(selected);highlight.visible=true}else highlight.visible=false;renderer.render(scene,camera)}draw();
function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)}
function fit(object=root){const b=new THREE.Box3().setFromObject(object);if(b.isEmpty())return;const center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());const d=Math.max(size.length(),2);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.75,d*.65,d));camera.near=Math.max(d/2000,.001);camera.far=Math.max(d*100,100);camera.updateProjectionMatrix();controls.update()}
function getMaterial(obj){let found=null;obj.traverse(n=>{if(!found&&n.isMesh&&n.material&&!Array.isArray(n.material))found=n});return found}
function refresh(){
 $("objectList").replaceChildren();
 for(const [i,obj] of root.children.entries()){
  const b=document.createElement("button");b.className="object"+(obj===selected?" active":"");b.textContent=(i+1)+". "+(obj.name||"Objekt");b.onclick=()=>select(obj);$("objectList").append(b);
 }
 $("count").textContent=root.children.length+" objekt";
}
function select(obj){selected=obj;refresh();sync()}
function sync(){
 for(const el of document.querySelectorAll("#properties input"))el.disabled=!selected;
 for(const id of ["duplicate","delete","ground"])$(id).disabled=!selected;
 if(!selected)return;
 $("objName").value=selected.name;
 for(const [axis,k] of [["X","x"],["Y","y"],["Z","z"]]){
  $("p"+axis).value=selected.position[k].toFixed(3);
  $("r"+axis).value=THREE.MathUtils.radToDeg(selected.rotation[k]).toFixed(1);
  $("s"+axis).value=selected.scale[k].toFixed(3);
 }
 const m=getMaterial(selected)?.material;
 $("color").value=m?.color?"#"+m.color.getHexString():"#ffffff";
}
function modify(){
 if(!selected)return;
 selected.name=$("objName").value||"Objekt";
 for(const [axis,k] of [["X","x"],["Y","y"],["Z","z"]]){
  selected.position[k]=Number($("p"+axis).value)||0;
  selected.rotation[k]=THREE.MathUtils.degToRad(Number($("r"+axis).value)||0);
  selected.scale[k]=Math.max(.001,Number($("s"+axis).value)||1);
 }
 const mesh=getMaterial(selected);
 if(mesh?.material?.color){
  if(!mesh.userData.duoforgeOwnMaterial){mesh.material=mesh.material.clone();mesh.userData.duoforgeOwnMaterial=true}
  mesh.material.color.set($("color").value);
 }
 refresh();
}
document.querySelectorAll("#properties input").forEach(el=>el.addEventListener("input",modify));
function make(type,name=type){
 const geo=type==="box"?new THREE.BoxGeometry(1,1,1):type==="sphere"?new THREE.SphereGeometry(.6,32,20):type==="cylinder"?new THREE.CylinderGeometry(.5,.5,1.2,32):new THREE.ConeGeometry(.6,1.3,32);
 const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x36c9a3,metalness:.12,roughness:.55}));
 mesh.name=name;mesh.position.y=.7;root.add(mesh);select(mesh);fit(mesh);notice(name+" tillagd");
 return mesh;
}
document.querySelectorAll("[data-primitive]").forEach(b=>b.onclick=()=>make(b.dataset.primitive,b.textContent.trim()));
$("duplicate").onclick=()=>{if(!selected)return;const obj=selected.clone(true);obj.name=selected.name+" kopia";obj.position.x+=1;root.add(obj);select(obj);notice("Kopia skapad")};
$("delete").onclick=()=>{if(!selected)return;root.remove(selected);select(null);notice("Objekt borttaget")};
$("ground").onclick=()=>{if(!selected)return;const box=new THREE.Box3().setFromObject(selected);if(!box.isEmpty())selected.position.y-=box.min.y;sync();notice("Objektet står på markplanet")};
$("fit").onclick=()=>fit();
$("resetCamera").onclick=()=>{camera.position.set(5,4,7);controls.target.set(0,0,0);controls.update()};
$("clear").onclick=()=>{if(!confirm("Rensa alla objekt i scenen?"))return;root.clear();select(null);notice("Scenen är tom")};
$("name").addEventListener("input",e=>{state.fileName=e.target.value.trim()||"Min modell";root.name=state.fileName});
$("file").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!file.name.toLowerCase().endsWith(".glb"))return notice("Välj en GLB-fil.");
 const url=URL.createObjectURL(file);
 try{
  notice("Importerar "+file.name+" …");
  const gltf=await new GLTFLoader().loadAsync(url);
  const object=gltf.scene;
  if(new THREE.Box3().setFromObject(object).isEmpty())throw Error("Ingen synlig geometri");
  object.name=file.name.replace(/\.glb$/i,"");root.add(object);
  select(object);fit(object);notice("Importerad: "+file.name+". Välj objektet och justera rotation X/Y/Z vid behov.");
 }catch(err){notice("Importfel: "+err.message)}finally{URL.revokeObjectURL(url)}
};
$("exportGLB").onclick=async()=>{
 if(!root.children.length)return notice("Lägg till eller importera en modell först.");
 try{
  notice("Skapar GLB …");
  const binary=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
  download((state.fileName.replace(/[^a-z0-9åäö_-]/gi,"_")||"DuoForge")+".glb",new Blob([binary],{type:"model/gltf-binary"}));
  notice("GLB exporterad från webbläsaren.");
 }catch(err){notice("Kunde inte exportera GLB: "+err.message)}
};
$("exportJSON").onclick=()=>{
 const entries=root.children.map(obj=>({name:obj.name,type:obj.geometry?.type||obj.type,position:obj.position.toArray(),rotationDeg:[obj.rotation.x,obj.rotation.y,obj.rotation.z].map(THREE.MathUtils.radToDeg),scale:obj.scale.toArray()}));
 download("duoforge-scene.json",new Blob([JSON.stringify({schema:"duoforge-scene-preview@1",name:state.fileName,objects:entries},null,2)],{type:"application/json"}));
 notice("Scenbeskrivning exporterad. JSON är inte samma sak som en komplett GLB.");
};
$("screenshot").onclick=()=>{renderer.render(scene,camera);canvas.toBlob(blob=>{if(blob)download("duoforge-preview.png",blob)},"image/png")};

// Public-only catalog: never request GitHub private repos from the browser.
async function loadLibrary(){
 const catalog=await fetch("./models.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Katalogen saknas");return r.json()});
 const holder=$("library");holder.replaceChildren();
 for(const item of catalog.models){
  const button=document.createElement("button");button.className="library-item";button.textContent=item.name;button.onclick=async()=>{
   if(item.kind==="primitive"){const obj=make(item.shape,item.name);obj.scale.set(...(item.scale||[1,1,1]));sync();return}
   if(item.kind!=="glb"||typeof item.path!=="string"||!item.path.startsWith("./models/"))return notice("Otillåten modellsökväg");
   try{notice("Hämtar "+item.name+" …");const gltf=await new GLTFLoader().loadAsync(new URL(item.path,location.href).href);gltf.scene.name=item.name;root.add(gltf.scene);select(gltf.scene);fit(gltf.scene);notice(item.name+" hämtad från GitHub.")}catch(e){notice("Kunde inte hämta modell: "+e.message)}
  };holder.append(button);
 }
}
loadLibrary().catch(e=>notice("Kunde inte läsa biblioteket: "+e.message));
refresh();sync();notice("Redo. Skapa en form, importera GLB eller välj en modell från GitHub-biblioteket.");
