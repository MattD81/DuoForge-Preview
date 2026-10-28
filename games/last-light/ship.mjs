import * as THREE from "three";
import {materialLab,glassMaterial} from "./pbr-materials.mjs";
// Original procedural rescue cruiser. Real closed 3D geometry, fully modeled back.
// All components belong to one group and can be exported as a reusable GLB.
export function createRescueShip(){
 const ship=new THREE.Group();ship.name="LAST LIGHT — AURORA rescue vessel";
 const paint=materialLab("hull");
 const navy=materialLab("darkPaint");
 const cabin=materialLab("ceramic");
 const deck=materialLab("teak");
 const brass=materialLab("bronze");
 const steel=materialLab("steel");
 const orange=materialLab("safety");
 const glow=new THREE.MeshStandardMaterial({color:0x44e8f5,emissive:0x0ac8e8,emissiveIntensity:2.2,metalness:.15,roughness:.2});
 const glass=glassMaterial();
 const glassDark=new THREE.MeshPhysicalMaterial({color:0x193643,metalness:.15,roughness:.09,clearcoat:1,clearcoatRoughness:.07,ior:1.5});
 const mesh=(geometry,material,name,x=0,y=0,z=0,parent=ship)=>{
  const item=new THREE.Mesh(geometry,material);item.name=name;item.position.set(x,y,z);
  item.castShadow=true;item.receiveShadow=true;parent.add(item);return item;
 };
 const box=(name,material,w,h,d,x,y,z,parent=ship)=>mesh(new THREE.BoxGeometry(w,h,d),material,name,x,y,z,parent);
 const cyl=(name,material,r1,r2,len,x,y,z,segments=16,parent=ship)=>mesh(new THREE.CylinderGeometry(r1,r2,len,segments),material,name,x,y,z,parent);
 const tube=(name,material,points,radius=.035,parent=ship)=>mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*8),radius,6,false),
  material,name,0,0,0,parent);
 // Smooth 24-section closed watertight bow/stern hull mesh.
 const positions=[],indices=[],steps=42,sides=20;
 for(let i=0;i<=steps;i++){
  const z=-7.2+i/steps*14.4;
  const t=i/steps,point=.12+.88*Math.pow(Math.sin(Math.PI*t),.52);
  const bow=t<.32?.9+Math.sin(t/.32*Math.PI)*.1:1;
  const width=2.23*point*bow;
  for(let j=0;j<sides;j++){
   const a=2*Math.PI*j/sides;
   positions.push(Math.sin(a)*width, .13+1.06*Math.cos(a), z);
  }
 }
 for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
  const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;
  indices.push(a,c,b,b,c,d);
 }
 // Cap bow and stern: safe closed volume when exporting.
 for(const [end,reverse] of [[0,true],[steps,false]]){
  const center=positions.length/3;positions.push(0,.13,-7.2+end/steps*14.4);
  for(let j=0;j<sides;j++){
   const a=end*sides+j,b=end*sides+(j+1)%sides;
   if(reverse)indices.push(center,a,b);else indices.push(center,b,a);
  }
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));geom.setIndex(indices);geom.computeVertexNormals();
 mesh(geom,paint,"Aurora sculpted enclosed displacement hull");
 // Fore/aft decks and tapered prow.
 box("Main teak deck",deck,3.95,.16,11.8,0,1.14,.1);
 const prow=mesh(new THREE.ConeGeometry(1.55,3.9,4),deck,"Tapered foredeck",0,1.16,-5.64);
 prow.rotation.x=Math.PI/2;prow.rotation.y=Math.PI/4;prow.scale.y=.22;
 box("Aft boarding deck",deck,3.4,.12,2.0,0,1.15,5.75);
 // Continuous waist stripe and protective rub rails.
 for(const side of [-1,1]){
  tube("Marine hull silver rub rail",steel,Array.from({length:19},(_,i)=>{
   const z=-6.7+i*.74,t=(z+7.2)/14.4;
   return [side*2.24*(.12+.88*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.52)),.58,z];
  }),.047);
  for(let z=-5.4;z<6.4;z+=.86){
   const t=(z+7.2)/14.4;
   const x=side*(1.97*(.12+.88*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.52)));
   cyl("Deck stanchion",steel,.035,.039,.8,x,1.65,z,9);
  }
  tube("Upper lifeline stainless steel",steel,Array.from({length:16},(_,i)=>{
   const z=-5.4+i*.79,t=(z+7.2)/14.4;
   return [side*1.97*(.12+.88*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.52)),2.04,z];
  }),.026);
  const strip=box("Electric teal side signature",glow,.055,.055,7.8,side*2.08,.25,.55);
  strip.rotation.y=side*.026;
  for(const z of [-4.2,3.65]){
   const ring=mesh(new THREE.TorusGeometry(.32,.085,10,24),orange,"Rescue life ring",side*1.9,1.55,z);
   ring.rotation.y=Math.PI/2;
  }
 }
 // Deck planking seams.
 for(let i=-14;i<=14;i++)box("Deck plank seam",navy,.012,.012,8.1,i*.127,1.233,.4);
 // Bridge and upper cabin – all four sides detailed.
 box("Forward wheelhouse foundation",navy,3.35,1.5,3.4,0,2.05,-1.1);
 box("Wheelhouse white cladding",cabin,3.48,1.4,3.55,0,2.91,-1.05);
 box("Cantilever bridge roof",navy,3.9,.22,4.15,0,3.75,-1.05);
 box("Radar upper deck",steel,2.4,.12,2.25,0,3.91,-1.05);
 for(const side of [-1,1]){
  for(let z=-2.25;z<.3;z+=.69){
   box("Wheelhouse panoramic side glazing",glass,.035,.71,.59,side*1.77,3.04,z);
   box("Window frame lower",brass,.045,.045,.6,side*1.79,2.67,z);
  }
  for(let z of [1.35,2.7,4.05]){
   box("Passenger cabin porthole frame",brass,.07,.6,.68,side*1.4,2.1,z);
   box("Passenger cabin porthole glass",glassDark,.08,.4,.5,side*1.45,2.1,z);
  }
 }
 for(let x=-1.3;x<=1.31;x+=.66){
  box("Bridge front tempered glass",glass,.58,.9,.035,x,3.05,-2.845);
  box("Bridge rear tempered glass",glass,.58,.85,.035,x,3.05,.745);
 }
 // Central passenger cabin, curved orange roof and ventilation.
 box("Passenger quarters",cabin,2.85,1.65,4.45,0,2.05,2.85);
 box("Passenger roof",navy,3.14,.19,4.85,0,2.97,2.85);
 for(const z of [2.1,4.15])cyl("Twin marine exhaust",navy,.32,.39,1.95,0,4.0,z,24);
 for(const z of [2.1,4.15])cyl("Exhaust upper copper rim",brass,.36,.36,.15,0,5.05,z,24);
 for(const side of [-1,1]){
  for(const z of [1.3,2.7,4.1]){
   const boat=mesh(new THREE.CapsuleGeometry(.35,1.5,6,12),orange,"Inflatable rescue raft",side*1.73,2.0,z);
   boat.rotation.x=Math.PI/2;
  }
 }
 // Mast, signal antennas, spinning radar and searchlight fixture.
 cyl("Signal mast",steel,.09,.13,4.9,0,6.45,-1.8,12);
 const radar=new THREE.Group();radar.name="Rotating radar scanner";radar.position.set(0,8.45,-1.8);ship.add(radar);
 box("Radar scanner wing",cabin,2.15,.12,.27,0,.13,0,radar);
 box("Radar scanner sensor",glassDark,.3,.4,.4,0,.25,0,radar);
 cyl("Radar rotation axis",steel,.11,.11,.3,0,0,0,12,radar);
 for(const side of [-1,1]){
  cyl("Aerial extension",steel,.028,.04,2.2,side*.6,7.1,-1.7,10);
  const lamp=mesh(new THREE.SphereGeometry(.16,12,8),side===1?orange:glow,"Navigation sidelight",side*1.9,2.2,-4.9);
  lamp.material.emissiveIntensity=side===1?0:2.2;
 }
 const searchHead=new THREE.Group();searchHead.name="Forward gimbal searchlight";
 searchHead.position.set(-1.17,4.05,-2.1);ship.add(searchHead);
 cyl("Searchlight body",steel,.37,.38,.7,0,0,0);
 const lens=mesh(new THREE.CylinderGeometry(.32,.32,.03,20),new THREE.MeshBasicMaterial({color:0xf3f5df}),"Searchlight lens",0,0,-.42,searchHead);
 lens.rotation.x=Math.PI/2;
 const spotlight=new THREE.SpotLight(0xd7f0ff,35,85,.32,.58,1.6);
 spotlight.position.set(0,0,-.4);searchHead.add(spotlight);
 const aim=new THREE.Object3D();aim.position.set(0,-7,-40);searchHead.add(aim);spotlight.target=aim;
 const sternLantern=mesh(new THREE.SphereGeometry(.15,12,8),glow,"Stern lantern",0,2.05,6.8);
 // Rigging, winch and anchor.
 for(const side of [-1,1])tube("Rescue rigging cable",steel,[[0,7.2,-1.8],[side*1.55,3.5,-3.4],[side*1.95,1.78,-5.45]],.018);
 cyl("Anchor winch",brass,.32,.32,1.45,0,1.48,-4.8);
 box("Mooring cleat",steel,.7,.16,.2,0,1.48,-5.8);
 const propellers=[];
 for(const side of [-1,1]){
  const prop=new THREE.Group();prop.name="Working stern propeller";
  prop.position.set(side*.95,-.58,6.25);ship.add(prop);
  cyl("Propeller shaft",steel,.1,.12,.6,0,0,0,12,prop).rotation.x=Math.PI/2;
  for(let k=0;k<4;k++){
   const blade=mesh(new THREE.BoxGeometry(.13,.66,.05),brass,"Four-blade ship screw",0,0,0,prop);
   blade.rotation.z=k*Math.PI/2;blade.position.set(Math.sin(k*Math.PI/2)*.35,Math.cos(k*Math.PI/2)*.35,0);
  }
  propellers.push(prop);
 }
 // Ship name placard can be read from either side.
 const makeName=()=>{
  const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=200;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,1024,200);ctx.fillStyle="#e1ddbe";ctx.font="bold 108px Arial,sans-serif";
  ctx.textAlign="center";ctx.fillText("A U R O R A",512,128);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
 };
 const nameMaterial=makeName();
 for(const side of [-1,1]){
  const sign=mesh(new THREE.PlaneGeometry(3.15,.62),nameMaterial,"Aurora nameplate",side*2.22,.82,-.45);
  sign.rotation.y=side*Math.PI/2;
 }
 // Avoid per-frame allocations for all scene geometries; expose only animated parts.
 ship.userData.rescueCraft=true;
 return {group:ship,
  update(time,speed){
   radar.rotation.y=time*.75;
   searchHead.rotation.y=Math.sin(time*.43)*.35;
   sternLantern.scale.setScalar(1+.08*Math.sin(time*2));
   propellers.forEach((p,i)=>{p.rotation.z+=.02+Math.abs(speed)*.018*(i?1:-1);});
  }};
}
