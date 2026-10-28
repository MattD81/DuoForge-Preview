/**
 * Reuses Character Forge V3 assets and Rift's validated GLB loading, original
 * glTF armatures, glTF AnimationClips and facial blend shapes.
 *
 * Optional visual upgrade, NOT a replacement of Stormblade combat physics.
 * The original Viking models remain the playable fallback on any failure.
 */
import * as THREE from "three";
import {loadDetailedFighter,updateFacialRig} from "../rift-champions/fighter-loader.mjs";

const CLIP_NAMES={
 idle:["idle","breath","stance"],
 walk:["walk","run","move"],
 heavy:["heavy","slam","power","special"],
 attack:["jab","punch","strike","attack","slash"],
 hurt:["hurt","hit","react"],
 block:["block","guard"]
};
const MODEL_PATHS=[
 "../../workshop/models/rift-kael-skinned-v3.glb",
 "../../workshop/models/rift-vex-skinned-v3.glb"
];
function chooseClip(clips,move){
 const names=CLIP_NAMES[move]||CLIP_NAMES.idle;
 return clips.find(clip=>names.some(name=>clip.name.toLowerCase().includes(name)))
  ||clips.find(clip=>CLIP_NAMES.idle.some(name=>clip.name.toLowerCase().includes(name)))
  ||clips[0]||null;
}
export function createFighterUpgrade(world,{loader=loadDetailedFighter,onStatus=()=>{}}={}){
 const targets=[world.player,world.opponent];
 const records=[null,null];
 let loading=null,enabled=false;
 async function load(){
  if(loading)return loading;
  if(records.every(Boolean)){enabled=true;setVisible(true);return true}
  loading=(async()=>{
   const next=[];
   try{
    for(let i=0;i<2;i++){
     onStatus("Laddar riktig GLB V3 "+(i+1)+"/2 ...");
     const rig=await loader(MODEL_PATHS[i],i);
     if(!rig?.root||!rig.root.isObject3D)throw Error("GLB-modellen innehåller ingen riktig 3D-scen");
     const box=new THREE.Box3().setFromObject(rig.root);
     const size=box.getSize(new THREE.Vector3());
     if(box.isEmpty()||!Number.isFinite(size.y)||size.y<.1)throw Error("Ogiltig GLB-skala");
     const scale=2.88/size.y;
     const group=new THREE.Group();
     group.name="Character Forge V3 — "+(i===0?"KAEL":"VEX");
     group.position.set(-(box.min.x+box.max.x)*.5*scale,
      -.45-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);
     group.scale.setScalar(scale);
     group.add(rig.root);
     const mixer=rig.clips?.length?new THREE.AnimationMixer(rig.root):null;
     const record={rig,group,mixer,current:null};
     records[i]=record;next.push(record);
     targets[i].root.add(group);
     group.visible=false;
    }
    enabled=true;setVisible(true);
    onStatus("Character Forge V3 aktiv: två GLB-modeller med riktiga riggar och ansiktsuttryck");
    return true;
   }catch(err){
    for(let i=0;i<2;i++) {
     const item=records[i];
     if(item){item.mixer?.stopAllAction();targets[i].root.remove(item.group);records[i]=null;}
    }
    enabled=false;setVisible(false);
    onStatus("V3 kunde inte laddas — originalkrigarna används: "+String(err?.message||err).slice(0,100));
    return false;
   }finally{loading=null}
  })();
  return loading;
 }
 function setVisible(visible){
  for(let i=0;i<2;i++){
   const entry=records[i];if(!entry)continue;
   for(const child of targets[i].root.children)child.visible=child===entry.group?visible:!visible;
  }
 }
 function toggle(){
  if(loading)return loading;
  if(enabled){enabled=false;setVisible(false);onStatus("Originalkrigarna aktiva");return Promise.resolve(false)}
  if(records.every(Boolean)){enabled=true;setVisible(true);onStatus("Character Forge V3 aktiverad");return Promise.resolve(true)}
  return load();
 }
 function update(dt,time,states){
  if(!enabled)return;
  for(let i=0;i<2;i++){
   const record=records[i];if(!record)continue;
   const state=states[i],move=state.hurt>0?"hurt":state.block?"block":
    state.swing>0?(state.heavy?"heavy":"attack"):state.walk?"walk":"idle";
   const clip=chooseClip(record.rig.clips||[],move);
   if(clip&&record.current!==clip){
    const action=record.mixer.clipAction(clip);
    action.enabled=true;action.reset().play();
    if(record.current){
     const previous=record.mixer.existingAction(record.current);
     if(previous)previous.crossFadeTo(action,.14,true);
    }
    record.current=clip;
   }
   record.mixer?.update(Math.max(0,Math.min(.06,dt)));
   updateFacialRig(record.rig,{
    hitstun:state.hurt||0,
    blockstun:state.block?1:0,
    move:move==="heavy"?"heavy":move==="attack"?"jab":move
   },time,dt);
  }
 }
 return Object.freeze({
  toggle,load,update,get enabled(){return enabled},
  get status(){return loading?"loading":enabled?"v3":"procedural"},
  modelPaths:MODEL_PATHS.slice()
 });
}
