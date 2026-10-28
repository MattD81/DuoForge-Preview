import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-gpu-sandbox"]
});
try {
  const errors = [];
  const page = await browser.newPage({viewport:{width:1450,height:900},acceptDownloads:true});
  page.on("pageerror",err=>errors.push(err.message));
  await page.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
  await page.locator("#creativeHub").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>document.querySelector("#objectCount")?.textContent==="1");
  assert.ok(await page.locator("#creativeBundle").isVisible());

  // One download contains GLB plus portable manifest.
  const [download] = await Promise.all([page.waitForEvent("download"),page.locator("#creativeBundle").click()]);
  assert.match(download.suggestedFilename(),/\.creative\.zip$/);
  const zip = readFileSync(await download.path());
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.ok(zip.includes(Buffer.from("duoforge-creative-scene@1")));
  console.log("PASS: zipped GLB + scene manifest handoff");

  await page.locator("#creativeQuality").selectOption("eco");
  assert.match(await page.locator("#toast").textContent(),/Grafikprofil/);
  console.log("PASS: local editor graphics profile");

  // The starter kart is selected when the scene first loads.
  await page.locator("#creativeSave").click();
  await page.waitForFunction(()=>document.querySelector("#creativeAssets")?.textContent.includes("Kart"));
  await page.locator("#creativePrompt").fill("lägg in en bil och ett hus");
  await page.locator("#creativeFind").click();
  await page.waitForFunction(()=>document.querySelector("#creativePlan")?.textContent.includes("Saknas lokalt"));
  assert.match(await page.locator("#creativePlan").textContent(),/byggnad/);
  assert.equal(await page.locator("#creativeApply").isDisabled(),false);
  console.log("PASS: persistent local model and rule-based reuse");

  await page.locator("#creativeApply").click();
  await page.waitForFunction(()=>Number(document.querySelector("#objectCount")?.textContent)>1);
  assert.deepEqual(errors,[]);
  console.log("PASS: local assistant reuses an existing model in the scene");

  const mobile = await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto("http://127.0.0.1:8080/workshop/studio/",{waitUntil:"domcontentloaded"});
  await mobile.locator("#creativeHub").waitFor({state:"attached",timeout:30000});
  assert.ok(await mobile.locator("#creativeBundle").count());
  console.log("PASS: Creative Studio tools initialize on mobile");
} finally { await browser.close(); }
