#!/usr/bin/env node
// Generate a DuoForge import manifest next to an already compiled JumPHP web build.
// Never treats PHP source as runnable browser code; no external dependencies.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";

const buildPath = process.argv[2];
if (!buildPath) {
  console.error('Usage: node services/jumphp/pack.mjs <web-build-directory> <game-id> "Title"');
  process.exit(2);
}
const root = resolve(buildPath);
const id = process.argv[3] || "jumphp-game";
const title = process.argv[4] || id;
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
  console.error("Invalid game id: use lowercase letters, numbers and hyphens.");
  process.exit(2);
}
if (!title.trim() || title.length > 100) {
  console.error("Game title must be 1 to 100 characters.");
  process.exit(2);
}
async function scan(directory, items = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) await scan(full, items);
    else if (entry.isFile()) items.push(relative(root, full));
    else if (entry.isSymbolicLink()) throw new Error("Build cannot contain symlinks: " + entry.name);
  }
  return items;
}
try {
  if (!(await stat(root)).isDirectory()) throw new Error("Build path is not a directory.");
  await readFile(join(root, "index.html"), "utf8");
  const files = await scan(root);
  if (!files.some(p => p.toLowerCase().endsWith(".wasm"))) {
    throw new Error("No .wasm runtime found. Build a standalone JumPHP web game first.");
  }
  const manifest = {
    schemaVersion: 1,
    engine: "jumphp-wasm",
    id,
    title: title.trim(),
    entry: "./index.html",
    width: 960,
    height: 540,
    controls: ["keyboard", "touch", "gamepad"]
  };
  const output = join(root, "duoforge-game.json");
  await writeFile(output, JSON.stringify(manifest, null, 2) + "\n", { flag: "w" });
  console.log("Manifest created: " + output);
  console.log("Publish the full build folder over HTTPS; keep .wasm and asset paths unchanged.");
} catch (error) {
  console.error("JumPHP packaging failed: " + error.message);
  process.exitCode = 1;
}
