import * as THREE from "three";
import {materialLab} from "./pbr-materials.mjs";
import {ISLAND_SITES,terrainHeight,coastlineRadius,isLand,selectTerrainResolution,deterministicRandom} from "./coastal-terrain.mjs";

const up=new THREE.Object3D(),tint=new THREE.Color();
const palettes={
 wet:new THREE.Color("#334d52"),
 slate:new THREE.Color("#626c6a"),
 dry:new THREE.Color("#82817a"),
 moss:new THREE.Color("#536e60"),
 grass:new THREE.Color("#475f4b")
};
function colorFor(height,dx,dz,seed){
 const w=Math.max(0,Math.min(1,(height+.9)/2.4));
 const m=Math.max(0,Math.min(1,(height-3.4)/11));
 tint.copy(palettes.wet).lerp(palettes.slate,w*.81);
 tint.lerp(palettes.dry,Math.max(0,(height-8)/22)*.66);
 const lichen=Math.max(0,Math.sin(dx*.12+seed)*Math.cos(dz*.14-seed*.5));
 tint.lerp(palettes.moss,(.14+.19*lichen)*m);
 tint.multiplyScalar(.93+.12*Math.sin(dx*.33+seed)*Math.cos(dz*.28));
 return [tint.r,tint.g,tint.b];
}
export function buildIslandGeometry(site,quality="medium"){
 const {rings,segments}=selectTerrainResolution(quality),n=rings+1;
 const pos=new Float32Array(n*segments*3),colors=new Float32Array(pos.length),indices=[];
 for(let ring=0;ring<=rings;ring++){
  const fraction=(ring/rings)*1.15;
  for(let j=0;j<segments;j++){
   const angle=j/segments*2*Math.PI,dist=fraction*site.r*coastlineRadius(angle,site.seed);
   const x=dist*Math.cos(angle),z=dist*1.12*Math.sin(angle);
   const height=terrainHeight(x,z,site.r,site.seed);
   const at=(ring*segments+j)*3;
   pos[at]=x;pos[at+1]=height;pos[at+2]=z;
   const rgb=colorFor(height,x,z,site.seed);
   colors[at]=rgb[0];colors[at+1]=rgb[1];colors[at+2]=rgb[2];
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
  const a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+j,d=(i+1)*segments+(j+1)%segments;
  indices.push(a,b,c,b,d,c);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
 geo.setAttribute("color",new THREE.BufferAttribute(colors,3));geo.setIndex(indices);
 geo.computeVertexNormals();geo.computeBoundingSphere();
 return geo;
}
const rockMaterial=materialLab("stone");
const cliffMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,side:THREE.DoubleSide});
const pineMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
const trunkMaterial=new THREE.MeshStandardMaterial({color:0x5a4d41,roughness:.97});
const graniteMaterial=materialLab("stone");
const pineShape=new THREE.ConeGeometry(1,1,7);
const trunkShape=new THREE.CylinderGeometry(.18,.26,1,6);
const scatterShape=new THREE.IcosahedronGeometry(1,1);
const tealLine=new THREE.MeshStandardMaterial({color:0x455a53,roughness:.95});
function addInstancedForest(group,site,quality){
 const limits=selectTerrainResolution(quality),rng=deterministicRandom(site.seed*611);
 const trunk=new THREE.InstancedMesh(trunkShape,trunkMaterial,limits.trees);
 const leaf=new THREE.InstancedMesh(pineShape,pineMaterial,limits.trees);
 const crown=new THREE.InstancedMesh(pineShape,pineMaterial,limits.trees);
 trunk.name="Instanced organic forest trunks";
 leaf.name="Instanced pine canopy lower tier";crown.name="Instanced pine canopy upper tier";
 let actual=0;
 for(let tries=0;actual<limits.trees&&tries<limits.trees*22;tries++){
  const theta=rng()*Math.PI*2,rr=Math.sqrt(rng())*.81*site.r;
  const x=Math.cos(theta)*rr,z=Math.sin(theta)*rr*1.12;
  if(!isLand(x,z,site.r,site.seed))continue;
  const ground=terrainHeight(x,z,site.r,site.seed);
  if(ground<3.8||ground>19.4&&rng()>.45)continue;
  // Keep center footprint open for landmarks/harbor buildings.
  if((site.lighthouse||site.harbor)&&rr<6)continue;
  const h=4.4+rng()*5.6,wide=.7+rng()*.6;
  up.position.set(x,ground+h*.22,z);up.rotation.set(0,rng()*Math.PI*2,0);
  up.scale.set(wide,h*.43,wide);up.updateMatrix();trunk.setMatrixAt(actual,up.matrix);
  up.position.y=ground+h*.57;up.scale.set(wide*1.54,h*.70,wide*1.54);
  up.updateMatrix();leaf.setMatrixAt(actual,up.matrix);
  up.position.y=ground+h*.84;up.scale.set(wide*1.12,h*.48,wide*1.12);
  up.updateMatrix();crown.setMatrixAt(actual,up.matrix);
  const green=new THREE.Color().setHSL(.36+rng()*.045,.18+rng()*.08,.14+rng()*.075);
  leaf.setColorAt(actual,green);crown.setColorAt(actual,green.clone().multiplyScalar(1.18));
  actual++;
 }
 for(const inst of [trunk,leaf,crown]){
  inst.count=actual;inst.instanceMatrix.needsUpdate=true;
  if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
  inst.castShadow=quality==="high";inst.receiveShadow=false;group.add(inst);
 }
 return actual;
}
function addRockField(group,site,quality){
 const max=selectTerrainResolution(quality).rocks,rng=deterministicRandom(site.seed*1447);
 const rocks=new THREE.InstancedMesh(scatterShape,graniteMaterial,max);
 rocks.name="Instanced coastal granite outcrops";
 for(let i=0;i<max;i++){
  const ang=rng()*Math.PI*2,range=(.62+rng()*.48)*site.r*coastlineRadius(ang,site.seed);
  const x=Math.cos(ang)*range,z=Math.sin(ang)*range*1.12;
  const h=terrainHeight(x,z,site.r,site.seed);
  const size=.65+rng()*2.4;
  up.position.set(x,h+.2,z);
  up.rotation.set(rng()*.5,rng()*Math.PI*2,rng()*.4);
  up.scale.set(size*(1+rng()),size*.53,size*(.65+rng()*.6));
  up.updateMatrix();rocks.setMatrixAt(i,up.matrix);
  const color=new THREE.Color().setHSL(.45+rng()*.07,.05+rng()*.08,.26+rng()*.15);
  rocks.setColorAt(i,color);
 }
 rocks.instanceMatrix.needsUpdate=true;
 rocks.instanceColor.needsUpdate=true;
 rocks.castShadow=quality==="high";rocks.receiveShadow=true;group.add(rocks);
 return max;
}
const dockWood=materialLab("wood");
const siding=materialLab("teak");
const slateRoof=materialLab("roof");
const darkWood=materialLab("darkPaint");
const warmWindow=new THREE.MeshStandardMaterial({color:0xffd79a,emissive:0xfda756,emissiveIntensity:.68,metalness:0,roughness:.3});
const harborLights=[];
function put(group,geo,mat,name,x,y,z){
 const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);
 mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function block(group,mat,name,x,y,z,w,h,d){
 return put(group,new THREE.BoxGeometry(w,h,d),mat,name,x,y,z);
}
function buildHarbor(root,quality){
 const site=ISLAND_SITES.find(s=>s.harbor);
 const harbor=new THREE.Group();harbor.name="Aurora harbor — original 3D fishing village";
 root.add(harbor);
 // The dock goes out from the rocky east shore into open water.
 const dock=new THREE.Group();dock.position.set(site.x+site.r+8,0,site.z-12);harbor.add(dock);
 for(let i=0;i<11;i++){
  block(dock,dockWood,"Pier teak plank",i*2.1-10.5,1.6,0,1.94,.23,5.1);
  if(i%3===0){
   for(const side of [-1,1]){
    block(dock,darkWood,"Pier post",i*2.1-10.5,.3,side*2.64,.44,3.8,.43);
    put(dock,new THREE.CylinderGeometry(.12,.14,.9,10),slateRoof,"Steel cap",i*2.1-10.5,2.4,side*2.64);
   }
  }
 }
 const houses=quality==="low"?2:4;
 for(let i=0;i<houses;i++){
  const x=site.x-10+(i%2)*12,z=site.z-4+Math.floor(i/2)*12;
  const floor=terrainHeight(x-site.x,z-site.z,site.r,site.seed);
  const cabin=new THREE.Group();cabin.position.set(x,floor,z);
  cabin.rotation.y=.1+i*.38;harbor.add(cabin);
  block(cabin,darkWood,"Stone and timber foundation",0,.17,0,6.5,.6,5.0);
  block(cabin,siding,"Clapboard fishing cottage",0,2.15,0,6.2,3.65,4.8);
  for(const sign of [-1,1]){
   const roof=block(cabin,slateRoof,"Gabled seafaring roof",sign*1.65,4.9,0,4.3,.30,5.6);
   roof.rotation.z=sign*.49;
   for(const w of [-1.6,1.45]){
    block(cabin,darkWood,"Window timber frame",w,2.55,sign*2.44,1.2,1.3,.16);
    block(cabin,warmWindow,"Warm glazed window",w,2.55,sign*2.53,.84,.93,.055);
   }
  }
  block(cabin,darkWood,"Harbor entrance",0,1.42,2.47,1.15,2.2,.12);
  block(cabin,slateRoof,"Brick chimney",1.1,5.73,-.88,.7,2.1,.72);
  if(i===0&&quality!=="low"){
   const point=new THREE.PointLight(0xffc080,3,18,2);
   point.position.set(0,3,2);cabin.add(point);harborLights.push(point);
  }
 }
 const buoyPaint=new THREE.MeshStandardMaterial({color:0x9b4b32,roughness:.6});
 const paleSteel=new THREE.MeshStandardMaterial({color:0xc3c3b5,metalness:.6,roughness:.45});
 for(let i=0;i<5;i++){
  const x=dock.position.x-10+i*4.7,z=dock.position.z+((i%2)?-5:5);
  put(harbor,new THREE.CylinderGeometry(.38,.48,1.25,12),buoyPaint,"Harbor approach buoy",x,.16,z);
  put(harbor,new THREE.SphereGeometry(.24,10,8),paleSteel,"Harbor light housing",x,1,z);
 }
 // Broken shore wall; all rocks are real triangulated geometry (not flat textures).
 for(let i=0;i<(quality==="low"?4:12);i++){
  const rng=deterministicRandom(447+i);
  const x=site.x+site.r*.68+rng()*5,z=site.z-16+i*2.1;
  const height=terrainHeight(x-site.x,z-site.z,site.r,site.seed);
  const rubble=put(harbor,new THREE.IcosahedronGeometry(1,1),rockMaterial,"Dry stone seawall",x,height,z);
  rubble.scale.set(1.3+rng(),.8+rng(),.6+rng());
 }
 return harbor;
}
export function enhanceLighthouse(tower,quality="medium"){
 // Readable doors, narrow slit windows, painted coastal banding and balcony rail.
 const door=new THREE.MeshStandardMaterial({color:0x485a63,roughness:.77});
 const frame=new THREE.MeshStandardMaterial({color:0x303944,roughness:.8});
 const lens=new THREE.MeshStandardMaterial({color:0xf5dcaf,roughness:.18,emissive:0xffa553,emissiveIntensity:.36});
 block(tower,door,"Lighthouse sea-facing door",0,-8.25,-2.68,1.6,3.25,.22);
 for(let level=0;level<3;level++){
  const y=-5+level*5.4;
  for(let i=0;i<4;i++){
   const angle=i*Math.PI/2+Math.PI/4;
   const g=new THREE.Group();g.rotation.y=angle;tower.add(g);
   block(g,frame,"Inset lighthouse window frame",0,y,-2.57,.79,1.27,.19);
   block(g,lens,"Warm lighthouse window",0,y,-2.71,.48,.95,.08);
  }
 }
 if(quality!=="low"){
  const steel=new THREE.MeshStandardMaterial({color:0x737e7c,metalness:.72,roughness:.32});
  for(let i=0;i<16;i++){
   const angle=i/16*Math.PI*2;
   put(tower,new THREE.CylinderGeometry(.05,.05,1.5,6),steel,"Lighthouse balcony upright",
    2.78*Math.cos(angle),11.5,2.78*Math.sin(angle));
  }
  const rim=put(tower,new THREE.TorusGeometry(2.8,.085,6,40),steel,"Lighthouse balcony circular rail",0,12.25,0);
  rim.rotation.x=Math.PI/2;
 }
}
export function buildCoastalWorld({world,quality="medium"}){
 const islands=[],stats={islands:0,forestInstances:0,rocks:0};
 for(const site of ISLAND_SITES){
  const group=new THREE.Group();group.name="Natural island "+site.seed;
  group.position.set(site.x,0,site.z);world.add(group);
  const mesh=new THREE.Mesh(buildIslandGeometry(site,quality),cliffMaterial);
  mesh.name="High-resolution ridged coastline with hand-colored rock, wet rock and moss";
  mesh.castShadow=quality==="high";mesh.receiveShadow=true;group.add(mesh);
  const trees=addInstancedForest(group,site,quality);
  const rocks=addRockField(group,site,quality);
  islands.push(group);stats.islands++;stats.forestInstances+=trees;stats.rocks+=rocks;
 }
 const harbor=buildHarbor(world,quality);
 return {islands,harbor,stats,siteHeight(site){return terrainHeight(0,0,site.r,site.seed)}};
}
