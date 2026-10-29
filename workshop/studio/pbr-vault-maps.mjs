// CPU-side deterministic tileable map synthesizer. Pure JS, no canvas dependencies.
// Provides baseColor RGB (sRGB), +Y tangent normal (linear), packed occlusion(R),
// roughness(G), metalness(B), and height data. No remote images or GPU required.
import {getVaultPreset} from "./pbr-vault-catalog.mjs";
const TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
function hash(x,y,s){let h=Math.imul(x^s,374761393)^Math.imul(y^s>>>1,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295}
function noise(x,y,seed,n){
 // Periodic smooth value noise: opposite edges agree, so repeat UV has no seams.
 const u=((x%n)+n)%n,v=((y%n)+n)%n;
 const x0=Math.floor(u),y0=Math.floor(v),dx=u-x0,dy=v-y0;
 const sx=dx*dx*(3-2*dx),sy=dy*dy*(3-2*dy);
 const a=hash(x0,y0,seed),b=hash((x0+1)%n,y0,seed),c=hash(x0,(y0+1)%n,seed),d=hash((x0+1)%n,(y0+1)%n,seed);
 return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
function modulation(u,v,p,seed){
 const a=noise(u*5,v*5,seed,5)*2-1,b=noise(u*19,v*19,seed+13,19)*2-1;
 const grain=noise(u*71,v*71,seed+23,71)*2-1;
 const detail=p.detail;
 let relief=.43*a+.22*b+.08*grain,contrast=.7;
 const nx=u*TAU,ny=v*TAU;
 switch(p.pattern){
  case "marble":relief=Math.sin(TAU*(v*7+Math.sin(nx*2+a*2)*.16+a*.18))*.48+.13*b;contrast=.5;break;
  case "wood":relief=.52*Math.sin(TAU*(u*12+a*.15+Math.sin(ny)*.04))+.18*b;contrast=.65;break;
  case "bark":relief=.42*Math.sin(TAU*(u*19+a*.25))+.27*a+.14*b;contrast=.9;break;
  case "bamboo":relief=.42*Math.cos(TAU*(u*8+a*.1))+.30*Math.cos(TAU*v*5)**14+.15*b;break;
  case "brick":{
    const row=Math.floor(v*8),off=(row%2)*.5,x=(u*4+off)%1,y=(v*8)%1;
    const mortar=Math.min(x,1-x,y,1-y)<.065;
    relief=(mortar?-.58:.26)+b*.14+a*.12;contrast=1.05;break;
  }
  case "tiles":{
    const x=(u*6)%1,y=(v*6)%1;
    relief=Math.min(x,1-x,y,1-y)<.075?-.54:.19+.12*a;
    contrast=.47;break;
  }
  case "ceramic":relief=.11*a+.05*b+.28*Math.cos(nx*7)*Math.cos(ny*7);contrast=.22;break;
  case "strata":relief=.35*Math.sin(TAU*(v*21+a*.2))+.33*a+.12*b;break;
  case "concrete":relief=.25*a+.24*b+.16*grain;contrast=.37;break;
  case "plaster":relief=.37*a+.15*b+.09*grain;contrast=.39;break;
  case "speckle":relief=.2*a+.45*b+.25*grain;contrast=.8;break;
  case "stone":case "rock":relief=.50*a+.26*b-.3*Math.pow(Math.abs(a),8);contrast=.78;break;
  case "grain":case "soil":case "asphalt":
    relief=.17*a+.2*b+.38*grain+(noise(u*41,v*41,seed+54,41)>.83?.20:0);
    contrast=.77;break;
  case "moss":case "grass":relief=.25*a+.22*b+.42*Math.sin(TAU*(u*38+v*8+a*.2))*grain;contrast=.92;break;
  case "snow":relief=.20*a+.1*b+.15*grain;contrast=.2;break;
  case "ice":relief=.20*Math.sin(TAU*(u*6+v*4+a*.28))+.13*b;contrast=.22;break;
  case "cobble":{
   const row=Math.floor(v*6),x=(u*7+(row%2)*.5)%1,y=(v*6)%1,edge=Math.min(x,1-x,y,1-y);
   relief=(edge<.095?-.65:.3)+.13*a+.09*b;contrast=.72;break;
  }
  case "paint":relief=.025*a+.032*b+.025*grain;contrast=.12;break;
  case "rubber":relief=.22*a+.12*b+.3*Math.sin(TAU*(u*19-v*19))*.5;contrast=.53;break;
  case "carbon":relief=((Math.floor(u*20)+Math.floor(v*20))%2?.29:-.29)+.13*b;contrast=.45;break;
  case "metal":relief=.14*Math.sin(TAU*v*100)+.16*b+.1*a;contrast=.26;break;
  case "rust":relief=.31*a+.37*b+.16*grain;contrast=.8;break;
 }
 if(p.variant==="weathered")relief+=a*.3;
 if(p.variant==="patterned")relief+=.20*Math.sin(TAU*u*8)*Math.sin(TAU*v*8);
 if(p.variant==="rough")relief+=grain*.25;
 if(p.variant==="polished")relief*=.25;
 return {relief:clamp(relief*detail,-1,1),contrast};
}
function baseRGB(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
export function generateVaultPixels(id,size=128){
 const p=getVaultPreset(id);
 if(!p)throw Error("Okänt material-ID: "+String(id).slice(0,60));
 const n=Math.round(size);
 if(!Number.isFinite(n)||n<16||n>1024||n&(n-1))throw Error("Texturupplösning måste vara 16–1024 och tvåpotens.");
 const color=new Uint8ClampedArray(n*n*4),orm=new Uint8ClampedArray(n*n*4),normal=new Uint8ClampedArray(n*n*4),
       height=new Float32Array(n*n);
 const rgb=baseRGB(p.color);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,off=i*4,s=modulation(x/n,y/n,p,p.seed),rel=s.relief;
  // Keep physically plausible metallic status; oxidised regions of rusty metal are less metallic.
  const rust=p.pattern==="rust"?clamp((rel+.5)*.7):0;
  const r=clamp(p.roughness*(.85+.24*Math.abs(rel))+.055*rel,.035,1);
  const m=clamp(p.metalness*(1-rust*.6));
  const ao=clamp(1-Math.max(0,-rel)*.35,.55,1);
  const mix=.23*rel*s.contrast;
  for(let k=0;k<3;k++)color[off+k]=Math.round(clamp((rgb[k]/255+mix)*255,0,255));
  color[off+3]=255;
  orm[off]=Math.round(255*ao);
  orm[off+1]=Math.round(255*r);
  orm[off+2]=Math.round(255*m);
  orm[off+3]=255;
  height[i]=rel;
 }
 const normalStrength=p.pattern==="paint"?.18:p.pattern==="metal"?.35:p.variant==="rough"?1.65:1.08;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,off=i*4;
  const dx=height[y*n+((x+1)%n)]-height[y*n+((x-1+n)%n)];
  const dy=height[((y+1)%n)*n+x]-height[((y-1+n)%n)*n+x];
  const nx=-dx*normalStrength,ny=-dy*normalStrength,l=Math.hypot(nx,ny,1);
  normal[off]=Math.round(clamp(.5+.5*nx/l)*255);
  normal[off+1]=Math.round(clamp(.5+.5*ny/l)*255);
  normal[off+2]=Math.round(clamp(.5+.5/l)*255);
  normal[off+3]=255;
 }
 return {id:p.id,width:n,height:n,color,normal,orm,metadata:p};
}
