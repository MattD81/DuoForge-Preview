import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {route3D,filter3D} from "../docs/3d-knowledge-base/advisor.mjs";
const base="docs/3d-knowledge-base/";
const db=JSON.parse(readFileSync(base+"knowledge.json","utf8"));
const byId=new Map(db.techniques.map(t=>[t.id,t]));
test("has real curated data, unique names, documented primary sources",()=>{
 assert.equal(db.schema,"duoforge.3d-knowledge@1");
 assert.ok(db.techniques.length>=25);
 assert.equal(byId.size,db.techniques.length);
 for(const t of db.techniques){
  assert.ok(t.id&&t.title&&t.goal&&t.limitation&&t.license&&t.licenseStatus&&t.inputs.length>0,t.id);
  assert.ok(["allow","review","blocked_eu"].includes(t.licenseStatus),t.id);
  assert.ok(Array.isArray(t.sources)&&t.sources.every(url=>url.startsWith("https://")),t.id);
 }
 for(const [kind,ids] of Object.entries(db.recommendations)){
  assert.ok(ids.length>0,kind);
  for(const id of ids)assert.ok(byId.has(id),kind+":"+id);
 }
});
test("EU exclusions are effective even when searching for a forbidden model",()=>{
 assert.equal(byId.get("hunyuan21").licenseStatus,"blocked_eu");
 assert.equal(db.policy.blockedInEU.includes("hunyuan21"),true);
 assert.equal(filter3D(db,{search:"Hunyuan"}).length,0);
 assert.equal(filter3D(db,{search:"Hunyuan",showBlocked:true}).length,1);
 assert.ok(!route3D("bild från referens",db).techniques.some(t=>t.id==="hunyuan21"));
});
test("prompt routing is deterministic and includes anatomy, rig and GLB advice",()=>{
 const snake=route3D("Orm med skinning för mobil",db);
 assert.ok(snake.kind.includes("serpent"));
 assert.ok(snake.techniques.some(t=>t.id==="serpent_rig"));
 assert.ok(snake.techniques.some(t=>t.id==="skin"));
 const castle=route3D("Skapa en slottsgolem med mossig sten",db);
 assert.ok(castle.techniques.some(t=>t.id==="rigid"));
 const photo=route3D("fotogrammetri flera bilder",db);
 assert.ok(photo.techniques.some(t=>t.id==="colmap"));
 const image=route3D("bild till 3D",db);
 assert.ok(image.techniques.some(t=>t.id==="tripo"));
 assert.ok(image.techniques.some(t=>t.id==="trellis2"));
 assert.ok(!image.techniques.some(t=>t.id==="hunyuan21"));
});
test("knowledge source documents and existing Studio integration link are present",()=>{
 for(const name of ["README.md","PIPELINES.md","MESH_MATERIAL_RIG.md","AI_MODELS.md","QUALITY_GATES.md",
 "LEGAL_AND_SOURCES.md","AGENT_PLAYBOOK.md","index.html","knowledge.css","knowledge.mjs","advisor.mjs"]){
  assert.ok(existsSync(base+name),name);
 }
 const html=readFileSync(base+"index.html","utf8");
 const app=readFileSync(base+"knowledge.mjs","utf8");
 const studio=readFileSync("workshop/studio/index.html","utf8");
 assert.ok(html.includes('src="./knowledge.mjs"'));
 assert.ok(app.includes('fetch("./knowledge.json"'));
 assert.ok(studio.includes("../../docs/3d-knowledge-base/"));
 assert.match(readFileSync(base+"LEGAL_AND_SOURCES.md","utf8"),/utesluter (EU|Europeiska unionen)/i);
});
