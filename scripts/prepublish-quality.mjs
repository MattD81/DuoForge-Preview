// DuoForge prepublish quality gate. Offline, free, read-only.
// Run with Node.js 22: node scripts/prepublish-quality.mjs
// This is a code/test gate, NOT proof of real iOS/Android or Sites deployment.
import {spawnSync} from "node:child_process";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const syntaxFiles=[
  "workshop/studio/studio.mjs",
  "workshop/studio/mobile-studio-ux.mjs",
  "workshop/studio/mobile-studio-comfort.mjs",
  "workshop/studio/asset-vault.mjs",
  "game-builder/builder.mjs",
  "game-builder/runtime.mjs",
  "game-builder/cloud-assistant.mjs",
  "services/duoforge-2d/physics.mjs",
  "games/stormblade-duel/duopad-input.mjs"
];
const testFiles=[
  "tests/mobile-studio-comfort.test.mjs",
  "tests/asset-vault.test.mjs",
  "tests/intelligent-builder.test.mjs",
  "tests/cloud-assistant.test.mjs",
  "tests/safe-asset-library.test.mjs",
  "tests/duoforge-2d.test.mjs",
  "tests/stormblade-duopad.test.mjs"
];
function run(args,label){
  process.stdout.write("\n[quality gate] "+label+"\n");
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:"inherit"});
  if(result.error){console.error(result.error);process.exit(1);}
  if(result.status!==0){
    console.error("[quality gate] FAILED: "+label+" (exit "+String(result.status)+")");
    process.exit(1);
  }
}
for(const path of syntaxFiles)run(["--check",path],"Syntax: "+path);
run(["--test",...testFiles],"Core regressions: mobile, GLB, builder, Cloud AI fallback, 2D, gamepad");
process.stdout.write("\n[quality gate] PASS: core syntax and deterministic tests. Browser/hardware/Sites verification still required.\n");
