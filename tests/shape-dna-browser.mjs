import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox"
]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1380,height:880},acceptDownloads:true});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 await page.locator("#forgeCreate").click();
 await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="2");
 assert.equal(await page.locator("#shapeDnaLab").count(),1);
 await page.locator("#dnaInspect").click();
 await page.waitForFunction(()=>document.querySelector("#dnaStatus")?.textContent?.includes("6-riktningskontroll"));
 assert.match(await page.locator("#dnaStatus").innerText(),/UV:/);
 const [originalDownload]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 const original=readFileSync(await originalDownload.path());
 assert.equal(original.subarray(0,4).toString(),"glTF");
 await page.locator("#dnaKind").selectOption("bark");
 await page.locator("#dnaSeed").fill("12047");
 await page.locator("#dnaEvolve").click();
 await page.waitForFunction(()=>document.querySelectorAll("#dnaResults .dna-pick").length===3,{timeout:45000});
 assert.match(await page.locator("#dnaStatus").innerText(),/Tre förändringar beräknade/);
 await page.locator("#dnaResults .dna-pick").first().click();
 await page.waitForFunction(()=>document.querySelector("#dnaStatus")?.textContent?.includes("tillämpad"));
 const [modifiedDownload]=await Promise.all([page.waitForEvent("download"),page.locator("#exportGLB").click()]);
 const changed=readFileSync(await modifiedDownload.path());
 assert.equal(changed.subarray(0,4).toString(),"glTF");
 assert.notDeepEqual(changed,original,"exported geometry must actually change");
 await page.locator("#undo").click();
 assert.equal(await page.locator("#objectCount").innerText(),"2");
 await page.locator("#redo").click();
 assert.equal(await page.locator("#objectCount").innerText(),"2");
 await page.screenshot({path:"shape-dna-desktop.png"});
 console.log("PASS desktop: model inspected, 3 candidates, applied GLB, undo/redo");
 const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
 await mobile.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1",{timeout:30000});
 await mobile.locator("#forgeCreate").click();
 await mobile.locator("#dnaKind").selectOption("stone");
 await mobile.locator("#dnaInspect").click();
 await mobile.waitForFunction(()=>document.querySelector("#dnaStatus")?.textContent?.includes("6-riktningskontroll"));
 assert.equal(await mobile.locator("#shapeDnaLab").isVisible(),true);
 await mobile.screenshot({path:"shape-dna-mobile.png",fullPage:true});
 console.log("PASS mobile: selection, 360 geometry inspection and responsive controls");
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
