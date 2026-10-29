/**
 * DuoForge Intelligent Game Builder — deterministic, local-first Prompt Planner.
 * This V1 is an honest rules-based interpreter, not an LLM or a paid AI API.
 * Produces minimal config patches so an existing project id is never replaced.
 */
export const BUILDER_VERSION="duoforge-intelligent-game-builder@1";
export const DEFAULTS=Object.freeze({
 schema:1,id:"duoforge-game",title:"Mitt DuoForge-spel",genre:"adventure",
 world:"forest",weather:"clear",levels:3,enemies:3,collectibles:3,
 quality:"auto",hero:"knight",seed:9413,revision:1
});
const cap=(n,min,max)=>Math.min(max,Math.max(min,n));
const clean=(s,max=80)=>String(s??"").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,max);
const NUM_WORDS=Object.freeze({en:1,ett:1,två:2,tre:3,fyra:4,fem:5,sex:6,sju:7,åtta:8,nio:9,tio:10});
export function normalizeConfig(raw={}){
 const x={...DEFAULTS,...raw};
 return Object.freeze({
  schema:1,id:clean(x.id,72)||DEFAULTS.id,title:clean(x.title,70)||DEFAULTS.title,
  genre:["adventure","arena"].includes(x.genre)?x.genre:"adventure",
  world:["ocean","forest","city","ruins"].includes(x.world)?x.world:"forest",
  weather:["clear","storm","sunset","night"].includes(x.weather)?x.weather:"clear",
  levels:cap(Math.round(Number(x.levels)||3),1,10),
  enemies:cap(Math.round(Number(x.enemies)||0),0,12),
  collectibles:cap(Math.round(Number(x.collectibles)||0),0,12),
  quality:["auto","quality","performance"].includes(x.quality)?x.quality:"auto",
  hero:["knight","viking","explorer"].includes(x.hero)?x.hero:"knight",
  seed:cap(Math.abs(Math.floor(Number(x.seed)||9413)),1,2147483647),
  revision:cap(Math.round(Number(x.revision)||1),1,9999)
 });
}
/** Zero-enemy games remain peaceful on every level, not only the first. */
export function levelEnemyCount(config,stage){
 const n=normalizeConfig(config).enemies;
 return n===0?0:Math.min(12,n+Math.floor((Math.max(1,Math.floor(Number(stage)||1))-1)*.65));
}
function numberFor(t,words){
 const pattern=new RegExp("(\\d{1,3}|en|ett|två|tre|fyra|fem|sex|sju|åtta|nio|tio)\\s*(?:\\w+\\s*){0,2}(?:"+words+")\\b","iu");
 const m=t.match(pattern);if(!m)return null;
 const raw=m[1].toLowerCase();return NUM_WORDS[raw]??Number(raw);
}
function matches(t,re){return re.test(t)}
const FEATURES=Object.freeze([
 ["ocean","Ocean Cinema V5 – sju vågband och GGX-reflektion"],
 ["graphics","GPU Deluxe – adaptiv upplösning"],
 ["model","Procedurgenererad 3D-figur och hinder"],
 ["input","DuoPad – tangentbord, touch och Gamepad API"],
 ["cinema","Kamera som följer spelaren"]
]);
export function planGame(prompt,existing=null){
 const p=clean(prompt,1200),t=p.toLocaleLowerCase("sv-SE");
 const original=existing?normalizeConfig(existing):normalizeConfig();
 const patch={};
 if(matches(t,/(?:^|[^\p{L}])(hav|vatt(?:en|net)|ocean|skepp|båt|båten|vikingaskepp|stormigt hav)(?=$|[^\p{L}])/u))patch.world="ocean";
 else if(matches(t,/(?:^|[^\p{L}])(skog|skogen|träd|djungel|forest)(?=$|[^\p{L}])/u))patch.world="forest";
 else if(matches(t,/(?:^|[^\p{L}])(stad|staden|city|skyskrap|urban)(?=$|[^\p{L}])/u))patch.world="city";
 else if(matches(t,/(?:^|[^\p{L}])(ruin|ruiner|tempel|borg|slott)(?=$|[^\p{L}])/u))patch.world="ruins";
 if(matches(t,/(?:^|[^\p{L}])(storm|stormig|stormigt|åska|blixt|regn|oväder)(?=$|[^\p{L}])/u))patch.weather="storm";
 else if(matches(t,/(?:^|[^\p{L}])(solnedgång|skymning|sunset)(?=$|[^\p{L}])/u))patch.weather="sunset";
 else if(matches(t,/(?:^|[^\p{L}])(natt|mörker|night)(?=$|[^\p{L}])/u))patch.weather="night";
 else if(matches(t,/(?:^|[^\p{L}])(soligt|klart väder|dagsljus)(?=$|[^\p{L}])/u))patch.weather="clear";
 if(matches(t,/(?:^|[^\p{L}])(viking|krigare med yxa|långskepp)(?=$|[^\p{L}])/u))patch.hero="viking";
 else if(matches(t,/(?:^|[^\p{L}])(utforskare|explorer|upptäckare)(?=$|[^\p{L}])/u))patch.hero="explorer";
 else if(matches(t,/(?:^|[^\p{L}])(riddare|knight)(?=$|[^\p{L}])/u))patch.hero="knight";
 if(matches(t,/(?:^|[^\p{L}])(fighting|fightingspel|duell|arena|slåss|stridsspel)(?=$|[^\p{L}])/u))patch.genre="arena";
 else if(matches(t,/(?:^|[^\p{L}])(äventyr|samla|utforska|actionäventyr)(?=$|[^\p{L}])/u))patch.genre="adventure";
 const lv=numberFor(t,"banor|nivåer|världar|levels?");if(lv!==null)patch.levels=cap(lv,1,10);
 // A peaceful game is a real gameplay choice, not an unspecified default.
 // Negations win over nearby numbers (e.g. "tre banor utan fiender").
 const noEnemies=/(?:^|[^\p{L}])(?:inga|ingen|utan|noll)\s+(?:fiender|fiende|monster|motståndare|väktare)(?=$|[^\p{L}])/u;
 const noItems=/(?:^|[^\p{L}])(?:inga|ingen|utan|noll)\s+(?:kristaller|kristall|energikärnor|energikärna|föremål|skatter|skatt)(?=$|[^\p{L}])/u;
 const enemies=numberFor(t,"fiender|monster|motståndare|väktare");
 if(matches(t,noEnemies))patch.enemies=0;
 else if(enemies!==null)patch.enemies=cap(enemies,0,12);
 else if(existing&&matches(t,/fler (fiender|monster)/u))patch.enemies=cap(original.enemies+2,0,12);
 const items=numberFor(t,"kristaller|energikärnor|föremål|skatter");
 if(matches(t,noItems))patch.collectibles=0;
 else if(items!==null)patch.collectibles=cap(items,0,12);
 if(matches(t,/(?:^|[^\p{L}])(prestanda|snabbare|fps|batteri|performance)(?=$|[^\p{L}])/u))patch.quality="performance";
 else if(matches(t,/(?:^|[^\p{L}])(högsta grafik|bättre grafik|ultra|kvalitetsläge|quality)(?=$|[^\p{L}])/u))patch.quality="quality";
 else if(matches(t,/(?:^|[^\p{L}])(adaptiv|auto grafik|automatisk grafik)(?=$|[^\p{L}])/u))patch.quality="auto";
 // Explicit title request. No attempt to guess a reliable title from arbitrary text.
 const title=p.match(/(?:döp (?:spelet|det)|namnet ska vara|kalla (?:spelet|det))\s*(?:till\s+)?["“]?([^".!\n”]{2,60})/iu);
 if(title)patch.title=title[1].trim();
 const warnings=[];
 if(matches(t,/multiplayer|onlinespel|co-?op|nätverk/u))warnings.push("Online-multiplayer är inte implementerat i V1.");
 if(matches(t,/racing|bilspel|köra bil|flygplan|flygsimulator/u))warnings.push("Racing och flygsimulering kräver en annan spelmall. V1 skapar 3D-actionäventyr.");
 if(matches(t,/fotorealis|ray.?trac|path.?trac|dlss|restir|gaussian|webgpu/u))warnings.push("Fotorealism, ray tracing och avancerad WebGPU-rendering är ännu inte implementerade i Game Builder.");
 if(matches(t,/mp4|filmexport|spela in film/u))warnings.push("MP4-export finns i andra experiment men är ännu inte ansluten till Game Builder.");
 if(matches(t,/ansiktsanimer|mocap|riktigt skelett|skin(nad)?/u))warnings.push("V1 använder procedural 3D. Character Forge-GLB kan inte automatiskt riggas från en prompt här.");
 const changes=Object.entries(patch).filter(([k,v])=>original[k]!==v);
 const next=normalizeConfig({...original,...patch,revision:existing?(changes.length?original.revision+1:original.revision):1});
 const summary=changes.length?changes.map(([k,v])=>({field:k,from:original[k],to:v})):
  [{field:"status",from:"",to:"Inga nya inställningar identifierade; befintligt spel behålls"}];
 const used=FEATURES.filter(([key])=>key!=="ocean"||next.world==="ocean").map(([,label])=>label);
 return Object.freeze({config:next,changes:summary,applied:changes.length,warnings,used,recognized:changes.length>0||!existing});
}
