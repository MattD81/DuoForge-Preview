import test from "node:test";
import assert from "node:assert/strict";
import {VAULT_PRESETS,VAULT_CATEGORIES,VAULT_FAMILIES,VAULT_VARIANTS,filterVault,getVaultPreset} from "../workshop/studio/pbr-vault-catalog.mjs";
import {generateVaultPixels} from "../workshop/studio/pbr-vault-maps.mjs";
test("exactly 360 distinct original material recipes, 30 families and 12 variants",()=>{
 assert.equal(VAULT_PRESETS.length,360);
 assert.equal(VAULT_FAMILIES.length,30);
 assert.equal(VAULT_VARIANTS.length,12);
 assert.equal(new Set(VAULT_PRESETS.map(x=>x.id)).size,360);
 assert.ok(VAULT_CATEGORIES.length>=7);
 assert.ok(VAULT_PRESETS.every(x=>x.generated&&x.license.includes("original")));
 for(const p of VAULT_PRESETS){
  assert.equal(getVaultPreset(p.id),p);
  assert.ok(/^#[0-9a-f]{6}$/i.test(p.color));
  assert.ok(p.roughness>=0&&p.roughness<=1&&p.metalness>=0&&p.metalness<=1);
 }
});
test("search, categories, favorites and paging are deterministic",()=>{
 assert.equal(filterVault({}).count,360);
 assert.equal(filterVault({search:"marmor"}).count,12);
 assert.equal(filterVault({category:"Trä"}).count,60);
 assert.equal(filterVault({favorites:new Set(["marble-original","gold-polished"])}).count,2);
 const a=filterVault({category:"Sten",limit:10,offset:0}),b=filterVault({category:"Sten",limit:10,offset:10});
 assert.equal(a.items.length,10);assert.equal(b.items.length,10);
 assert.equal(new Set([...a.items,...b.items].map(x=>x.id)).size,20);
});
test("generate standards-compatible texture channels and deterministic different variants",()=>{
 const a=generateVaultPixels("marble-original",64);
 const b=generateVaultPixels("marble-original",64);
 const c=generateVaultPixels("marble-weathered",64);
 assert.equal(a.color.length,64*64*4);
 assert.equal(a.normal.length,64*64*4);
 assert.equal(a.orm.length,64*64*4);
 assert.deepEqual(a.color,b.color);
 assert.notDeepEqual(a.color,c.color);
 assert.notDeepEqual(a.normal,c.normal);
 for(let i=0;i<a.color.length;i+=4){
  assert.equal(a.color[i+3],255);
  assert.equal(a.normal[i+3],255);
  assert.equal(a.orm[i+3],255);
  assert.ok(a.normal[i+2]>127,"glTF normal Z > 0");
 }
 assert.throws(()=>generateVaultPixels("invalid",64),/Okänt material/);
 assert.throws(()=>generateVaultPixels("marble-original",100),/tvåpotens/);
});
test("physically plausible metalness and material-specific microstructure",()=>{
 const gold=generateVaultPixels("gold-original",64),sand=generateVaultPixels("sand-original",64);
 const g=[],s=[];for(let i=0;i<gold.orm.length;i+=4){g.push(gold.orm[i+2]);s.push(sand.orm[i+2])}
 assert.ok(g.every(x=>x>=253),"Gold should be a metal");
 assert.ok(s.every(x=>x===0),"Sand should be a dielectric");
 const presets=["brick","wood","bark","asphalt","marble","steel","grass","cobblestone"];
 const fingerprints=presets.map(id=>{
  const p=generateVaultPixels(id+"-original",64);let h=0;
  for(let i=0;i<p.normal.length;i+=19)h=(Math.imul(h,16777619)^p.normal[i])>>>0;
  return h;
 });
 assert.equal(new Set(fingerprints).size,presets.length);
});
test("all 360 presets generate valid real pixel maps at thumbnail size",()=>{
 for(const recipe of VAULT_PRESETS){
  const x=generateVaultPixels(recipe.id,16);
  assert.equal(x.color.length,1024);
  assert.equal(x.normal.length,1024);
  assert.equal(x.orm.length,1024);
  assert.ok(x.color.every(Number.isFinite));
 }
});
