import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const errors=[];
const load=async page=>{
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#vaultCount")?.textContent.includes("360"),
  {timeout:30000});
};
function zipFiles(bytes){
 const decoder=new TextDecoder(),files=[];
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let offset=0;
 while(offset+30<bytes.length&&d.getUint32(offset,true)===0x04034b50){
  const size=d.getUint32(offset+18,true),nameLen=d.getUint16(offset+26,true),extra=d.getUint16(offset+28,true);
  files.push(decoder.decode(bytes.subarray(offset+30,offset+30+nameLen)));
  offset+=30+nameLen+extra+size;
 }
 return files;
}
try{
 const desktop=await browser.newPage({viewport:{width:1450,height:910},acceptDownloads:true});
 await load(desktop);
 assert.equal(await desktop.locator("#vaultGrid .vault-card").count(),30);
 assert.equal(await desktop.locator("#materialSwatches [data-surface]").count(),17);
 await desktop.locator("#vaultSearch").fill("marmor");
 await desktop.waitForFunction(()=>document.querySelector("#vaultCount")?.textContent.includes("/ 12"));
 assert.equal(await desktop.locator("#vaultGrid .vault-card").count(),12);
 await desktop.locator('[data-vault-id="marble-weathered"] .vault-pick').click();
 assert.equal(await desktop.locator("#vaultApply").isDisabled(),false);
 await desktop.locator("#vaultQuality").selectOption("256");
 await desktop.locator("#vaultApply").click();
 await desktop.waitForFunction(()=>document.querySelector("#vaultStatus")?.textContent.includes("Klart!"),{timeout:30000});
 const [download]=await Promise.all([desktop.waitForEvent("download"),desktop.locator("#exportGLB").click()]);
 const data=Array.from(readFileSync(await download.path()));
 const glb=await desktop.evaluate(async data=>{
  const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
  const loaded=await new GLTFLoader().parseAsync(new Uint8Array(data).buffer,"");
  const found=[];
  loaded.scene.traverse(obj=>{
   if(obj.isMesh){
    const m=obj.material;
    found.push({map:!!m.map,normal:!!m.normalMap,rough:!!m.roughnessMap,
     metal:!!m.metalnessMap,category:m.userData?.duoforgeVault,
     width:m.map?.image?.width||0});
   }
  });return found;
 },data);
 assert.ok(glb.length>=3);
 assert.ok(glb.every(x=>x.map&&x.normal&&x.rough&&x.metal),"GLB reimport must retain three real maps");
 assert.ok(glb.some(x=>x.width===256),"GLB embeds on-demand generated 256px textures");
 await desktop.locator("#undo").click();
 // ZIP pack: three real PNG maps and license/metadata manifest.
 const [zip]=await Promise.all([desktop.waitForEvent("download"),desktop.locator("#vaultDownload").click()]);
 assert.match(zip.suggestedFilename(),/\.zip$/);
 const bytes=readFileSync(await zip.path());
 assert.deepEqual(zipFiles(bytes),["basecolor.png","normal.png","orm.png","material.json"]);
 assert.equal(bytes.toString("hex",0,4),"504b0304");
 await desktop.locator("#vaultSearch").fill("");
 await desktop.locator("#vaultCategory").selectOption("Metall");
 assert.ok((await desktop.locator("#vaultCount").innerText()).includes("/ 48"));
 const target=desktop.locator('[data-vault-id="gold-original"] .vault-favorite');
 await target.click();
 await desktop.locator("#vaultFaves").check();
 assert.equal(await desktop.locator("#vaultGrid .vault-card").count(),1);
 await desktop.screenshot({path:"pbr-vault-desktop.png"});
 console.log("PASS desktop: 360 catalog, search, category, favorites, GLB reimport all PBR maps, ZIP output");
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});
 await load(mobile);
 await mobile.locator('[data-mobile-tab="material"]').click();
 await mobile.locator(".mobile-sheet-shortcuts button",{hasText:"360 material"}).click();
 assert.equal(await mobile.locator("#pbrVault").isVisible(),true);
 await mobile.locator("#vaultSearch").fill("ek");
 await mobile.waitForFunction(()=>document.querySelector("#vaultCount")?.textContent.includes("/ 12"));
 await mobile.locator('[data-vault-id="oak-original"] .vault-pick').click();
 await mobile.locator("#vaultQuality").selectOption("128");
 await mobile.locator("#vaultApply").click();
 await mobile.waitForFunction(()=>document.querySelector("#vaultStatus")?.textContent.includes("Klart!"),{timeout:30000});
 await mobile.locator("#mobilePreviewToggle").click();
 const box=await mobile.locator("#scene").boundingBox();
 assert.ok(box.height>=400,"model viewing space after drawer collapse");
 await mobile.screenshot({path:"pbr-vault-mobile.png"});
 console.log("PASS mobile: browse > apply PBR > collapse to 3D model");
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
