import test from "node:test";
import assert from "node:assert/strict";
import {parseWorldPrompt,seededRandom,hashSeed} from "../workshop/studio/world-planner.mjs";

test("Swedish descriptions produce explicit, bounded counts",()=>{
 const a=parseWorldPrompt("Skapa en by med 8 hus, 16 träd, 1 bil och en väg");
 assert.deepEqual(a.counts,{houses:8,trees:16,cars:1,crates:0,doors:0});
 assert.equal(a.road,true);assert.equal(a.isOffline,true);
 const capped=parseWorldPrompt("Bygg 5000 hus och 10000 träd, 200 bilar och 90 hinder");
 assert.equal(capped.counts.houses,24);
 assert.equal(capped.counts.trees,70);
 assert.equal(capped.counts.cars,3);
 assert.equal(capped.counts.crates,18);
});
test("Swedish and English themes are parsed",()=>{
 assert.equal(parseWorldPrompt("Skapa en nattstad med 12 hus och 20 träd").theme,"night");
 assert.equal(parseWorldPrompt("Skapa 3 hus i solnedgång").theme,"sunset");
 assert.equal(parseWorldPrompt("Build 4 houses and a road in winter").theme,"winter");
});
test("Missing useful targets shows an actionable message",()=>{
 assert.ok(parseWorldPrompt("hej").error);
 assert.ok(parseWorldPrompt("").error);
 assert.equal(parseWorldPrompt("gör en skog").counts.trees,18);
 assert.equal(parseWorldPrompt("en stor by").counts.houses,6);
});
test("Randomized geometry placements are deterministic",()=>{
 const hash=hashSeed("skapa en skog");
 assert.equal(hash,hashSeed("skapa en skog"));
 const randomA=seededRandom(hash),randomB=seededRandom(hash);
 assert.deepEqual(Array.from({length:10},()=>randomA()),Array.from({length:10},()=>randomB()));
});
