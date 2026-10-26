// Render World Ocean environmental details. Temporary scene only, never GLB exported.
import * as THREE from "three";
import {createOceanSurface,normalizeOceanSettings} from "./ocean-water.mjs";
const randSeed=(seed=91531)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
export function buildOceanScene({quality="medium",settings={}}={}){
 const group=new THREE.Group();group.name="DuoForge Ocean — sea, rocks, dock and floating markers";
 const water=createOceanSurface({quality,settings});
 group.add(water.mesh);
 const owned=[];
 const add=(geometry,material,name,x=0,y=0,z=0,parent=group)=>{
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  mesh.position.set(x,y,z);mesh.castShadow=quality!=="low";mesh.receiveShadow=quality!=="low";
  parent.add(mesh);owned.push(mesh);return mesh;
 };
 const pbr=(color,roughness=.8,metalness=.02,emissive=0)=>{
  return new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity:emissive?.4:0});
 };
 const rock=pbr("#646e6c",.95),rockLight=pbr("#99a19a",.87);
 const wood=pbr("#957256",.8),wetWood=pbr("#725941",.79),dockMetal=pbr("#7b959b",.32,.79);
 const foam=new THREE.MeshBasicMaterial({color:"#e5f8f4",transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
 const shell=new THREE.MeshPhysicalMaterial({color:"#f9f6e1",roughness:.35,metalness:.08});
 const random=randSeed();
 // Elevated wooden marina platform: stable showcase for cars and props,
 // while open sea extends to the horizon. No false claim of buoyancy for cars.
 add(new THREE.BoxGeometry(12.7,.63,11.7),wetWood,"Dry showroom pontoon base",0,-.07,0);
 for(let x=-5.9;x<6;x+=.69){
  add(new THREE.BoxGeometry(.62,.065,11.7),wood,"Individual weathered deck board",x,.295,0);
  if(quality!=="low")add(new THREE.BoxGeometry(.025,.006,11.5),dockMetal,
   "Deck screw highlight",x+.24,.331,0).castShadow=false;
 }
 for(const x of [-6.35,6.35])for(const z of [-5.9,5.9]){
  add(new THREE.CylinderGeometry(.18,.2,1.4,10),dockMetal,"Marina bollard",x,.18,z);
  add(new THREE.CylinderGeometry(.29,.29,.15,12),dockMetal,"Mooring cap",x,.9,z);
 }
 for(const side of [-1,1]){
  add(new THREE.BoxGeometry(.16,.19,11.7),dockMetal,"Pontoon side beam",side*6.34,.35,0);
  for(const z of [-5.5,5.5]){
   const anchor=add(new THREE.TorusGeometry(.24,.045,8,24),dockMetal,
    "Steel mooring ring",side*6.39,.34,z);
   anchor.rotation.y=Math.PI/2;
  }
 }
 // Stepping stones and islands are deliberately far from the testing pontoon.
 const islandSpots=[[-48,-75,15],[75,-112,22],[-123,12,21],[113,62,17],[-35,145,28]];
 const islands=[];
 for(const [idx,[x,z,s]] of islandSpots.entries()){
  const base=add(new THREE.IcosahedronGeometry(s,2),idx%2?rock:rockLight,
   "Distant rugged island "+(idx+1),x,-s*.69,z);
  base.scale.y=.44+random()*.11;
  base.rotation.y=random()*Math.PI;
  islands.push(base);
  if(quality!=="low"){
   for(let i=0;i<3;i++){
    const tree=add(new THREE.ConeGeometry(2+random()*1.4,8+random()*3.5,7),
     pbr("#37695b",.9),"Distant island tree",x+(random()-.5)*s,2.5,z+(random()-.5)*s);
    tree.castShadow=false;
   }
  }
 }
 // Faint waterline foam and near-shore rock textures.
 for(const [x,z,s]of islandSpots){
  const ring=add(new THREE.TorusGeometry(s*.63,.14,7,66),foam,"Sea foam near rocks",x,-.28,z);
  ring.rotation.x=Math.PI/2;ring.scale.y=.78;
  ring.castShadow=false;ring.receiveShadow=false;
 }
 const floaters=[];
 function buoy(x,z,color="#e36e53",seed=0){
  const node=new THREE.Group();node.name="Animated wave buoy";
  node.position.set(x,-.2,z);group.add(node);
  add(new THREE.SphereGeometry(.45,12,10),pbr(color,.42),"Floating marker buoy",0,0,0,node);
  add(new THREE.CylinderGeometry(.14,.2,.4,9),dockMetal,"Buoy mount",0,.42,0,node);
  add(new THREE.SphereGeometry(.12,9,7),pbr("#fff0c0",.18,.05,0xffe3b5),
   "Buoy navigation lamp",0,.74,0,node);
  const rim=add(new THREE.TorusGeometry(.33,.055,7,20),shell,"Reflective buoy rim",0,.03,0,node);
  rim.rotation.x=Math.PI/2;
  floaters.push({node,x,z,seed});
 }
 buoy(-11,14,"#e6684b",.25);buoy(13,26,"#f4b14b",.8);
 buoy(-16,43,"#e6684b",1.5);buoy(12,59,"#f4b14b",1.9);
 // Floating rescue raft shows ocean wave motion relative to static dock.
 const raft=new THREE.Group();raft.name="Floating rescue dinghy demonstration";
 group.add(raft);
 const orange=pbr("#e38b3f",.45);
 add(new THREE.BoxGeometry(3.6,.3,1.7),wetWood,"Rescue raft wooden floor",0,0,0,raft);
 for(const x of [-1.8,1.8]){
  const tube=add(new THREE.CylinderGeometry(.22,.22,1.83,12),orange,
   "Life raft flotation tube",x,.16,0,raft);
  tube.rotation.z=Math.PI/2;
 }
 for(const z of [-.84,.84]){
  const tube=add(new THREE.CylinderGeometry(.2,.2,3.6,12),orange,
   "Raft bow stern tube",0,.16,z,raft);tube.rotation.z=Math.PI/2;
 }
 add(new THREE.BoxGeometry(.18,1.4,.08),dockMetal,"Safety flag pole",1.1,.77,0,raft);
 add(new THREE.PlaneGeometry(.6,.3),pbr("#f8ae4e",.5),"Rescue pennant",1.4,1.36,0,raft);
 raft.position.set(-18,-.2,16);
 const seaDecor={group,mesh:water.mesh,islands,floaters,raft};
 function update(t){
  water.update(t);
  for(const item of floaters){
   item.node.position.y=water.heightAt(item.x,item.z,t)+.33;
   item.node.rotation.z=Math.sin(t*.87+item.seed)*.11;
   item.node.rotation.x=Math.cos(t*.79+item.seed)*.10;
  }
  raft.position.y=water.heightAt(-18,16,t)+.14;
  raft.rotation.x=Math.sin(t*.72)*.09;raft.rotation.z=Math.cos(t*.88)*.08;
 }
 function setSettings(next){return water.setSettings(next)}
 function dispose(){
  const geos=new Set(),mats=new Set();
  group.traverse(n=>{if(n.geometry)geos.add(n.geometry);
   const list=Array.isArray(n.material)?n.material:[n.material];
   for(const mat of list)if(mat)mats.add(mat);
  });
  for(const geo of geos)geo.dispose();
  for(const material of mats)material.dispose();
 }
 update(0);
 return {...seaDecor,update,setSettings,settings:water.settings,
  heightAt:water.heightAt,dispose};
}
