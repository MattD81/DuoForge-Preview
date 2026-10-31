import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"
]});
const errors=[];
async function open(page){
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#oneClickApply")?.disabled===false,{timeout:30000});
}
async function inspect(download,page){
 const bytes=Array.from(readFileSync(await download.path()));
 return page.evaluate(async raw=>{
  const {GLTFLoader}=await import("three/addons/loaders/GLTFLoader.js");
  const gltf=await new GLTFLoader().parseAsync(new Uint8Array(raw).buffer,"");
  const meshes=[];
  gltf.scene.traverse(obj=>{
   if(obj.isMesh){
    const m=Array.isArray(obj.material)?obj.material[0]:obj.material;
    meshes.push({name:obj.name,color:!!m.map,normal:!!m.normalMap,
     roughness:!!m.roughnessMap,metalness:!!m.metalnessMap,
     size:m.map?.image?.width||0});
   }
  });
  return meshes;
 },bytes);
}
try{
 const desktop=await browser.newPage({viewport:{width:1450,height:900},acceptDownloads:true});
 await open(desktop);
 assert.equal(await desktop.locator("#oneClickTexturing").count(),1);
 // Existing PBR maps must survive one-click unless user explicitly opts in.
 await desktop.locator('[data-vault-id="marble-original"] .vault-pick').click();
 await desktop.locator("#vaultQuality").selectOption("128");
 await desktop.locator("#vaultApply").click();
 await desktop.waitForFunction(()=>document.querySelector("#vaultStatus")?.textContent.includes("Klart!"),{timeout:30000});
 await desktop.locator("#oneClickApply").click();
 await desktop.waitForFunction(()=>document.querySelector("#oneClickStatus")?.textContent.includes("redan importerade"),{timeout:10000});
 await desktop.locator("#undo").click();
 // Reproducible smart one-click PBR, three texture maps and GLB export.
 await desktop.locator("#oneClickResolution").selectOption("256");
 await desktop.locator("#oneClickSeed").fill("11");
 await desktop.locator("#oneClickPalette").fill("4");
 await desktop.locator("#oneClickWear").fill("7");
 await desktop.locator("#oneClickApply").click();
 await desktop.waitForFunction(()=>document.querySelector("#oneClickStatus")?.textContent.startsWith("Klart:"),{timeout:45000});
 const info=await desktop.locator("#oneClickStatus").innerText();
 assert.match(info,/meshar texturerade/);
 const [file]=await Promise.all([desktop.waitForEvent("download"),desktop.locator("#exportGLB").click()]);
 const meshes=await inspect(file,desktop);
 assert.ok(meshes.length>=3);
 assert.ok(meshes.every(m=>m.color&&m.normal&&m.roughness&&m.metalness),
  "All GLB mesh materials retain base color, tangent normal and metallic roughness");
 assert.ok(meshes.some(m=>m.size>=128));
 await desktop.locator("#undo").click();
 const [restored]=await Promise.all([desktop.waitForEvent("download"),desktop.locator("#exportGLB").click()]);
 const undone=await inspect(restored,desktop);
 assert.ok(undone.every(m=>!m.color),"Undo restores original flat model materials");
 console.log("PASS desktop: protect pre-existing textures; one-click + GLB maps + undo");
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true});
 await open(mobile);
 await mobile.locator('[data-mobile-tab="material"]').click();
 assert.equal(await mobile.locator("#oneClickTexturing").isVisible(),true);
 await mobile.locator("#oneClickResolution").selectOption("128");
 await mobile.locator("#oneClickApply").click();
 await mobile.waitForFunction(()=>document.querySelector("#oneClickStatus")?.textContent.startsWith("Klart:"),{timeout:45000});
 assert.equal(await mobile.locator("#oneClickApply").isDisabled(),false);
 await mobile.screenshot({path:"one-click-mobile.png"});
 console.log("PASS mobile: single tap triggers local PBR generation");
 assert.deepEqual(errors,[],"No uncaught browser errors");
}finally{await browser.close()}
