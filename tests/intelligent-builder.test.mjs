import test from "node:test";
import assert from "node:assert/strict";
import {planGame,normalizeConfig,levelEnemyCount,BUILDER_VERSION} from "../game-builder/planner.mjs";
import {crc32,zipStore,collectGameFiles,STANDALONE_HTML} from "../game-builder/export.mjs";

test("Swedish prompt creates an actual config with storm ocean and stages",()=>{
 const {config,warnings,applied,used}=planGame("Skapa ett 3D-äventyr med en viking på ett stormigt hav, fyra banor, tre monster och fem kristaller.");
 assert.equal(config.world,"ocean");
 assert.equal(config.weather,"storm");
 assert.equal(config.hero,"viking");
 assert.equal(config.genre,"adventure");
 assert.equal(config.levels,4);
 assert.equal(config.enemies,3);
 assert.equal(config.collectibles,5);
 assert.ok(applied>=5);
 assert.equal(warnings.length,0);
 assert.ok(used.some(x=>x.includes("Ocean Cinema")));
 assert.match(BUILDER_VERSION,/duoforge/);
});
test("Incremental update preserves project ID, other settings and advances version",()=>{
 const initial=normalizeConfig({id:"game-saved-42",world:"ocean",weather:"storm",levels:4,enemies:3,revision:5});
 const {config,changes}=planGame("Gör fem banor och fler fiender",initial);
 assert.equal(config.id,"game-saved-42");
 assert.equal(config.revision,6);
 assert.equal(config.levels,5);
 assert.equal(config.enemies,5);
 assert.equal(config.world,"ocean");assert.equal(config.weather,"storm");
 assert.ok(changes.some(x=>x.field==="levels"));
});
test("Repeated prompts do not duplicate levels or alter finished state",()=>{
 const initial=normalizeConfig({id:"saved",levels:5,revision:8,world:"city"});
 const r=planGame("Jag vill ha fem banor",initial);
 assert.equal(r.applied,0);
 assert.equal(r.config.revision,8);
 assert.equal(r.config.world,"city");
});
test("Unimplemented instructions are clearly reported, not claimed",()=>{
 const r=planGame("Fotorealistiskt multiplayer-bilspel med path tracing och MP4-video");
 assert.ok(r.warnings.some(x=>x.includes("Online-multiplayer")));
 assert.ok(r.warnings.some(x=>x.includes("Racing")));
 assert.ok(r.warnings.some(x=>x.includes("MP4")));
 assert.equal(r.config.genre,"adventure");
});
test("Peaceful prompts remove enemies and collectibles without resetting the existing game",()=>{
 const original=normalizeConfig({id:"existing-adventure",enemies:5,collectibles:4,levels:6,revision:7});
 const updated=planGame("Gör tre banor utan fiender och inga kristaller",original);
 assert.equal(updated.config.id,"existing-adventure");
 assert.equal(updated.config.revision,8);
 assert.equal(updated.config.levels,3);
 assert.equal(updated.config.enemies,0);
 assert.equal(updated.config.collectibles,0);
 assert.equal(levelEnemyCount(updated.config,1),0);
 assert.equal(levelEnemyCount(updated.config,3),0);
 assert.equal(levelEnemyCount(updated.config,10),0);
 const repeat=planGame("Utan fiender och inga kristaller",updated.config);
 assert.equal(repeat.applied,0);
 assert.equal(repeat.config.revision,8);
 const newGame=planGame("Skapa ett äventyr med ingen fiende och noll skatter");
 assert.equal(newGame.config.enemies,0);
 assert.equal(newGame.config.collectibles,0);
 assert.equal(levelEnemyCount({enemies:3},2),3);
 assert.equal(levelEnemyCount({enemies:3},4),4);
});
test("Invalid numbers and titles never exceed safe export/play bounds",()=>{
 const r=planGame("Jag vill ha 999 banor, 999 monster och 999 kristaller. Döp spelet till \"A <b>cool</b> game\"");
 assert.equal(r.config.levels,10);assert.equal(r.config.enemies,12);assert.equal(r.config.collectibles,12);
 assert.ok(!r.config.title.includes("<"));
 const b=normalizeConfig({id:"",levels:-10,enemies:-900,quality:"unknown",revision:NaN});
 assert.equal(b.levels,1);assert.equal(b.enemies,0);assert.equal(b.quality,"auto");
});
test("ZIP store writes valid local and central directory headers / CRC",()=>{
 assert.equal(crc32(new TextEncoder().encode("123456789")),0xcbf43926);
 const b=zipStore([{name:"index.html",data:"HEJ"},{name:"project.json",data:'{"levels":3}'}]);
 const view=new DataView(b.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint32(b.length-22,true),0x06054b50);
 assert.equal(view.getUint16(b.length-22+10,true),2);
 assert.throws(()=>zipStore([{name:"../escape",data:"no"}]));
 assert.throws(()=>zipStore([{name:"a",data:"x"},{name:"a",data:"y"}]));
});
test("ZIP includes real 3D runtime, GPU Deluxe, Ocean Cinema and npm three dependency",async()=>{
 const names=[],fetcher=async(url)=>{
  names.push(String(url));
  return {ok:true,text:async()=>String(url).includes("runtime.mjs")?
   'import {createOceanSurface} from "../workshop/studio/ocean-water.mjs";':"// shared code"};
 };
 const files=await collectGameFiles(normalizeConfig({title:"Test",world:"ocean"}),{fetcher,base:"https://example.com/game-builder/export.mjs"});
 assert.ok(files.some(x=>x.name==="project.json"));
 assert.ok(files.some(x=>x.name==="CREDITS.md"));
 assert.ok(files.some(x=>x.name==="games/game-builder/model-runtime.mjs"));
 assert.ok(files.some(x=>x.name==="games/game-builder/safe-assets.mjs"));
 assert.ok(files.some(x=>x.name==="workshop/studio/ocean-spectrum.mjs"));
 assert.ok(files.some(x=>x.name==="workshop/studio/gpu-deluxe.mjs"));
 assert.ok(files.some(x=>x.name==="workshop/studio/gpu-deluxe-v2.mjs"));
 assert.ok(files.some(x=>x.name==="games/game-builder/planner.mjs"));
 assert.ok(files.find(x=>x.name==="games/game-builder/runtime.mjs").data.includes("../../workshop/studio/"));
 assert.equal(JSON.parse(files.find(x=>x.name==="package.json").data).dependencies.three,"0.180.0");
 assert.match(STANDALONE_HTML,/startBuilderGame/);
 assert.equal(names.length,9);
 const archive=zipStore(files);
 assert.ok(archive.byteLength>1000);
});
