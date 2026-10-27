import test from "node:test";
import assert from "node:assert/strict";
import {createShot,sampleCameraPath,createBrollSequence,sampleBrollSequence,BROLL_SHOTS,normalizeFilmSettings,normalizeKeyframes,normalizedDuration} from "../workshop/studio/film-path.mjs";

test("all four cinema paths create real, changing camera motion",()=>{
 for(const shot of ["orbit","dolly","crane","flyover"]){
  const keys=createShot(shot,{world:"ocean",focus:[0,1,0],size:6});
  assert.ok(keys.length>=4,shot+" has enough distinct camera keyframes");
  const a=sampleCameraPath(keys,0),b=sampleCameraPath(keys,.5),c=sampleCameraPath(keys,1);
  assert.deepEqual(a.position,keys[0].position,shot+" opens on its first camera position");
  assert.deepEqual(c.position,keys.at(-1).position,shot+" ends on its last camera position");
  assert.notDeepEqual(a.position,b.position);
  assert.notDeepEqual(b.position,c.position);
  for(const pos of [a,b,c])assert.ok([...pos.position,...pos.target].every(Number.isFinite));
 }
});
test("smooth curve stays stable for custom two-shot sequence",()=>{
 const keys=[{position:[0,2,8],target:[0,1,0]},{position:[5,3,4],target:[0,1,0]}];
 const result=sampleCameraPath(keys,.5);
 assert.ok(Math.abs(result.position[0]-2.5)<.00001);
 assert.deepEqual(result.target,[0,1,0]);
 assert.deepEqual(sampleCameraPath(keys,10).position,[5,3,4]);
 assert.deepEqual(sampleCameraPath(keys,-1).position,[0,2,8]);
});
test("custom shots require two real keyframes and reject malformed input",()=>{
 assert.throws(()=>createShot("custom",{custom:[{position:[1,2,3],target:[0,0,0]}]}),/minst två/);
 const bad=[{position:[1,2,Infinity],target:[1,0,0]},null,{position:[1,2,3],target:[0,0,0]}];
 assert.equal(normalizeKeyframes(bad).length,1);
 assert.throws(()=>createShot("unknown"),/Okänd kamerarörelse/);
});
test("film settings enforce safe 1080p / 720p, 24/30fps and duration limits",()=>{
 assert.deepEqual(normalizeFilmSettings({quality:"1080",fps:24,duration:12,shot:"orbit",fov:40}),
 {quality:"1080",fps:24,fov:40,duration:12,shot:"orbit",width:1920,height:1080});
 assert.equal(normalizeFilmSettings({quality:"720",fps:30}).width,1280);
 const invalid=normalizeFilmSettings({quality:"4k",fps:900,fov:150,duration:500,shot:"bad"});
 assert.equal(invalid.quality,"1080");assert.equal(invalid.fps,24);
 assert.equal(invalid.fov,85);assert.equal(invalid.duration,40);assert.equal(invalid.shot,"orbit");
 assert.equal(normalizedDuration(-100),4);
});
test("ocean flyover covers enough distance to reveal waves and floating raft",()=>{
 const keys=createShot("flyover",{world:"ocean"});
 assert.ok(keys[0].position[2]<-20&&keys.at(-1).position[2]>100);
 const middle=sampleCameraPath(keys,.5,{ease:false});
 assert.ok(middle.position[1]>0);
 assert.ok(middle.position[2]>0);
});

test("five GLB-aware B-roll shots are physically separate and switch exactly every 20 percent",()=>{
 const shots=createBrollSequence({focus:[12,3,-5],size:5});
 assert.deepEqual(shots.map(s=>s.id),BROLL_SHOTS.map(s=>s.id));
 assert.equal(shots.length,5);
 assert.equal(new Set(shots.map(s=>JSON.stringify(s.frames[0].position))).size,5);
 for(let i=0;i<5;i++){
  const a=sampleBrollSequence(shots,(i+.1)/5);
  const b=sampleBrollSequence(shots,(i+.8)/5);
  assert.equal(a.shotIndex,i);
  assert.equal(a.shotLabel,shots[i].label);
  assert.notDeepEqual(a.position,b.position,"Each take must actually move the camera");
  assert.ok([...a.position,...a.target,...b.position,...b.target].every(Number.isFinite));
 }
 assert.equal(sampleBrollSequence(shots,1).shotIndex,4);
 assert.equal(normalizeFilmSettings({shot:"broll",duration:20}).shot,"broll");
 assert.throws(()=>sampleBrollSequence(shots.slice(0,4),.3),/fem/);
});
test("B-roll camera distance adapts to imported GLB scale without exceeding safe limits",()=>{
 const small=createBrollSequence({focus:[0,0,0],size:.2});
 const large=createBrollSequence({focus:[0,0,0],size:1000});
 for(const set of [small,large]){
  assert.equal(set.length,5);
  for(const shot of set)for(const frame of shot.frames)
   assert.ok([...frame.position,...frame.target].every(Number.isFinite));
 }
 const norm=p=>Math.hypot(...p);
 assert.ok(norm(large[0].frames[0].position)>norm(small[0].frames[0].position)*5);
});
