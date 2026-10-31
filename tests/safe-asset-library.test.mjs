import test from "node:test";
import assert from "node:assert/strict";
import {CREATOR_SOURCES,assertSafeGlb,acceptAssetProvenance,cleanPlacement,creditsText,
 safeAssetFile,MAX_ASSETS} from "../game-builder/safe-assets.mjs";
import {collectGameFiles,zipStore} from "../game-builder/export.mjs";

function triangleGlb(mutator=x=>x){
 const json=mutator({asset:{version:"2.0"},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],
  meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],
  buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3",min:[0,0,0],max:[1,1,0]}]});
 const raw=new TextEncoder().encode(JSON.stringify(json));
 const padded=raw.length+((4-raw.length%4)%4);
 const total=12+8+padded+8+36;
 const b=new Uint8Array(total);const v=new DataView(b.buffer);
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,total,true);
 v.setUint32(12,padded,true);v.setUint32(16,0x4e4f534a,true);
 b.set(raw,20);b.fill(0x20,20+raw.length,20+padded);
 const offset=20+padded;
 v.setUint32(offset,36,true);v.setUint32(offset+4,0x004e4942,true);
 new Float32Array(b.buffer,offset+8,9).set([0,0,0,1,0,0,0,1,0]);
 return b;
}
test("sources are pinned to original creators, with verified creator support URLs",()=>{
 assert.equal(CREATOR_SOURCES.length,4);
 for(const src of CREATOR_SOURCES){
  assert.match(src.home,/^https:\/\//);assert.match(src.license,/^https:\/\//);
  assert.match(src.donate,/^https:\/\//);assert.equal(src.spdx,"CC0-1.0");
 }
});
test("GLB binary validation requires self-contained mesh data, no remote textures",()=>{
 const glb=triangleGlb();assert.equal(assertSafeGlb(glb).meshes,1);
 const invalid=glb.slice();invalid[0]=42;
 assert.throws(()=>assertSafeGlb(invalid),/glTF 2.0/);
 assert.throws(()=>assertSafeGlb(triangleGlb(json=>{
  json.images=[{uri:"https://unknown.example/malicious.png"}];return json;
 })),/externa resurser/);
 assert.throws(()=>assertSafeGlb(triangleGlb(json=>{
  json.extensionsRequired=["KHR_draco_mesh_compression"];return json;
 })),/dekodrar/);
});
test("third-party claims fail closed for missing rights, unknown or mismatched origin",()=>{
 assert.throws(()=>acceptAssetProvenance({sourceId:"kenney",name:"tree",
  assetSourceUrl:"https://kenney.nl/assets/nature-kit"}),/Bekräfta/);
 assert.throws(()=>acceptAssetProvenance({sourceId:"unknown",name:"tree",rightsConfirmed:true}),/Okänd källa/);
 assert.throws(()=>acceptAssetProvenance({sourceId:"kenney",name:"tree",rightsConfirmed:true,
  assetSourceUrl:"https://not-kenney.example/item"}),/matchar inte/);
 assert.throws(()=>acceptAssetProvenance({sourceId:"kenney",name:"tree",rightsConfirmed:true,
  assetSourceUrl:"http://kenney.nl/assets/nature-kit"}),/HTTPS/);
 const ok=acceptAssetProvenance({sourceId:"kenney",name:"Gran",rightsConfirmed:true,
  assetSourceUrl:"https://kenney.nl/assets/nature-kit"});
 assert.equal(ok.creator,"Kenney");assert.equal(ok.license,"CC0-1.0");
 assert.equal(ok.donateUrl,"https://kenney.nl/donate");
});
test("own works still need explicit rights confirmation and legal disclosure",()=>{
 assert.throws(()=>acceptAssetProvenance({sourceId:"own",name:"My Tree"}));
 const orig=acceptAssetProvenance({sourceId:"own",name:"My Tree",rightsConfirmed:true});
 assert.equal(orig.license,"OWNER-ATTESTED");
 assert.equal(orig.donateUrl,"");
 assert.equal(safeAssetFile("model-abc"),"assets/model-abc.glb");
 assert.throws(()=>safeAssetFile("../escape"));
 assert.deepEqual(cleanPlacement({scale:100,rotation:999,x:99,z:-99}),
  {x:8,z:-8,scale:8,rotation:180});
});
test("ZIP includes an actual local GLB, credit links and machine-readable provenance",async()=>{
 const bytes=triangleGlb();
 const provenance=acceptAssetProvenance({sourceId:"kaykit-dungeon",name:"Pillar",
  assetSourceUrl:"https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0",
  rightsConfirmed:true});
 const asset={...provenance,id:"model-test",bytes,placement:{x:1,z:2,scale:2,rotation:35}};
 const fetcher=async()=>({ok:true,text:async()=>"// dummy source"});
 const files=await collectGameFiles({id:"game-1",title:"Test"},{assets:[asset],fetcher,base:"https://example.com/game-builder/export.mjs"});
 const credit=files.find(x=>x.name==="CREDITS.md").data;
 assert.match(credit,/Kay Lousberg/);assert.match(credit,/patreon.com\/kaylousberg/);
 assert.match(credit,/frivilliga/i);
 const manifest=JSON.parse(files.find(x=>x.name==="ASSET_MANIFEST.json").data);
 assert.equal(manifest[0].file,"assets/model-test.glb");
 assert.equal(manifest[0].placement.scale,2);
 assert.equal(JSON.parse(files.find(x=>x.name==="project.json").data).assetManifest[0].creator,"Kay Lousberg (KayKit)");
 assert.deepEqual(files.find(x=>x.name==="assets/model-test.glb").data,bytes);
 assert.ok(zipStore(files).byteLength>bytes.length);
 assert.match(creditsText([asset]),/Stöd skaparen/);
 await assert.rejects(()=>collectGameFiles({},{assets:[{...asset,license:"UNKNOWN"}],fetcher}),/rättighetsintyg/);
 await assert.rejects(()=>collectGameFiles({},{assets:Array.from({length:MAX_ASSETS+1},()=>asset),fetcher}),/många/);
});
