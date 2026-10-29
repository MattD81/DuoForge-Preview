import test from "node:test";
import assert from "node:assert/strict";
import {lookdevSettings,lookdevShadowExtent,LOOKDEV_PRESETS}
 from "../workshop/studio/lookdev-presets.mjs";
import {readFileSync} from "node:fs";
test("all four LookDev presets are valid artist-directed lighting sets",()=>{
 assert.deepEqual(Object.keys(LOOKDEV_PRESETS),["studio","daylight","golden","neon"]);
 for(const [key,p] of Object.entries(LOOKDEV_PRESETS)){
  const a=lookdevSettings(key);
  assert.equal(a.key,key);
  assert.ok(a.exposure>=.6&&a.exposure<=2.1);
  assert.equal(a.keyPosition.length,3);
  assert.ok(a.environment>0&&a.environment<=1);
  assert.ok(p.shadow>=0&&p.shadow<=1);
  assert.ok(a.keyPower>0&&a.rimPower>0);
 }
});
test("exposure adjustment is bounded and unknown presets fall back",()=>{
 assert.equal(lookdevSettings("missing").key,"studio");
 assert.equal(lookdevSettings("studio",-100).exposure,.672);
 assert.equal(lookdevSettings("studio",Infinity).exposure,1.12);
 assert.equal(lookdevSettings("studio",100).exposure,1.792);
});
test("shadow frustum fits real geometry without unbounded resource requests",()=>{
 const fake=(v)=>({min:{toArray:()=>[-v,-1,-v]},max:{toArray:()=>[v,2,v]},isEmpty:()=>false});
 assert.equal(lookdevShadowExtent(fake(0)),5);
 assert.ok(lookdevShadowExtent(fake(10))<25);
 assert.equal(lookdevShadowExtent(fake(1000)),60);
 assert.equal(lookdevShadowExtent(null),25);
 assert.equal(lookdevShadowExtent({isEmpty:()=>true}),25);
});
test("LookDev is integrated into Studio but cannot mutate exported objects",()=>{
 const studio=readFileSync(new URL("../workshop/studio/studio.mjs",import.meta.url),"utf8");
 const adapter=readFileSync(new URL("../workshop/studio/lookdev-studio.mjs",import.meta.url),"utf8");
 assert.match(studio,/initLookdevStudio/);
 assert.match(studio,/lookdev\?\.update\(\)/);
 assert.match(adapter,/new THREE\.PMREMGenerator\(renderer\)/);
 assert.match(adapter,/new RoomEnvironment\(\)/);
 assert.match(adapter,/function restore\(\)/);
 assert.match(adapter,/isBusy:\/\/|if\(isBusy\(\)\)/);
 assert.doesNotMatch(adapter,/root\.add\(|GLTFExporter|\.toJSON\(|\.material\.map=/);
});
