// DuoForge offline world-plan parser.
// Explicitly rule based: no large language model, paid API or external inference.
function normalized(input){return String(input||"").trim().toLocaleLowerCase("sv-SE")}
export function hashSeed(input){
 let hash=2166136261;
 for(const char of String(input)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return hash>>>0;
}
export function seededRandom(seed){
 let state=seed>>>0;
 return ()=>{
  state=(Math.imul(1664525,state)+1013904223)>>>0;
  return state/4294967296;
 };
}
const types={
 houses:{match:/\b(?:hus|stugor|byggnader|houses?|buildings?)\b/u,singular:"hus",limit:24,base:5},
 trees:{match:/\b(?:träd|tallar|skog|trees?|forest)\b/u,singular:"träd",limit:70,base:18},
 cars:{match:/\b(?:bilar|bil|kart|fordon|cars?|vehicles?)\b/u,singular:"bil",limit:3,base:1},
 crates:{match:/\b(?:hinder|lådor|boxar|obstacles?|crates?)\b/u,singular:"hinder",limit:18,base:4},
 doors:{match:/\b(?:dörrar|dörr|doors?)\b/u,singular:"dörr",limit:6,base:1}
};
const patternAliases={
 houses:"(?:hus|stugor|byggnader|houses?|buildings?)",
 trees:"(?:träd|tallar|trees?|forest|skog)",
 cars:"(?:bilar|bil|kart|fordon|cars?|vehicles?)",
 crates:"(?:hinder|lådor|boxar|obstacles?|crates?)",
 doors:"(?:dörrar|dörr|doors?)"
};
export function parseWorldPrompt(input){
 const text=normalized(input);
 if(!text)return {error:"Beskriv miljön du vill skapa.",counts:{houses:0,trees:0,cars:0,crates:0,doors:0},road:false,theme:"day",seed:0};
 const counts={};
 for(const [type,rule]of Object.entries(types)){
  const matched=rule.match.test(text);
  const alias=patternAliases[type];
  const prefix=new RegExp("(\\d+)\\s*(?:st|stycken)?\\s*"+alias,"u");
  const suffix=new RegExp(alias+"\\s*[:=]?\\s*(\\d+)","u");
  const value=prefix.exec(text)?.[1]||suffix.exec(text)?.[1];
  counts[type]=value!==undefined?Math.min(rule.limit,Math.max(0,Number(value))):(matched?rule.base:0);
 }
 if(/\b(?:stad|city|village|by|samhälle)\b/u.test(text)&&counts.houses===0)counts.houses=6;
 if(/\b(?:skog|forest|natur)\b/u.test(text)&&counts.trees===0)counts.trees=18;
 const road=/\b(?:väg|vägar|körbana|racerbana|racing|road|street|track|bana|motorväg)\b/u.test(text);
 const theme=/\b(?:nattstad|natt|night|mörker)\b/u.test(text)?"night":
 /\b(?:solnedgång|kväll|sunset|evening)\b/u.test(text)?"sunset":
 /\b(?:öken|desert)\b/u.test(text)?"desert":
 /\b(?:vinter|snö|snow|winter)\b/u.test(text)?"winter":"day";
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 if(total===0&&!road)return {error:"Beskriv exempelvis 8 hus, 12 träd, en bil eller en väg.",counts,road,theme,seed:hashSeed(text)};
 return {counts,road,theme,seed:hashSeed(text),description:text,
  approxObjects:total+(road?1:0),isOffline:true};
}
