/** DuoForge Character Forge — reproducible GLB 2.0 assets, no cloud API or node dependencies.
 * Generates two detailed joint-articulated PBR fighters and normal-mapped surfaces.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const PI=Math.PI, OUT=path.join(path.dirname(new URL(import.meta.url).pathname),'models');
const clip=(x,a,b)=>Math.max(a,Math.min(b,x));
const hash=n=>{n=(n^0x9e3779b9)|0;n=Math.imul(n^n>>>16,0x85ebca6b);n=Math.imul(n^n>>>13,0xc2b2ae35);return (n^n>>>16)>>>0;};
const crc32=b=>{let c=-1;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^-1)>>>0;};
function png(kind,size=96){
  const values=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=hash(x*179+y*997)/0xffffffff-.5;
    values[y*size+x]=kind==='skin'?noise*.17:kind==='cloth'?(x%7<2?.24:0)+(y%8<2?.22:0)+noise*.065:Math.sin(y*.75)*.08+noise*.026;
  }
  const raw=Buffer.alloc(size*(size*4+1));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const val=(xx,yy)=>values[((yy+size)%size)*size+((xx+size)%size)];
    let nx=-(val(x+1,y)-val(x-1,y))*.85,ny=-(val(x,y+1)-val(x,y-1))*.85,nz=1;
    const mag=Math.hypot(nx,ny,nz);nx/=mag;ny/=mag;nz/=mag;
    const off=y*(size*4+1)+1+x*4;raw[off]=Math.round((nx*.5+.5)*255);raw[off+1]=Math.round((ny*.5+.5)*255);raw[off+2]=Math.round((nz*.5+.5)*255);raw[off+3]=255;
  }
  const chunk=(type,data)=>{const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);};
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(size,0);hdr.writeUInt32BE(size,4);hdr[8]=8;hdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(raw,{level:8})),chunk('IEND',Buffer.alloc(0))]);
}
class Maker{
  constructor(i){this.i=i;this.binary=[];this.length=0;this.pending=new Map();this.j={asset:{version:'2.0',generator:'DuoForge Character Forge PBR V2'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'rigRoot'}],meshes:[],materials:[],images:[],textures:[],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],accessors:[],bufferViews:[],buffers:[{byteLength:0}],extensionsUsed:['KHR_materials_clearcoat']};this.root=0;this.materials={};this.initMaterials();}
  chunk(data,target){let b=Buffer.isBuffer(data)?data:Buffer.from(data);const padding=(4-this.length%4)%4;if(padding){this.binary.push(Buffer.alloc(padding));this.length+=padding;}const off=this.length;this.binary.push(b);this.length+=b.length;const idx=this.j.bufferViews.length;this.j.bufferViews.push({buffer:0,byteOffset:off,byteLength:b.length,...(target?{target}:{})});return idx;}
  accessor(list,n,fmt,target){const b=Buffer.alloc(list.length*(fmt===5125?4:4));for(let i=0;i<list.length;i++)fmt===5126?b.writeFloatLE(list[i],i*4):b.writeUInt32LE(list[i],i*4);const bv=this.chunk(b,target);const a={bufferView:bv,componentType:fmt,count:list.length/n,type:{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[n]};if(n===3&&fmt===5126){a.min=[0,1,2].map(k=>Math.min(...list.filter((_,index)=>index%3===k)));a.max=[0,1,2].map(k=>Math.max(...list.filter((_,index)=>index%3===k)));}const idx=this.j.accessors.length;this.j.accessors.push(a);return idx;}
  node(name,parent,pos){const n={name};if(pos)n.translation=pos;const id=this.j.nodes.length;this.j.nodes.push(n);this.j.nodes[parent].children??=[];this.j.nodes[parent].children.push(id);return id;}
  initMaterials(){
    const textures={};for(const t of ['skin','cloth','metal']){const index=this.j.images.length;this.j.images.push({bufferView:this.chunk(png(t)),mimeType:'image/png',name:t+'_normal'});textures[t]=this.j.textures.length;this.j.textures.push({sampler:0,source:index});}
    const a=this.i===0;
    const palette={skin:a?0x98674e:0x7b4c40,skinShade:0x513229,suit:a?0x18313a:0x301a29,suitAccent:a?0x274d54:0x593246,armor:a?0x345360:0x614150,armorBright:a?0x78969e:0xa07068,metal:a?0xb5cbcc:0xc7a985,trim:0x1b252d,glow:a?0x18ebd0:0xfa416a,leather:0x17171b,hair:a?0x111f30:0x2b151d,eyeWhite:0xe5d9c4,iris:a?0x23c9e8:0xff692a,pupil:0x080c15,lips:0x723e38,scar:0x5d2324};
    for(const [name,hex] of Object.entries(palette)){
      const rgb=[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255];const face=['skin','skinShade','eyeWhite','iris','pupil','lips','scar'].includes(name);
      const rough=face?.72:name==='metal'?.24:name==='armorBright'?.28:.54,metal=face?0: ['armor','armorBright','metal'].includes(name)?.75:.12;
      const m={name,pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:metal,roughnessFactor:rough}};
      const texture=face?'skin':['suit','suitAccent','leather'].includes(name)?'cloth':['armor','armorBright','metal'].includes(name)?'metal':null;
      if(texture)m.normalTexture={index:textures[texture],scale:.45};
      if(name==='glow')m.emissiveFactor=rgb;
      if(name==='metal'||name==='armorBright')m.extensions={KHR_materials_clearcoat:{clearcoatFactor:.42,clearcoatRoughnessFactor:.18}};
      this.materials[name]=this.j.materials.length;this.j.materials.push(m);
    }
  }
  add(parent,mat,verts,faces,uv){const key=parent+'|'+mat;let item=this.pending.get(key);if(!item){item={p:parent,mat,verts:[],faces:[],uv:[]};this.pending.set(key,item);}const offset=item.verts.length;item.verts.push(...verts);item.faces.push(...faces.map(f=>f.map(x=>x+offset)));item.uv.push(...uv);}
  sphere(p,name,pos,scale,mat,segments=28,rings=18,deform=null){const v=[],f=[],uv=[];for(let j=0;j<=rings;j++){
    const t=j/rings,a=t*PI;for(let k=0;k<=segments;k++){
      const b=k/segments*PI*2;let x=pos[0]+scale[0]*Math.sin(a)*Math.cos(b),y=pos[1]+scale[1]*Math.cos(a),z=pos[2]+scale[2]*Math.sin(a)*Math.sin(b);
      if(deform)[x,y,z]=deform(x,y,z);v.push([x,y,z]);uv.push([k/segments,j/rings]);
    }}for(let j=0;j<rings;j++)for(let k=0;k<segments;k++){const q=j*(segments+1)+k;f.push([q,q+1,q+segments+1],[q+1,q+segments+2,q+segments+1]);}this.add(p,mat,v,f,uv);}
  loft(p,name,profile,mat,steps=32,rings=28,shape=()=>1){const v=[],f=[],uv=[];for(let j=0;j<=rings;j++){
    const t=j/rings,s=t*(profile.length-1),a=Math.min(profile.length-2,Math.floor(s)),fraction=s-a;
    const [y,rx,rz]=[0,1,2].map(k=>profile[a][k]*(1-fraction)+profile[a+1][k]*fraction);
    for(let k=0;k<=steps;k++){const angle=k/steps*PI*2,r=shape(angle,t);v.push([rx*Math.cos(angle)*r,y,rz*Math.sin(angle)*r]);uv.push([k/steps*2,t*3]);}
  }for(let j=0;j<rings;j++)for(let k=0;k<steps;k++){const q=j*(steps+1)+k;f.push([q,q+steps+1,q+1],[q+1,q+steps+1,q+steps+2]);}this.add(p,mat,v,f,uv);}
  plate(p,name,x,y,z,w,h,depth,mat){const shape=[[-.5,-.5],[.5,-.5],[.56,.28],[.34,.5],[-.34,.5],[-.56,.28]],v=[],f=[],uv=[];
    for(const [zz,s] of [[-depth/2,.94],[-depth*.22,1],[depth*.22,1],[depth/2,.94]])for(const [xx,yy] of shape){v.push([x+w*xx*s,y+h*yy*s,z+zz]);uv.push([xx+.5,yy+.5]);}
    for(let j=0;j<3;j++)for(let k=0;k<6;k++){const q=j*6+k,n=j*6+(k+1)%6;f.push([q,q+6,n],[n,q+6,n+6]);}for(let k=1;k<5;k++)f.push([12,12+k,12+k+1],[0,k+1,k]);this.add(p,mat,v,f,uv);}
  wire(p,name,pts,r,mat){const v=[],f=[],uv=[],sides=9;for(let j=0;j<pts.length;j++){
    const prev=pts[Math.max(0,j-1)],next=pts[Math.min(pts.length-1,j+1)];let tx=next[0]-prev[0],ty=next[1]-prev[1],tz=next[2]-prev[2];const d=Math.hypot(tx,ty,tz)||1;tx/=d;ty/=d;tz/=d;let nx=ty,ny=-tx,nz=0;if(Math.hypot(nx,ny)<.05){nx=1;ny=0;}const nd=Math.hypot(nx,ny);nx/=nd;ny/=nd;const bx=ty*nz-tz*ny,by=tz*nx-tx*nz,bz=tx*ny-ty*nx;
    for(let k=0;k<=sides;k++){const a=k/sides*PI*2;v.push([pts[j][0]+r*(nx*Math.cos(a)+bx*Math.sin(a)),pts[j][1]+r*(ny*Math.cos(a)+by*Math.sin(a)),pts[j][2]+r*(nz*Math.cos(a)+bz*Math.sin(a))]);uv.push([k/sides,j/(pts.length-1)]);}
  }for(let j=0;j<pts.length-1;j++)for(let k=0;k<sides;k++){const q=j*(sides+1)+k;f.push([q,q+sides+1,q+1],[q+1,q+sides+1,q+sides+2]);}this.add(p,mat,v,f,uv);}
  finish(filename){
    for(const g of this.pending.values()){
      const ns=Array.from({length:g.verts.length},()=>[0,0,0]);
      for(const [a,b,c] of g.faces){const v=g.verts,ax=v[b][0]-v[a][0],ay=v[b][1]-v[a][1],az=v[b][2]-v[a][2],bx=v[c][0]-v[a][0],by=v[c][1]-v[a][1],bz=v[c][2]-v[a][2];const n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];for(const k of [a,b,c])for(let q=0;q<3;q++)ns[k][q]+=n[q];}
      const normal=ns.flatMap(v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);});
      const position=g.verts.flat(),uv=g.uv.flat(),indices=g.faces.flat();
      const attributes={POSITION:this.accessor(position,3,5126,34962),NORMAL:this.accessor(normal,3,5126,34962),TEXCOORD_0:this.accessor(uv,2,5126,34962)};
      const mesh=this.j.meshes.length;this.j.meshes.push({name:g.mat+'_geometry',primitives:[{attributes,indices:this.accessor(indices,1,5125,34963),material:this.materials[g.mat],mode:4}]});this.node(g.mat+'_mesh',g.p);this.j.nodes.at(-1).mesh=mesh;
    }
    const binary=Buffer.concat(this.binary);this.j.buffers[0].byteLength=binary.length;
    const js=Buffer.from(JSON.stringify(this.j));const pad=Buffer.alloc((4-js.length%4)%4,32),json=Buffer.concat([js,pad]);const padBin=Buffer.alloc((4-binary.length%4)%4),bin=Buffer.concat([binary,padBin]);
    const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+bin.length,8);
    const jhead=Buffer.alloc(8);jhead.writeUInt32LE(json.length);jhead.write('JSON',4);
    const bhead=Buffer.alloc(8);bhead.writeUInt32LE(bin.length);bhead.write('BIN\0',4);
    fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,filename),Buffer.concat([header,jhead,json,bhead,bin]));
    console.log(filename,fs.statSync(path.join(OUT,filename)).size,'bytes,',this.j.meshes.length,'PBR geometry batches');
  }
}
function create(i){
 const m=new Maker(i),b=m.node('body',m.root),head=m.node('head',b,[0,2.55,0]);
 const shoulders=[],elbows=[],fists=[],hips=[],knees=[],shins=[],feet=[];
 for(let j=0;j<2;j++){const side=j===0?'left':'right',sg=j===0?-1:1;
   shoulders.push(m.node('shoulder_'+side,b,[sg*.63,2.12,0]));elbows.push(m.node('elbow_'+side,shoulders[j],[0,-.51,0]));fists.push(m.node('fist_'+side,elbows[j],[0,-.43,.01]));
   hips.push(m.node('hip_'+side,b,[sg*.29,1.08,0]));knees.push(m.node('knee_'+side,hips[j],[0,-.55,0]));shins.push(m.node('shin_'+side,knees[j],[0,-.17,0]));feet.push(m.node('foot_'+side,shins[j],[0,-.48,0]));
 }
 m.loft(b,'torso',[[1.14,.38,.23],[1.42,.44,.27],[1.65,.50,.28],[1.90,.61,.32],[2.12,.55,.29],[2.36,.17,.17]],'suit',40,33,(a,t)=>1+.04*Math.sin(a)**4);
 m.sphere(b,'sternum',[0,1.96,.035],[.42,.31,.26],'skin',38,23);m.sphere(b,'pelvis',[0,1.12,0],[.45,.27,.27],'suit');
 for(const s of [-1,1]){
  m.sphere(b,'pectoral',[s*.24,1.91,.15],[.265,.23,.19],'armor',34,24);
  m.plate(b,'chest',[s*.255,1.96,.317][0],[s*.255,1.96,.317][1],[s*.255,1.96,.317][2],.39,.36,.08,'armorBright');
  m.plate(b,'rib',s*.365,1.53,.25,.28,.35,.07,'armor');m.wire(b,'chest-seam',[[s*.44,2.1,.19],[s*.27,1.95,.39],[s*.13,1.70,.37]],.022,'metal');
  for(let k=0;k<4;k++)m.plate(b,'abs',s*.17,1.65-k*.13,.275,.15,.088,.043,'suitAccent');
 }
 m.plate(b,'belt',0,1.10,.307,.27,.18,.075,'metal');m.plate(b,'belt-light',0,1.10,.363,.095,.07,.026,'glow');
 m.plate(b,'tabard',0,.78,.29,.28,.42,.07,'suitAccent');m.sphere(b,'back-armor',[0,1.85,-.23],[.45,.48,.16],'armor',32,18);
 for(let k=0;k<6;k++)m.plate(b,'spine',0,1.42+k*.145,-.394,.14,.10,.04,'metal');
 for(let j=0;j<2;j++){
   const sg=j===0?-1:1,sh=shoulders[j],el=elbows[j],f=fists[j],h=hips[j],k=knees[j],sn=shins[j],ft=feet[j];
   m.loft(sh,'deltoid',[[ -.56,.125,.16],[-.46,.17,.18],[-.25,.23,.23],[-.09,.265,.25],[.075,.22,.23]],'skin',35,25);
   m.sphere(sh,'pauldron',[sg*.055,-.10,.025],[.27,.18,.235],'armor',34,17);
   m.plate(sh,'edge',sg*.054,-.08,.264,.41,.13,.10,'armorBright');
   for(let r=0;r<4;r++)m.plate(sh,'ribs',sg*.02,-.10-r*.085,.31,.20,.02,.025,'metal');
   m.sphere(el,'elbow',[0,0,0],[.17,.17,.17],'suitAccent',26,15);
   m.loft(el,'forearm',[[-.46,.12,.14],[-.32,.17,.18],[-.16,.20,.19],[.085,.16,.16]],'skin',32,24);
   m.plate(el,'gauntlet',0,-.24,.192,.33,.35,.093,'armor');m.plate(el,'blade',0,-.22,.272,.09,.25,.02,'glow');
   m.sphere(f,'glove',[0,-.07,.055],[.21,.20,.23],'leather',30,16);m.plate(f,'knuckles',0,-.05,.278,.32,.15,.06,'armorBright');
   for(let q=0;q<4;q++)m.sphere(f,'finger',[-.11+q*.072,-.18,.20],[.047,.075,.07],'metal',18,11);
   m.loft(h,'thigh',[[-.58,.16,.17],[-.46,.19,.215],[-.28,.25,.24],[.02,.24,.235]],'suit',36,27);
   m.sphere(h,'quadriceps',[0,-.23,.13],[.20,.32,.125],'armor',30,21);m.plate(h,'thigh-plate',0,-.30,.258,.29,.28,.09,'armorBright');
   m.sphere(k,'kneecap',[0,-.04,0],[.18,.17,.18],'suitAccent',24,15);m.plate(k,'knee-plating',0,-.03,.19,.28,.20,.09,'metal');
   m.loft(sn,'calf',[[-.48,.12,.16],[-.34,.165,.18],[-.20,.215,.21],[.02,.17,.18]],'suit',33,25);
   m.plate(sn,'shin-armor',0,-.24,.213,.27,.40,.09,'armor');for(let q=0;q<4;q++)m.plate(sn,'striations',0,-.10-q*.085,.27,.14,.026,.02,'metal');
   m.sphere(ft,'boot',[.10,-.05,.085],[.27,.15,.29],'leather',32,19);m.plate(ft,'toe',.12,-.022,.29,.38,.11,.07,'armorBright');
 }
 m.loft(b,'neck',[[2.28,.16,.14],[2.37,.17,.16],[2.52,.13,.12]],'skin',32,17);
 const gaussian=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
 const sculpt=(x,y,z)=>{
   // One continuous face mesh: jaw taper, nose bridge/tip, cheek, brow and mouth are
   // vertex deformations instead of attached cartoon spheres.
   const jaw=clip((.15-y)/.38,0,1); x*=1-.15*jaw;
   if(z>0){
     z+=.058*gaussian(x,y,0,.10,.058,.13);
     z+=.048*gaussian(x,y,0,.01,.065,.051);
     z+=.014*gaussian(Math.abs(x),y,.15,.075,.069,.066);
     z+=.012*gaussian(Math.abs(x),y,.125,.218,.072,.04);
     z+=.008*gaussian(x,y,0,-.10,.10,.043);
     z-=.004*gaussian(x,y,0,-.069,.10,.022);
   }
   return [x,y,z];
 };
 m.sphere(head,'continuous-sculpted-face',[0,.11,0],[.27,.35,.235],'skin',80,54,sculpt);
 m.sphere(head,'chin',[0,-.108,.183],[.111,.038,.054],'skin',30,18);
 for(const sg of [-1,1]){
   m.sphere(head,'nostril',[sg*.051,-.020,.262],[.015,.010,.009],'skinShade',14,10);
   m.sphere(head,'ear',[sg*.26,.066,-.015],[.043,.080,.046],'skin',22,16);
   m.sphere(head,'ear-inner',[sg*.292,.065,.02],[.014,.041,.013],'skinShade',12,10);
   m.sphere(head,'eye-recess',[sg*.116,.160,.202],[.069,.032,.025],'skinShade',30,18);
   m.sphere(head,'sclera',[sg*.116,.157,.218],[.059,.028,.025],'eyeWhite',32,18);
   m.sphere(head,'iris',[sg*.116,.156,.242],[.018,.020,.005],'iris',24,15);
   m.sphere(head,'pupil',[sg*.116,.156,.246],[.008,.012,.003],'pupil',20,14);
   m.sphere(head,'upper-eyelid',[sg*.116,.187,.22],[.072,.016,.031],'skin',30,14);
   m.wire(head,'sharp-brow',[[sg*.057,.224,.228],[sg*.127,.237,.241],[sg*.19,.213,.218]],.010,'hair');
 }
 m.wire(head,'mouth-line',[[-.075,-.081,.225],[0,-.085,.230],[.075,-.081,.225]],.005,'lips');
 m.sphere(head,'lower-lip',[0,-.105,.218],[.075,.013,.012],'lips',24,12);
 m.sphere(head,'hair-base',[0,.333,-.045],[.265,.128,.235],'hair',35,19);
 for(let q=0;q<11;q++){
   const x=(q-5)*.048;
   m.wire(head,'hand-formed-hair',[[x*.79,.40,-.04],[x*.9,.485,-.08],[x+.052,.42,-.17],[x+.06,.313,-.24]],.020,'hair');
 }
 if(i===0){m.plate(head,'breather-mask',0,-.095,.247,.33,.126,.045,'armor');for(let k=-2;k<=2;k++)m.plate(head,'mask-vent',k*.044,-.093,.280,.017,.049,.014,'metal');m.wire(head,'braided-tail',[[0,.38,-.2],[-.06,.23,-.33],[-.16,.08,-.39],[-.19,-.14,-.39]],.046,'hair');m.plate(head,'circuit',0,.296,.225,.094,.052,.02,'glow');}
 else {m.plate(head,'mask',0,-.104,.256,.32,.136,.058,'armorBright');m.plate(head,'red-mark',0,-.117,.298,.11,.036,.019,'glow');for(const sg of [-1,1])m.wire(head,'mask-horns',[[sg*.21,.35,.04],[sg*.24,.44,.03],[sg*.26,.57,-.016],[sg*.245,.62,-.053]],.049,'metal');}
 m.finish(i===0?'kael.glb':'vex.glb');
}
create(0);create(1);