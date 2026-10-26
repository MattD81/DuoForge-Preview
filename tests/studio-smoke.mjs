import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
const browser=await chromium.launch({
 headless:true,
 args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
const failures=[];
try{
 const page=await browser.newPage({viewport:{width:1450,height:900},acceptDownloads:true});
 page.on("pageerror",err=>failures.push(err.message));
 page.on("console",msg=>{if(msg.type()==="error")failures.push("console: "+msg.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 console.log("PASS: studio loads and starter kart appears");
 assert.match(await page.locator("#sceneStats").textContent(),/trianglar/);
 await page.locator('[data-add="box"]').click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 console.log("PASS: create primitive");
 await page.locator("#sculptMode").click();
 assert.match(await page.locator("#sculptMode").getAttribute("class"),/active/);
 const sceneBox=await page.locator("#scene").boundingBox();
 await page.mouse.click(sceneBox.x+sceneBox.width/2,sceneBox.y+sceneBox.height/2);
 await page.waitForFunction(()=>document.querySelector("#viewportMessage")?.textContent.includes("Meshens geometri ändrad"));
 await page.locator("#sculptMode").click();
 console.log("PASS: real vertex sculpt brush modifies selected mesh");
 await page.locator("#toolRotate").click();
 assert.match(await page.locator("#toolRotate").getAttribute("class"),/active/);
 await page.locator("#rx").fill("45");
 assert.equal(Number(await page.locator("#rx").inputValue()),45);
 console.log("PASS: rotate selected object");
 await page.locator("#duplicate").click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="3");
 await page.locator("#undo").click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 await page.locator("#redo").click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="3");
 console.log("PASS: duplicate, undo, redo");
 const [glb]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 assert.match(glb.suggestedFilename(),/\.glb$/);
 console.log("PASS: GLB export downloads");
 const filePath=await glb.path();
 await page.locator("#importFile").setInputFiles({name:"roundtrip.glb",mimeType:"model/gltf-binary",buffer:readFileSync(filePath)});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="4");
 console.log("PASS: exported GLB can be re-imported and edited");

 await page.locator("#saveProject").click();
 await page.waitForFunction(()=>document.querySelector("#saveIndicator")?.textContent.includes("Sparad lokalt"));
 await page.locator("#openProject").click();
 await page.waitForFunction(()=>document.querySelector("#savedProjects")?.textContent.includes("Min 3D-scen"));
 console.log("PASS: local IndexedDB project save/list");
 page.on("dialog",dialog=>dialog.accept());
 await page.locator("#savedProjects .saved-row button").first().click();
 await page.waitForFunction(()=>document.querySelector("#projectDialog")?.open===false);
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1" || document.querySelector("#objectCount")?.textContent==="4");
 assert.match(await page.locator("#saveIndicator").textContent(),/Sparad lokalt/);
 console.log("PASS: stored GLB project can be reopened");

 
 const [json]=await Promise.all([page.waitForEvent("download"),page.locator("#downloadProject").click()]);
 assert.match(json.suggestedFilename(),/\.duoforge\.json$/);
 console.log("PASS: editor project JSON download");
 assert.deepEqual(failures,[],"Browser errors");
 await page.screenshot({path:"studio-desktop.png"});
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 assert.ok(await mobile.locator("#scene").isVisible());
 await mobile.screenshot({path:"studio-mobile.png",fullPage:true});
 console.log("PASS: responsive mobile loading");
}finally{await browser.close()}
