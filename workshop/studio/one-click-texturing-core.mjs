// DuoForge One-Click Texturing — deterministic, standalone planning logic.
// Existing PBR Vault recipes stay the source of truth: no external assets/API.
// 360 recipes × 64 seeds × 16 palettes × 16 aging levels × 4 UV scales.
// These are parameter combinations, NOT 23 million stored images.
import {VAULT_PRESETS, getVaultPreset} from "./pbr-vault-catalog.mjs";
import {classifySurfaceName} from "./surface-classifier.mjs";

export const SEED_COUNT=64;
export const PALETTE_COUNT=16;
export const WEAR_COUNT=16;
export const TILE_OPTIONS=Object.freeze([0.5,1,2,4]);
export const VARIATION_SPACE=VAULT_PRESETS.length*SEED_COUNT*PALETTE_COUNT*WEAR_COUNT*TILE_OPTIONS.length;
export const ONE_CLICK_VERSION="duoforge.one-click-texturing@1";

const VAULT_BY_BASE=new Map(VAULT_PRESETS.filter(p=>p.variant==="original").map(p=>[p.base,p.id]));
const CLASS_TO_VAULT=Object.freeze({
 paint:"paint",carbon:"carbon",chrome:"steel",brushed:"steel",glass:"glass",
 rubber:"rubber",leather:"walnut",asphalt:"asphalt",grass:"grass",bark:"bark",
 wood:"oak",concrete:"concrete",brick:"brick",stone:"granite",sand:"sand",
 neon:"neon",plaster:"plaster"
});
export const ONE_CLICK_KINDS=Object.freeze(Object.keys(CLASS_TO_VAULT));
export function clampIndex(value,count){
 const n=Number(value);
 return Number.isFinite(n)?Math.max(0,Math.min(count-1,Math.trunc(n))):0;
}
export function hash32(value){
 let h=2166136261;
 for(const char of String(value))h=Math.imul(h^char.charCodeAt(0),16777619);
 return h>>>0;
}
export function chooseKind({name="",parent="",vehicle=false,metalness=0,color=""}={}){
 const kind=classifySurfaceName(name,parent,vehicle);
 if(kind)return kind;
 const combined=(String(name)+" "+String(parent)).toLowerCase();
 if(/gold|guld|bronze|brons|copper|koppar/.test(combined))return "brushed";
 if(/fabric|cloth|textile|tyg|kläder|shirt|tröja/.test(combined))return "leather";
 if(Number(metalness)>.65)return "brushed";
 if(typeof color==="string"&&/^#(?:0{3}|000000)$/i.test(color))return "rubber";
 return "concrete"; // Unnamed meshes get a neutral material; no guessing from geometry.
}
export function makeRecipe({base="concrete",variant="original",seed=0,palette=0,wear=0,tile=2}={}){
 const s=clampIndex(seed,SEED_COUNT),p=clampIndex(palette,PALETTE_COUNT),
  w=clampIndex(wear,WEAR_COUNT),t=clampIndex(tile,TILE_OPTIONS.length);
 const id=base+"-"+variant;
 if(!getVaultPreset(id))throw Error("Okänt PBR-recept: "+id);
 return Object.freeze({
  id,seed:s,palette:p,wear:w,tileIndex:t,repeat:TILE_OPTIONS[t],
  key:[id,s,p,w,t].join("/"),schema:ONE_CLICK_VERSION
 });
}
export function recipeForKind(kind,{seed=0,palette=0,wear=0,tile=2}={}){
 const family=CLASS_TO_VAULT[kind]||"concrete";
 if(kind==="glass"||kind==="neon")return Object.freeze({special:kind,key:"special/"+kind,schema:ONE_CLICK_VERSION});
 const base=VAULT_BY_BASE.has(family)?family:"concrete";
 // There are 12 meaningful recipe variants per family; same kind shares a texture.
 const variantIndex=hash32(kind+"|"+seed)%12;
 const variant=VAULT_PRESETS.find(p=>p.base===base&&p.id.endsWith("-"+
  ["original","light","dark","warm","cool","weathered","polished","rough","fine","wet","dusty","patterned"][variantIndex]))?.variant||"original";
 return makeRecipe({base,variant,seed,palette,wear,tile});
}
export function validateOptions({resolution=256,seed=0,palette=0,wear=0,tile=2}={}){
 const n=Number(resolution);
 if(![128,256,512,1024].includes(n))throw Error("Upplösningen måste vara 128, 256, 512 eller 1024.");
 return {resolution:n,seed:clampIndex(seed,SEED_COUNT),palette:clampIndex(palette,PALETTE_COUNT),
  wear:clampIndex(wear,WEAR_COUNT),tile:clampIndex(tile,TILE_OPTIONS.length)};
}
