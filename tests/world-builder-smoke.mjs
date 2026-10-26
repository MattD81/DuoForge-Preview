import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:900},acceptDownloads:true});
 page.on("pageerror",err=>errors.push(err.message));
 page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text())});
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#behaviorType")?.textContent==="Körbart fordon",{timeout:30000});
 await page.locator("#worldPrompt").fill("Skapa en by med 3 hus, 4 träd, 1 bil, 2 hinder och en väg i solnedgång");
 await page.waitForFunction(()=>document.querySelector("#worldPlan")?.textContent.includes("3 hus"));
 assert.match(await page.locator("#worldPlan").textContent(),/4 träd/);
 assert.match(await page.locator("#worldPlan").textContent(),/väg/);
 console.log("PASS: Swedish text prompt creates free world preview");
 await page.locator("#buildWorld").click();
 await page.waitForFunction(()=>Number(document.querySelector("#objectCount")?.textContent)>=11,{timeout:10000});
 assert.match(await page.locator("#worldPlan").textContent(),/Klart/);
 console.log("PASS: creates buildings, trees, obstacles and road in the existing scene");
 await page.locator("#playFromPanel").click();
 await page.waitForFunction(()=>document.body.classList.contains("living-play"));
 await page.keyboard.down("w");
 await page.waitForFunction(()=>Number(document.querySelector("#speedKmh")?.textContent)>0,{timeout:10000});
 await page.keyboard.up("w");
 await page.locator("#exitPlay").click();
 console.log("PASS: generated world supports driveable Live Object Play & Build");
 const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 assert.match(download.suggestedFilename(),/\.glb$/);
 console.log("PASS: generated world exports as GLB");
 page.on("dialog",dialog=>dialog.accept());
 await page.locator("#clearWorld").click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1");
 console.log("PASS: remove generated environment preserves original kart");
 await page.screenshot({path:"world-builder-desktop.png",fullPage:true});
 assert.deepEqual(errors,[],"Uncaught browser console errors");
}finally{await browser.close()}
