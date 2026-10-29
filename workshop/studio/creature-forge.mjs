// DuoForge Creature Forge V2 — original, local, parametric 360° creature presets.
// Models are real Three.js meshes and armatures, not single-image AI reconstructions.
// Uses existing Material Lab surfaces, rig bridge, editor history and GLB exporter.
import * as THREE from "three";
import {createSurfaceLibrary} from "./procedural-materials.mjs";
import {registerRigClips} from "./cinema-rig.mjs";

export const CREATURE_PRESETS = Object.freeze([
 {id:"castle",label:"🏰 Slottsgolem",description:"Sten, tinnar, mossa, armar och ben"},
 {id:"brute",label:"💪 Bergsbrut",description:"Muskler, rustning, horn och tvåbensrigg"},
 {id:"forest",label:"🌳 Skogsväktare",description:"Trä, rötter, hornlika grenar och rigg"},
 {id:"serpent",label:"🐍 Ormväktare",description:"Böjlig kropp, fjäll och flerbensrigg"}
]);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const RNG=s=>()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
const matte=(color,roughness=.86,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function mesh(group,name,geometry,mat,at=[0,0,0],scale=null){
 const obj=new THREE.Mesh(geometry,mat);obj.name=name;
 obj.position.set(...at);if(scale)obj.scale.set(...scale);
 obj.castShadow=obj.receiveShadow=true;group.add(obj);return obj;
}
function ball(group,name,mat,at,scale,detail){
 return mesh(group,name,new THREE.SphereGeometry(1,detail>=3?28:detail===2?20:12,detail>=3?20:12),mat,at,scale);
}
function box(group,name,mat,at,scale){
 return mesh(group,name,new THREE.BoxGeometry(...scale),mat,at);
}
function rod(group,name,mat,start,end,radius,detail){
 const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),diff=b.clone().sub(a);
 const obj=mesh(group,name,new THREE.CylinderGeometry(radius*.85,radius,diff.length(),detail>=3?12:8,2),mat,a.clone().add(b).multiplyScalar(.5).toArray());
 obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());return obj;
}
function cone(group,name,mat,at,radius,height,detail,rotation=0){
 const o=mesh(group,name,new THREE.ConeGeometry(radius,height,detail>=3?10:6),mat,at);
 o.rotation.z=rotation;return o;
}
function addBranch(group,name,mat,origin,dir,scale,detail){
 const end=origin.map((v,i)=>v+dir[i]*scale);
 rod(group,name,mat,origin,end,.09*scale,detail);
 const twigs=detail>=3?3:2;
 for(let i=0;i<twigs;i++){
  const p=origin.map((v,j)=>v+dir[j]*scale*(.4+i*.15));
  const tip=[p[0]+scale*(i%2?-.44:.36),p[1]+scale*.42,p[2]+scale*.24];
  rod(group,name+" · kvist "+i,mat,p,tip,.035*scale,detail);
 }
}
function textureForScales(detail,base){
 // Procedural albedo + matching tangent-space normal map, embedded by GLB export.
 const n=detail===3?512:detail===2?256:128;
 const c=document.createElement("canvas"),normal=document.createElement("canvas");
 c.width=c.height=normal.width=normal.height=n;
 const ctx=c.getContext("2d"),nc=normal.getContext("2d");
 ctx.fillStyle=base;ctx.fillRect(0,0,n,n);
 const step=detail===1?20:16;
 for(let row=0;row<Math.ceil(n/step)+1;row++)for(let col=-1;col<Math.ceil(n/step)+1;col++){
  const x=col*step+(row%2)*step/2,y=row*step;
  ctx.fillStyle=(row+col)%3===0?"rgba(239,217,128,.24)":"rgba(4,29,23,.18)";
  ctx.beginPath();ctx.ellipse(x+step/2,y+step/2,step*.52,step*.42,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(8,34,22,.62)";ctx.lineWidth=1.6;ctx.stroke();
 }
 const src=ctx.getImageData(0,0,n,n),dst=nc.createImageData(n,n);
 const shade=(x,y)=>src.data[4*((((y+n)%n)*n+(x+n)%n))];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const dx=(shade(x+1,y)-shade(x-1,y))/255,dy=(shade(x,y+1)-shade(x,y-1))/255;
  const l=Math.hypot(dx*2,dy*2,1),i=(y*n+x)*4;
  dst.data[i]=Math.round(128+127*(-dx*2/l));
  dst.data[i+1]=Math.round(128+127*(-dy*2/l));
  dst.data[i+2]=Math.round(128+127/l);dst.data[i+3]=255;
 }
 nc.putImageData(dst,0,0);
 const map=new THREE.CanvasTexture(c),normalMap=new THREE.CanvasTexture(normal);
 map.colorSpace=THREE.SRGBColorSpace;
 for(const t of [map,normalMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,2);t.needsUpdate=true;}
 return {map,normalMap};
}
function surfaces(detail){
 const lib=createSurfaceLibrary(detail===3?"high":detail===1?"low":"medium");
 const scaleTex=textureForScales(detail,"#6e8961");
 return {
  stone:lib.material("stone",{color:"#95998d",repeat:[2,2]}),
  moss:lib.material("grass",{color:"#527c39"}),
  bark:lib.material("bark",{color:"#735337"}),
  leaves:lib.material("grass",{color:"#486e38"}),
  skin:lib.material("leather",{color:"#777c85",repeat:[2,2]}),
  dark:matte(0x282f35),gold:lib.material("brushed",{color:"#a69a73"}),
  eyes:new THREE.MeshStandardMaterial({color:0x49f3b5,emissive:0x138059,emissiveIntensity:.75}),
  scales:new THREE.MeshStandardMaterial({color:0xffffff,map:scaleTex.map,normalMap:scaleTex.normalMap,roughness:.56,metalness:.19}),
  cream:matte(0xc0b98a),roof:matte(0x486640),wood:lib.material("wood",{color:"#87694c"})
 };
}
// Every limb is deformable SkinnedMesh with two weighted bones, not an animated rigid cylinder.
function limb(root,prefix,mat,at,length,radius,detail){
 const geo=new THREE.CylinderGeometry(radius*.92,radius*.67,length,detail===3?20:12,detail===3?16:10,true);
 geo.translate(0,-length/2,0);
 const pos=geo.attributes.position,indices=[],weights=[];
 for(let i=0;i<pos.count;i++){
  const t=clamp((-pos.getY(i)/length-.32)/.40,0,1);
  indices.push(0,1,0,0);weights.push(1-t,t,0,0);
 }
 geo.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
 geo.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
 const sk=new THREE.SkinnedMesh(geo,mat);
 sk.name=prefix+" · skinnad lem";sk.position.set(...at);sk.castShadow=sk.receiveShadow=true;
 const upper=new THREE.Bone();upper.name=prefix+"_upper";
 const lower=new THREE.Bone();lower.name=prefix+"_lower";lower.position.y=-length*.62;
 upper.add(lower);sk.add(upper);sk.updateMatrixWorld(true);
 sk.bind(new THREE.Skeleton([upper,lower]));
 root.add(sk);
 ball(lower,prefix+" · led",mat,[0,0,0],[radius*.83,radius*.83,radius*.83],detail);
 return {upper,lower,mesh:sk,endBone:lower,tipY:-length*.38};
}
function bindHumanoid(root,kind,detail,m){
 const legs=[],arms=[],rand=RNG(324);
 const bodyMat=kind==="castle"?m.stone:kind==="forest"?m.bark:m.skin;
 const headY=kind==="castle"?3.12:3.18;
 ball(root,"Bål · 360° volym",bodyMat,[0,2.13,0],[.73,.89,.53],detail);
 ball(root,"Höft",bodyMat,[0,1.45,0],[.63,.4,.43],detail);
 for(const sign of [-1,1]){
  const label=sign<0?"Left":"Right",arm=limb(root,"DF_"+kind+"_Arm_"+label,bodyMat,[sign*.82,2.64,.02],1.37,.27,detail);
  arms.push({bone:arm.upper,lower:arm.lower,sign});
  ball(arm.endBone,"Hand "+label,bodyMat,[0,arm.tipY,0],[.28,.26,.24],detail);
  const leg=limb(root,"DF_"+kind+"_Leg_"+label,bodyMat,[sign*.39,1.36,0],1.19,.30,detail);
  legs.push({bone:leg.upper,lower:leg.lower,sign});
  ball(leg.endBone,"Fot "+label,bodyMat,[0,leg.tipY,-.14],[.32,.19,.43],detail);
 }
 if(kind==="castle"){
  // Castle is a golem: masonry body, crenellations, turrets and moss — independent 3D parts.
  box(root,"Fasad · mursten",m.stone,[0,2.3,.44],[1.28,1.55,.23]);
  box(root,"Slottstorn mitt",m.stone,[0,3.2,0],[.57,1.05,.58]);
  for(const sign of [-1,1]){
   box(root,"Sidetorn "+sign,m.stone,[sign*.48,3.17,0],[.36,1.2,.39]);
   cone(root,"Spirspets "+sign,m.roof,[sign*.48,3.95,0],.28,.7,detail);
   for(let i=0;i<3;i++)box(root,"Tinnar "+sign+" "+i,m.stone,[sign*.55,3.09,i*.24-.24],[.22,.18,.17]);
  }
  box(root,"Port · dörröppning",m.dark,[0,1.89,.585],[.27,.54,.06]);
  box(root,"Port · trädörr",m.wood,[0,1.88,.633],[.18,.45,.04]);
  for(let i=0;i<(detail===1?10:detail===2?20:34);i++){
   const x=(rand()-.5)*1.25,y=1.5+rand()*1.5;
   box(root,"Murkalk "+i,m.stone,[x,y,.565],[.16+rand()*.12,.08,.055]);
  }
  for(let i=0;i<8;i++)ball(root,"Mossa "+i,m.moss,[(rand()-.5)*1.1,1.65+rand()*1.9,(rand()-.5)*.86],[.13,.055,.14],1);
 }else if(kind==="brute"){
  ball(root,"Huvud · kraftig käke",m.skin,[0,headY,.02],[.41,.40,.39],detail);
  ball(root,"Skägg · mustasch",m.dark,[0,2.91,.34],[.38,.21,.17],detail);
  for(const sign of [-1,1]){
   ball(root,"Panna / bryn "+sign,m.dark,[sign*.19,3.28,.34],[.16,.07,.09],detail);
   ball(root,"Öga "+sign,m.eyes,[sign*.18,3.21,.377],[.045,.055,.025],detail);
   cone(root,"Horn "+sign,m.cream,[sign*.32,3.56,.02],.16,.47,detail,sign*-.36);
  }
  box(root,"Bröstrem / rustning",m.dark,[0,2.33,.51],[1.11,.16,.16]).rotation.z=.35;
  box(root,"Bältespänne",m.gold,[0,1.57,.44],[.31,.21,.09]);
  for(const sign of [-1,1])ball(root,"Axelmuskel "+sign,m.skin,[sign*.71,2.67,0],[.35,.39,.34],detail);
 }else{
  ball(root,"Rotansikte",m.bark,[0,headY,.07],[.39,.45,.30],detail);
  for(const sign of [-1,1]){
   ball(root,"Lysande öga "+sign,m.eyes,[sign*.16,3.2,.344],[.058,.067,.04],detail);
   addBranch(root,"Grenkrona "+sign,m.bark,[sign*.26,3.5,0],[sign*.52,.87,sign*.10],1.1,detail);
   for(let i=0;i<4;i++)ball(root,"Lövverk "+sign+" "+i,m.leaves,[sign*(.4+i*.13),3.6+(.13*i),.18],[.21,.14,.23],1);
  }
  for(let i=0;i<5;i++){
   const a=i*Math.PI*2/5;
   rod(root,"Rötter "+i,m.bark,[Math.sin(a)*.32,1.55,Math.cos(a)*.28],
    [Math.sin(a)*.65,1.12,Math.cos(a)*.59],.09,detail);
  }
 }
 root.updateMatrixWorld(true);
 return {arms,legs};
}
function quaternionTrack(bone,times,angles){
 const data=[];
 for(const [x,y,z] of angles){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));data.push(q.x,q.y,q.z,q.w);}
 return new THREE.QuaternionKeyframeTrack(bone.name+".quaternion",times,data);
}
function humanoidClips(rig){
 const clips=[];
 const t=[0,.25,.5,.75,1],t2=[0,.25,.5,.75,1.0];
 const idle=[],walk=[],attack=[];
 for(const group of ["arms","legs"])for(const {bone,lower,sign} of rig[group]){
  const sway=t.map(v=>[Math.sin(v*Math.PI*2)*(group==="arms"?.055:.015),0,sign*(group==="arms"?.04:.01)]);
  idle.push(quaternionTrack(bone,t,sway));
  walk.push(quaternionTrack(bone,t,t.map(v=>[(group==="arms"?-.46:.52)*sign*Math.sin(v*Math.PI*2),0,sign*.03])));
  attack.push(quaternionTrack(bone,t2,t2.map(v=>group==="arms"&&sign===1?[-1.25*Math.sin(v*Math.PI),0,-.3*Math.sin(v*Math.PI)]:[0,0,0])));
  walk.push(quaternionTrack(lower,t,t.map(v=>[group==="legs"?.45*Math.max(0,Math.sin(v*Math.PI*2*sign)):.08,0,0])));
 }
 for(const [name,duration,tracks] of [["Idle",1,idle],["Walk",1,walk],["Attack",1,attack]]){
  clips.push(new THREE.AnimationClip(name,duration,tracks));
 }
 return clips;
}
function makeSnake(root,detail,m){
 const length=detail===3?104:detail===2?72:40,radial=detail===3?18:12;
 const points=[];
 // Coiled tail on the ground and an upright, curved neck with a defined face.
 for(let i=0;i<=46;i++){
  const t=i/46,angle=t*3.1*Math.PI,r=1.26-.64*t;
  points.push(new THREE.Vector3(Math.cos(angle)*r,.26+.13*t,Math.sin(angle)*r));
 }
 for(let i=1;i<=22;i++){
  const t=i/22;
  points.push(new THREE.Vector3(.58-.32*t+.11*Math.sin(t*Math.PI),.39+2.22*t,.1+.18*t));
 }
 const curve=new THREE.CatmullRomCurve3(points);
 const frames=curve.computeFrenetFrames(length,false);
 const verts=[],uv=[],ids=[],idx=[],weights=[];
 const bones=[],boneCount=detail===3?19:detail===2?15:11;
 for(let j=0;j<boneCount;j++){
  const b=new THREE.Bone();b.name="DF_serpent_Bone_"+j;
  const p=curve.getPointAt(j/(boneCount-1));
  if(j===0)b.position.copy(p);else b.position.copy(p.sub(curve.getPointAt((j-1)/(boneCount-1))));
  if(j>0)bones[j-1].add(b);bones.push(b);
 }
 for(let i=0;i<=length;i++){
  const t=i/length,center=curve.getPointAt(t);
  const neck=t>.70,thickness=neck?.17+(1-t)*.10:.13+Math.min(t/.32,1)*.27;
  for(let j=0;j<=radial;j++){
   const a=j/radial*Math.PI*2;
   const offset=frames.normals[i].clone().multiplyScalar(Math.cos(a)*thickness)
    .addScaledVector(frames.binormals[i],Math.sin(a)*thickness);
   const p=center.clone().add(offset);
   verts.push(p.x,p.y,p.z);uv.push(j/radial,t*4);
   const bind=t*(boneCount-1),lo=Math.min(boneCount-2,Math.floor(bind)),blend=bind-lo;
   ids.push(lo,lo+1,0,0);weights.push(1-blend,blend,0,0);
   if(i<length&&j<radial){
    const v=i*(radial+1)+j;
    idx.push(v,v+radial+1,v+1,v+1,v+radial+1,v+radial+2);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
 geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(ids,4));
 geo.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
 geo.setIndex(idx);geo.computeVertexNormals();
 const skin=new THREE.SkinnedMesh(geo,m.scales);skin.name="Serpent · deformable 360° scales";
 skin.castShadow=skin.receiveShadow=true;skin.add(bones[0]);skin.updateMatrixWorld(true);
 skin.bind(new THREE.Skeleton(bones));root.add(skin);
 const head=bones.at(-1);
 ball(head,"Ormhuvud",m.scales,[0,.08,0],[.33,.27,.42],detail);
 ball(head,"Nos / käke",m.cream,[0,-.10,.27],[.28,.11,.29],detail);
 for(const sign of [-1,1]){
  ball(head,"Ormögon "+sign,m.eyes,[sign*.23,.15,.24],[.07,.065,.06],detail);
  cone(head,"Ögonhorn "+sign,m.gold,[sign*.25,.31,.04],.08,.29,detail,sign*.3);
 }
 const times=[0,.25,.5,.75,1],slither=[],strike=[];
 for(const [i,b] of bones.entries()){
  const phase=i*.48,scale=i===0?.07:.1+i*.006;
  slither.push(quaternionTrack(b,times,times.map(v=>[0,Math.sin(v*2*Math.PI+phase)*scale,Math.sin(v*2*Math.PI+phase)*scale*.35])));
  strike.push(quaternionTrack(b,times,times.map(v=>[i>boneCount-5?-Math.sin(v*Math.PI)*.18:0,Math.sin(v*Math.PI*2)*.06,0])));
 }
 return [new THREE.AnimationClip("Slither",1,slither),new THREE.AnimationClip("Strike",1,strike)];
}
export function matchCreaturePrompt(input){
 const text=String(input||"").toLocaleLowerCase("sv");
 if(/orm|snake|serpent|drake|snake|fjäll/.test(text))return "serpent";
 if(/skog|trä|wood|tree|gren|rot|ent/.test(text))return "forest";
 if(/slott|castle|golem|borg|mur|stone/.test(text))return "castle";
 if(/muskel|jätte|brut|monster|troll|fighter|orc/.test(text))return "brute";
 return null;
}
export function createCreature({type="castle",detail=2,size=1}={}){
 const kind=CREATURE_PRESETS.some(p=>p.id===type)?type:"castle";
 const density=clamp(Math.round(Number(detail)||2),1,3);
 const scale=clamp(Number(size)||1,.4,2.5);
 const root=new THREE.Group();
 root.name=CREATURE_PRESETS.find(p=>p.id===kind).label.replace(/^[^\p{L}]+/u,"");
 root.userData={duoforgeGenerator:"creature-forge@2",kind,detail:density,
  note:"Original procedural 360 degree topology; not a photorealistic AI reconstruction"};
 const m=surfaces(density);
 const clips=kind==="serpent"?makeSnake(root,density,m):humanoidClips(bindHumanoid(root,kind,density,m));
 root.animations=clips;registerRigClips(root,clips);
 root.scale.setScalar(scale);
 return root;
}
export function initCreatureForge({root,select,pushHistory,refreshTree,updateStats,fitScene,dirty,notify}){
 const parent=document.getElementById("characterForge");
 if(!parent||document.getElementById("creatureForge"))return;
 const section=document.createElement("div");section.id="creatureForge";section.className="creature-forge-v2";
 section.innerHTML=[
  '<hr><div class="subheading">⚡ Creature Forge V2 <small>enkelklick • 0 API-krediter</small></div>',
  '<p class="hint">Fyra originalvarelser med verklig 360°-geometri, PBR, skinning och GLB-animationer. Stilen är procedurbyggd – inte samma detaljnivå som AI-skulpterad reklamgrafik.</p>',
  '<label class="field-label" for="creaturePrompt">Beskriv eller välj en varelse</label>',
  '<input id="creaturePrompt" type="text" maxlength="180" placeholder="T.ex. en mossig slottsgolem">',
  '<select id="creatureType" aria-label="Välj varelsen"></select>',
  '<label class="field-label" for="creatureDetail">Prestandaprofil</label>',
  '<select id="creatureDetail"><option value="1">Mobil • lågpoly</option><option value="2" selected>Balanserad</option><option value="3">Hög detalj</option></select>',
  '<button id="creatureCreate" class="accent">⚡ Bygg, rigga och texturera</button>',
  '<label class="field-label" for="creatureMotion">Provspela animering</label>',
  '<select id="creatureMotion" aria-label="Välj animering" disabled><option value="">Skapa en varelse först</option></select>',
  '<button id="creatureStop" disabled>■ Stoppa rörelse</button>',
  '<p id="creatureStatus" class="hint" role="status">Färdig GLB exporteras med knappen Exportera GLB högst upp.</p>'
 ].join("");
 const before=parent.querySelector("#forgeCreate");
 if(before)before.insertAdjacentElement("afterend",section);else parent.append(section);
 const $=id=>section.querySelector("#"+id);
 for(const item of CREATURE_PRESETS){const opt=document.createElement("option");opt.value=item.id;opt.textContent=item.label+" — "+item.description;$("creatureType").append(opt);}
 let animation=null;
 function stop(){
  if(animation){animation.mixer.stopAllAction();animation.mixer.uncacheRoot(animation.group);
   animation.group.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose()});
   animation=null;
  }
  $("creatureStop").disabled=true;
 }
 function animate(time){
  if(!animation)return;
  const a=animation;
  if(a.group.parent!==root){stop();return}
  a.mixer.update(Math.min(.06,(time-a.previous)/1000));a.previous=time;
  if(animation===a)requestAnimationFrame(animate);
 }
 $("creatureMotion").onchange=()=>{
  const value=$("creatureMotion").value,group=animation?.group||section._lastCreated;
  stop();
  if(!value||!group||group.parent!==root)return;
  const clip=group.animations.find(c=>c.name===value);
  if(!clip)return;
  const mixer=new THREE.AnimationMixer(group);mixer.clipAction(clip).play();
  animation={group,mixer,previous:performance.now()};
  $("creatureStop").disabled=false;
  requestAnimationFrame(animate);
 };
 $("creatureStop").onclick=()=>{$("creatureMotion").value="";stop();};
 $("creatureCreate").onclick=()=>{
  try{
   stop();
   const prompt=$("creaturePrompt").value;
   const type=matchCreaturePrompt(prompt)||$("creatureType").value;
   const group=createCreature({type,detail:Number($("creatureDetail").value)});
   pushHistory();root.add(group);select(group);refreshTree();updateStats();fitScene(group);dirty();
   section._lastCreated=group;$("creatureType").value=type;
   $("creatureMotion").replaceChildren(new Option("Välj rörelse",""),
    ...group.animations.map(c=>new Option(c.name,c.name)));
   $("creatureMotion").disabled=false;
   const count=group.animations.length;
   $("creatureStatus").textContent=group.name+" klar: skinnade meshar, PBR och "+count+" GLB-klipp. Exportera GLB i toppmenyn.";
   notify(group.name+" klar med skinning, textur och "+count+" rörelser.",4500);
  }catch(e){console.error(e);$("creatureStatus").textContent="Kunde inte skapa varelsen: "+e.message;notify(e.message,6000)}
 };
}
