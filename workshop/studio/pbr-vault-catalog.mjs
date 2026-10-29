// DuoForge Material Vault V1 — 360 original procedural PBR recipes.
// The recipes are permanent and lightweight: full-resolution texture maps are
// computed locally only when previewed, applied or exported.
const families=[
 ["granite","Granit","Sten","#898c8b",.89,0,"speckle"],
 ["marble","Marmor","Sten","#ddd6ce",.34,0,"marble"],
 ["slate","Skiffer","Sten","#535d67",.79,0,"strata"],
 ["limestone","Kalksten","Sten","#c6bda9",.88,0,"stone"],
 ["basalt","Basalt","Sten","#43484a",.91,0,"rock"],
 ["brick","Tegel","Bygg","#a95841",.87,0,"brick"],
 ["concrete","Betong","Bygg","#959995",.89,0,"concrete"],
 ["plaster","Puts","Bygg","#ddd3ba",.92,0,"plaster"],
 ["ceramic","Keramik","Bygg","#d0bc9c",.21,0,"ceramic"],
 ["tiles","Kakel","Bygg","#8db8bd",.26,0,"tiles"],
 ["oak","Ek","Trä","#9f6f46",.69,0,"wood"],
 ["pine","Furu","Trä","#c89b61",.77,0,"wood"],
 ["walnut","Valnöt","Trä","#69513e",.61,0,"wood"],
 ["bark","Bark","Trä","#665238",.96,0,"bark"],
 ["bamboo","Bambu","Trä","#a69d64",.66,0,"bamboo"],
 ["sand","Sand","Natur","#d6c28f",.95,0,"grain"],
 ["soil","Jord","Natur","#554238",1,0,"soil"],
 ["moss","Mossa","Natur","#517546",.99,0,"moss"],
 ["grass","Gräs","Natur","#63974f",1,0,"grass"],
 ["snow","Snö","Natur","#e2ecf2",.75,0,"snow"],
 ["ice","Is","Natur","#c0e0e8",.11,0,"ice"],
 ["asphalt","Asfalt","Stad","#55575a",.95,0,"asphalt"],
 ["cobblestone","Kullersten","Stad","#83837b",.94,0,"cobble"],
 ["paint","Billack","Fordon","#2f83cc",.23,.68,"paint"],
 ["rubber","Gummi","Fordon","#30353b",.90,0,"rubber"],
 ["carbon","Kolfiber","Fordon","#4f5759",.36,.36,"carbon"],
 ["steel","Stål","Metall","#a9b7c2",.35,1,"metal"],
 ["copper","Koppar","Metall","#b36d42",.40,1,"metal"],
 ["gold","Guld","Metall","#d6ac50",.25,1,"metal"],
 ["rust","Rostigt järn","Metall","#835042",.82,.25,"rust"]
];
const variants=[
 ["original","Original",0,1,0,0],
 ["light","Ljus",.16,1.00,-.02,0],
 ["dark","Mörk",-.20,1.08,.08,0],
 ["warm","Varm",.02,1.05,0,12],
 ["cool","Kall",0,1.03,0,-13],
 ["weathered","Väderbiten",-.08,1.35,.18,2],
 ["polished","Polerad",.06,.64,-.24,0],
 ["rough","Grov",-.02,1.75,.20,0],
 ["fine","Finkornig",0,.65,-.10,0],
 ["wet","Fuktig",-.11,1.15,-.34,-2],
 ["dusty","Dammig",.10,1.17,.15,6],
 ["patterned","Mönstrad",.03,1.34,.03,3]
];
export const VAULT_VERSION="duoforge.material-vault@1";
export const VAULT_FAMILIES=Object.freeze(families.map(([id,label,category,color,roughness,metalness,pattern])=>
 Object.freeze({id,label,category,color,roughness,metalness,pattern})));
export const VAULT_VARIANTS=Object.freeze(variants.map(([id,label])=>Object.freeze({id,label})));
const clip=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const h32=s=>{let n=2166136261;for(let i=0;i<s.length;i++)n=Math.imul(n^s.charCodeAt(i),16777619);return n>>>0};
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function hsl(r,g,b){
 r/=255;g/=255;b/=255;let max=Math.max(r,g,b),min=Math.min(r,g,b),diff=max-min,h=0,s=0,l=(max+min)/2;
 if(diff){s=diff/(1-Math.abs(2*l-1));if(max===r)h=((g-b)/diff)%6;else if(max===g)h=(b-r)/diff+2;else h=(r-g)/diff+4;h*=60;if(h<0)h+=360;}
 return [h,s,l]
}
function hslRgb(h,s,l){
 const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
 let v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return v.map(z=>Math.round(255*clip(z+m,0,1)));
}
export const VAULT_PRESETS=Object.freeze(families.flatMap(([base,label,category,color,roughness,metalness,pattern],familyIndex)=>
 variants.map(([variant,variation,light,scale,roughShift,hue],variantIndex)=>{
  const [h,s,l]=hsl(...rgb(color));
  const newRgb=hslRgb((h+hue+360)%360,clip(s+(variant==="patterned"?.11:0)),clip(l+light,.07,.93));
  const newColor="#"+newRgb.map(c=>c.toString(16).padStart(2,"0")).join("");
  return Object.freeze({
   id:base+"-"+variant,base,variant,category,label:label+" · "+variation,
   color:newColor,roughness:clip(roughness+roughShift,.045,1),
   metalness:variant==="weathered"?clip(metalness-.12):metalness,
   pattern,detail:scale,seed:h32(base+"/"+variant+"/"+familyIndex+"/"+variantIndex),
   generated:true,license:"DuoForge-original • utan tredjepartsfiler"
  });
 })));
const lookup=new Map(VAULT_PRESETS.map(p=>[p.id,p]));
export function getVaultPreset(id){return lookup.get(id)||null}
export function filterVault({search="",category="Alla",favorites=null,limit=48,offset=0}={}){
 const term=String(search).trim().toLocaleLowerCase("sv");
 const matched=VAULT_PRESETS.filter(p=>(category==="Alla"||p.category===category)&&
  (!term||[p.id,p.label,p.category,p.pattern,p.variant].join(" ").toLocaleLowerCase("sv").includes(term))&&
  (!favorites||favorites.has(p.id)));
 return {count:matched.length,items:matched.slice(offset,offset+limit)};
}
export const VAULT_CATEGORIES=Object.freeze([...new Set(VAULT_PRESETS.map(p=>p.category))]);
