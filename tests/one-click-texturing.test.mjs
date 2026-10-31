import test from "node:test";
import assert from "node:assert/strict";
import {VAULT_PRESETS} from "../workshop/studio/pbr-vault-catalog.mjs";
import {generateVaultPixels} from "../workshop/studio/pbr-vault-maps.mjs";
import {
 VARIATION_SPACE,ONE_CLICK_VERSION,SEED_COUNT,PALETTE_COUNT,WEAR_COUNT,TILE_OPTIONS,
 chooseKind,makeRecipe,recipeForKind,validateOptions,ONE_CLICK_KINDS
} from "../workshop/studio/one-click-texturing-core.mjs";

test("23,592,960 on-demand parameter combinations, without storing image assets",()=>{
 assert.equal(VAULT_PRESETS.length,360);
 assert.equal(VARIATION_SPACE,23_592_960);
 assert.equal(VARIATION_SPACE,VAULT_PRESETS.length*SEED_COUNT*PALETTE_COUNT*WEAR_COUNT*TILE_OPTIONS.length);
 assert.equal(ONE_CLICK_VERSION,"duoforge.one-click-texturing@1");
 const all=new Set();
 for(let seed=0;seed<64;seed++)for(let palette=0;palette<16;palette++)
  all.add(makeRecipe({base:"granite",variant:"original",seed,palette,wear:0,tile:2}).key);
 assert.equal(all.size,64*16);
});
test("each physical class maps to a supported PBR recipe or deliberate glass/neon",()=>{
 for(const kind of ONE_CLICK_KINDS){
  const a=recipeForKind(kind,{seed:8,palette:2,wear:5,tile:3});
  const b=recipeForKind(kind,{seed:8,palette:2,wear:5,tile:3});
  assert.deepEqual(a,b);
  if(kind==="glass"||kind==="neon")assert.equal(a.special,kind);
  else{
   assert.equal(a.schema,ONE_CLICK_VERSION);
   assert.ok(VAULT_PRESETS.some(p=>p.id===a.id),kind);
   assert.equal(a.repeat,4);
  }
 }
});
test("smart assignment handles vehicle parts, materials, names and generic fallback",()=>{
 assert.equal(chooseKind({name:"wheel_rear_tire",vehicle:true}),"rubber");
 assert.equal(chooseKind({name:"roof_window",vehicle:true}),"glass");
 assert.equal(chooseKind({name:"body_chassis",vehicle:true}),"paint");
 assert.equal(chooseKind({name:"LED_strip"}),"neon");
 assert.equal(chooseKind({name:"House wood deck"}),"wood");
 assert.equal(chooseKind({name:"unknown mesh",metalness:.95}),"brushed");
 assert.equal(chooseKind({name:"unknown mesh",metalness:0}),"concrete");
});
test("validation clamps user inputs and rejects unbounded allocations",()=>{
 assert.deepEqual(validateOptions({resolution:256,seed:123,palette:-2,wear:900,tile:-4}),
  {resolution:256,seed:63,palette:0,wear:15,tile:0});
 assert.throws(()=>validateOptions({resolution:4096}),/Upplösningen/);
 assert.throws(()=>makeRecipe({base:"bad"}),/Okänt PBR-recept/);
});
test("legacy vault pixels are pixel-identical with seed zero",()=>{
 const base=generateVaultPixels("oak-original",64);
 assert.deepEqual(base.color,generateVaultPixels("oak-original",64,{seed:0}).color);
 assert.deepEqual(base.normal,generateVaultPixels("oak-original",64,{seed:0}).normal);
 assert.deepEqual(base.orm,generateVaultPixels("oak-original",64,{seed:0}).orm);
});
test("different procedural seeds change geometry-derived normals; same seed reproduces",()=>{
 const a=generateVaultPixels("granite-original",64,{seed:10});
 const b=generateVaultPixels("granite-original",64,{seed:10});
 const c=generateVaultPixels("granite-original",64,{seed:11});
 assert.deepEqual(a.normal,b.normal);
 assert.deepEqual(a.orm,b.orm);
 assert.notDeepEqual(a.normal,c.normal);
 assert.notDeepEqual(a.color,c.color);
 assert.equal(a.orm.length,64*64*4);
 for(let i=0;i<a.orm.length;i+=4){
  assert.equal(a.orm[i+3],255);
  assert.ok(a.normal[i+2]>127);
 }
});
