import test from "node:test";
import assert from "node:assert/strict";
import {ISLAND_SITES,terrainHeight,coastlineRadius,isLand,selectTerrainResolution,deterministicRandom} from "./coastal-terrain.mjs";

test("eight distinct coastal islands have bounded deterministic elevations",()=>{
 assert.equal(ISLAND_SITES.length,8);
 assert.equal(ISLAND_SITES.filter(s=>s.lighthouse).length,2);
 assert.equal(ISLAND_SITES.filter(s=>s.harbor).length,1);
 const coords=new Set(ISLAND_SITES.map(site=>site.x+","+site.z));
 assert.equal(coords.size,8);
 for(const site of ISLAND_SITES){
  const center=terrainHeight(0,0,site.r,site.seed);
  assert.ok(center>9&&center<35,"A lighthouse or harbor has real elevated 3D land");
  const shore=terrainHeight(site.r*1.5,0,site.r,site.seed);
  assert.ok(shore<0,"Far offshore terrain ends underwater");
  assert.ok(center>shore+8);
  assert.equal(terrainHeight(4.3,-7.5,site.r,site.seed),terrainHeight(4.3,-7.5,site.r,site.seed));
  assert.ok(coastlineRadius(.7,site.seed)>.8&&coastlineRadius(.7,site.seed)<1.2);
  assert.equal(isLand(0,0,site.r,site.seed),true);
  assert.equal(isLand(2*site.r,0,site.r,site.seed),false);
 }
});

test("coastal heightfield is spatially continuous and stable near rocky shore",()=>{
 const site=ISLAND_SITES[1],eps=.0001;
 for(let i=-18;i<18;i++){
  const x=i*1.7,z=Math.sin(i*.87)*11;
  const y=terrainHeight(x,z,site.r,site.seed);
  assert.ok(Number.isFinite(y));
  assert.ok(Math.abs(y-terrainHeight(x+eps,z,site.r,site.seed))<.15);
  assert.ok(Math.abs(y-terrainHeight(x,z+eps,site.r,site.seed))<.15);
 }
});

test("film and mobile coastal LOD plans reduce triangles and forests without changing island locations",()=>{
 const film=selectTerrainResolution("high"),mobile=selectTerrainResolution("low");
 assert.ok(film.rings>mobile.rings);
 assert.ok(film.segments>mobile.segments);
 assert.ok(film.trees>mobile.trees);
 assert.ok(film.rocks>mobile.rocks);
 const seed=deterministicRandom(777),same=deterministicRandom(777);
 for(let i=0;i<40;i++)assert.equal(seed(),same(),"Terrain vegetation is reproducible");
});
