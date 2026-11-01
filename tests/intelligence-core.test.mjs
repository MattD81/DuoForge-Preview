import test from "node:test";
import assert from "node:assert/strict";
import {INTELLIGENCE_KNOWLEDGE,searchIntelligenceKnowledge,diagnoseGameError,buildIntelligenceReport} from "../game-builder/intelligence-core.mjs";
const base={
  project:{id:"saved-3d",revision:7},runtime:true,state:{stage:1},
  canvas:{exists:true,width:360,height:640},
  controls:{moves:4,actions:3,outside:0},
  assetCount:2,storageReadable:true,exportAvailable:true,fps:58
};
test("quality checks use observed state and retain the existing project version",()=>{
  const report=buildIntelligenceReport(base);
  assert.equal(report.projectId,"saved-3d");
  assert.equal(report.revision,7);
  assert.equal(report.counts.fail,0);
  assert.equal(report.readyForPublish,false);
  assert.equal(report.results.find(x=>x.id==="security").status,"manual");
  assert.match(report.results.find(x=>x.id==="export").evidence,/ingen ZIP/);
});
test("missing canvas, runtime, buttons and assets outside limit report real failures",()=>{
  const report=buildIntelligenceReport({...base,runtime:false,state:null,
    canvas:{exists:false,width:0,height:0},controls:{moves:3,actions:0,outside:1},assetCount:9});
  for(const id of ["runtime","canvas","controls","assets"]){
    assert.equal(report.results.find(x=>x.id===id).status,"fail");
  }
});
test("unknown FPS is never reported as a passed performance test",()=>{
  assert.equal(buildIntelligenceReport({...base,fps:null}).results.find(x=>x.id==="performance").status,"manual");
  assert.equal(buildIntelligenceReport({...base,fps:22}).results.find(x=>x.id==="performance").status,"fail");
  assert.equal(buildIntelligenceReport({...base,fps:34}).results.find(x=>x.id==="performance").status,"warn");
});
test("known error types return guidance without executing any repair",()=>{
  assert.equal(diagnoseGameError("Failed to resolve module specifier three").code,"MODULE_MISSING");
  assert.equal(diagnoseGameError("Kunde inte starta WebGL: context lost").code,"WEBGL");
  assert.equal(diagnoseGameError("Modellfel: tree.glb failed").code,"MODEL");
  assert.equal(diagnoseGameError(""),null);
  assert.equal(diagnoseGameError("unexpected token").code,"UNKNOWN");
});
test("knowledge is curated, bounded, and attributed to original references",()=>{
  assert.ok(INTELLIGENCE_KNOWLEDGE.length>=5);
  const glb=searchIntelligenceKnowledge("GLB textur licens",2);
  assert.ok(glb.some(x=>x.id==="glb"));
  assert.ok(glb.every(x=>x.source.startsWith("https://")));
  assert.deepEqual(searchIntelligenceKnowledge(""),[]);
  assert.ok(searchIntelligenceKnowledge("spel test prestanda",100).length<=7);
});
