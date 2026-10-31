import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({
 headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
const context=await browser.newContext({viewport:{width:1360,height:850},acceptDownloads:true});
const page=await context.newPage(),errors=[];
page.on("pageerror",err=>errors.push(err.message));
page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});
try{
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 assert.equal(await page.locator("#assetVaultPanel").count(),1);
 await page.locator("#assetVaultSave").click();
 await page.waitForFunction(()=>document.querySelectorAll("#assetVaultList .asset-vault-row").length===1);
 console.log("PASS: selected model can be exported and saved to local asset vault");
 await page.reload();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll("#assetVaultList .asset-vault-row").length===1);
 console.log("PASS: metadata and binary persist across page reload");
 await page.locator("#assetVaultList .asset-vault-row button").first().click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2",{timeout:30000});
 console.log("PASS: stored GLB loads directly into an editable scene");
 await page.locator("#assetVaultScale2").click();
 assert.equal(Number(await page.locator("#sx").inputValue()),2);
 console.log("PASS: model can be scaled with one tap and inspector updates");
 const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 assert.match(download.suggestedFilename(),/\.glb$/);
 const filePath=await download.path();
 const buffer=await import("node:fs").then(fs=>fs.readFileSync(filePath));
 await page.locator("#importFile").setInputFiles({name:"test-upload.glb",mimeType:"model/gltf-binary",buffer});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="3",{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll("#assetVaultList .asset-vault-row").length===2);
 console.log("PASS: external GLB auto-captured locally after successful 3D import");
 const mobile=await context.newPage();
 await mobile.setViewportSize({width:390,height:844});
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 assert.equal(await mobile.locator("#assetVaultPanel").count(),1);
 await mobile.locator('[data-mobile-tab="scene"]').click();
 await mobile.locator('[data-mobile-tab="create"]').click();
 await mobile.locator(".mobile-sheet-shortcuts button", {hasText:"Mina GLB"}).click();
 await mobile.locator("#assetVaultScale2").scrollIntoViewIfNeeded();
 assert.ok(await mobile.locator("#assetVaultScale2").isVisible());
 console.log("PASS: local GLB vault reachable in mobile studio drawer");
 await mobile.close();
 page.once("dialog",dialog=>dialog.accept());
 await page.locator("#assetVaultList .asset-vault-row button[aria-label^='Ta bort']").first().click();
 await page.waitForFunction(()=>document.querySelectorAll("#assetVaultList .asset-vault-row").length===1);
 assert.equal(await page.locator("#objectCount").textContent(),"3");
 console.log("PASS: deleting from asset vault leaves edited scenes intact");
 assert.deepEqual(errors,[],"No JavaScript errors");
}finally{await browser.close();}
