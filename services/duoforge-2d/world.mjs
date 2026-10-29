import {VIEW,SOLIDS,RELICS} from "./physics.mjs";
import {drawHero} from "./skeleton.mjs";
const seeded=(seed)=>{let s=seed>>>0;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296)};
const decor=seeded(4177);
const skyline=Array.from({length:60},(_,i)=>({x:i*63-130,y:278+decor()*75,r:8+decor()*11}));
const stars=Array.from({length:125},()=>({x:decor()*VIEW.width,y:decor()*305,r:.35+decor()*1.4,phase:decor()*6}));
const pines=Array.from({length:135},(_,i)=>({x:i*23-280+decor()*15,h:56+decor()*84,scale:.7+decor()*.6}));
const ruins=[{x:510,y:319,kind:"spire"},{x:970,y:300,kind:"arch"},{x:1680,y:283,kind:"spire"},{x:2200,y:312,kind:"arch"}];
function diamond(c,x,y,r){c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.67,y);c.lineTo(x,y+r);c.lineTo(x-r*.67,y);c.closePath();}
function cloud(c,x,y,w,h,fill){
 c.save();c.translate(x,y);c.fillStyle=fill;
 for(let i=0;i<6;i++){c.beginPath();c.ellipse((i-2.5)*w/7,Math.sin(i*1.73)*h*.12,w/4,h*.37,0,0,Math.PI*2);c.fill();}
 c.restore();
}
function sky(c,t){
 const grad=c.createLinearGradient(0,0,0,VIEW.height);
 grad.addColorStop(0,"#081322");grad.addColorStop(.37,"#22263c");grad.addColorStop(.64,"#47435a");grad.addColorStop(1,"#8f5f61");
 c.fillStyle=grad;c.fillRect(0,0,VIEW.width,VIEW.height);
 const moonGlow=c.createRadialGradient(725,116,5,725,116,220);
 moonGlow.addColorStop(0,"#f5d4b670");moonGlow.addColorStop(.3,"#b8abb443");moonGlow.addColorStop(1,"#b8abb400");
 c.fillStyle=moonGlow;c.fillRect(480,-100,480,470);
 c.fillStyle="#f9d8b5";c.beginPath();c.arc(725,112,28,0,Math.PI*2);c.fill();
 c.fillStyle="#d5bdaf";c.beginPath();c.arc(740,102,25,0,Math.PI*2);c.fill();
 for(const s of stars){
  c.fillStyle=`rgba(249,225,218,${.27+.25*Math.sin(t*.8+s.phase)})`;
  c.beginPath();c.arc(s.x,s.y,s.r,0,Math.PI*2);c.fill();
 }
 for(let i=0;i<8;i++)cloud(c,i*183+(t*1.7+i*39)%200-125,80+i%3*43,200,44,"#10182a50");
}
function mountains(c,camera){
 for(let layer=0;layer<3;layer++){
  c.save();c.translate(-camera*(.10+layer*.105),0);
  c.fillStyle=["#22283d","#262f45","#273a4a"][layer];
  c.beginPath();c.moveTo(-450,VIEW.height);
  for(let x=-450;x<3100;x+=35){
   const n=Math.sin(x*.004+layer)*38+Math.sin(x*.011+layer*1.7)*16;
   const peak=245+layer*33+n;
   c.lineTo(x,peak);
  }
  c.lineTo(3000,VIEW.height);c.closePath();c.fill();
  c.restore();
 }
}
function pine(c,x,y,h,color){
 c.save();c.translate(x,y);
 c.fillStyle="#101c27";c.fillRect(-2,-h*.43,4,h*.43+6);
 c.fillStyle=color;
 for(let i=0;i<4;i++){
  const tip=-h+i*h*.17;
  c.beginPath();c.moveTo(0,tip);
  c.lineTo(-h*(.16+i*.025),-h*.2+i*h*.16);
  c.quadraticCurveTo(0,-h*.24+i*h*.13,h*(.16+i*.025),-h*.2+i*h*.16);
  c.closePath();c.fill();
 }
 c.restore();
}
function forest(c,camera){
 c.save();c.translate(-camera*.42,0);
 for(let i=0;i<pines.length;i++){
  const p=pines[i],y=414+Math.sin(p.x*.009)*26;
  pine(c,p.x,y,p.h,"#142b34");
 }
 c.restore();
 c.save();c.translate(-camera*.73,0);
 for(let i=0;i<pines.length;i+=2){
  const p=pines[i],y=451+Math.sin(p.x*.006)*21;
  pine(c,p.x*1.28,y,p.h*.95,"#102a2c");
 }
 c.restore();
}
function ruinsLayer(c,camera,t){
 c.save();c.translate(-camera,0);
 for(const b of ruins){
  c.fillStyle="#1f2e3e";
  if(b.kind==="spire"){
   c.fillRect(b.x,b.y,18,123);
   c.beginPath();c.moveTo(b.x-9,b.y);c.lineTo(b.x+9,b.y-37);
   c.lineTo(b.x+27,b.y);c.closePath();c.fill();
   for(let i=0;i<5;i++)c.fillRect(b.x-5,b.y+25*i,28,4);
   c.fillStyle="#f0ad7c66";c.fillRect(b.x+5,b.y+26,8,18);
  }else{
   c.fillRect(b.x,b.y,14,111);c.fillRect(b.x+85,b.y,14,111);
   c.fillRect(b.x-4,b.y-10,107,13);
   c.strokeStyle="#2f4752";c.lineWidth=5;
   c.beginPath();c.arc(b.x+50,b.y+39,34,Math.PI,Math.PI*2);c.stroke();
  }
 }
 c.restore();
}
function dirt(c,x,y,w,h){
 const g=c.createLinearGradient(x,y,x,y+Math.max(1,h));
 g.addColorStop(0,"#4c534d");g.addColorStop(.14,"#292d36");g.addColorStop(1,"#141e29");
 c.fillStyle=g;c.fillRect(x,y,w,h);
 c.fillStyle="#6a796b";c.fillRect(x,y,w,5);
 c.fillStyle="#a5a68b";c.fillRect(x,y,w,1.8);
 for(let i=0;i<w;i+=31){
  const zz=(x+i)*.01;
  c.fillStyle=i%2?"#364a47":"#283843";
  c.beginPath();c.moveTo(x+i,y+8);
  c.lineTo(x+i+17,y+13+(i%19));c.lineTo(x+i+9,y+18);
  c.fill();
  c.fillStyle="#72807940";
  c.fillRect(x+i,y+2+(i%4),12,2);
 }
}
function boulder(c,x,y,r){
 c.fillStyle="#324450";c.beginPath();
 c.moveTo(x-r,y);c.lineTo(x-r*.77,y-r*.65);c.lineTo(x-r*.1,y-r);
 c.lineTo(x+r*.82,y-r*.63);c.lineTo(x+r,y);c.closePath();c.fill();
 c.strokeStyle="#88a2a36e";c.lineWidth=1.2;c.beginPath();c.moveTo(x-r*.75,y-r*.62);c.lineTo(x-r*.1,y-r);c.lineTo(x+r*.8,y-r*.63);c.stroke();
}
function hangingBridge(c,x,y,w,t){
 c.strokeStyle="#998674";c.lineWidth=3;
 c.beginPath();c.moveTo(x,y-10);c.quadraticCurveTo(x+w*.5,y+24,x+w,y-10);c.stroke();
 for(let i=0;i<12;i++){
  const px=x+i*w/11,py=y+5+Math.sin(i/11*Math.PI)*12;
  c.fillStyle=i%2?"#695344":"#8d6950";c.fillRect(px-3,py,11,4);
  if(i%3===0){c.strokeStyle="#776c5b";c.beginPath();c.moveTo(px,py);c.lineTo(px,y-15);c.stroke();}
 }
}
function foliage(c,camera,t){
 const rand=seeded(991);
 c.save();c.translate(-camera,0);
 for(let x=0;x<VIEW.worldWidth;x+=34){
  const gr=rand(),s=rand();
  if(gr>.49)continue;
  const ground=SOLIDS.find(b=>b.type==="earth"&&x>=b.x&&x<b.x+b.w);
  if(!ground)continue;
  const y=ground.y;
  c.lineWidth=1.5;c.strokeStyle=s>.5?"#526f65":"#6b7369";
  c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.sin(t*1.5+x)*3,y-9,x+4,y-15-gr*15);c.stroke();
  if(gr>.22){
   c.fillStyle="#ac9289";c.beginPath();c.ellipse(x+3,y-14-gr*15,3,5,.25,0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
function arch(c,x,y){
 c.save();c.translate(x,y);
 c.fillStyle="#273642";c.beginPath();c.moveTo(-12,0);c.lineTo(-12,-81);c.quadraticCurveTo(0,-115,14,-81);c.lineTo(14,0);c.closePath();c.fill();
 c.fillStyle="#101f2b";c.beginPath();c.moveTo(-5,0);c.lineTo(-5,-73);c.quadraticCurveTo(0,-96,7,-73);c.lineTo(7,0);c.closePath();c.fill();
 c.strokeStyle="#e4ad8b";c.lineWidth=2;c.strokeRect(-13,-82,28,2);
 c.restore();
}
function relic(c,x,y,t,collected,normal=false){
 if(collected)return;
 const glow=.62+.34*Math.sin(t*2.9+x);
 if(!normal){
  const light=c.createRadialGradient(x,y,1,x,y,30);
  light.addColorStop(0,`rgba(252,214,140,${.35*glow})`);
  light.addColorStop(1,"rgba(252,180,102,0)");
  c.fillStyle=light;c.fillRect(x-30,y-30,60,60);
 }
 c.fillStyle=normal?"#8080ff":"#ffdf94";
 diamond(c,x,y-2+Math.sin(t*2+x)*3,10);c.fill();
 c.strokeStyle=normal?"#8080ff":"#e8a56b";c.lineWidth=2;
 c.stroke();
 if(!normal){
  c.strokeStyle="#fff3b3aa";
  c.beginPath();c.arc(x,y,17+2*Math.sin(t*1.7),-Math.PI*.22,Math.PI*.63);c.stroke();
 }
}
function shrine(c,t,normal){
 c.save();c.translate(2270,432);
 arch(c,0,0);
 c.fillStyle=normal?"#8080ff":"#e0bc9b";
 c.beginPath();c.arc(1,-76,5+Math.sin(t*3)*1.5,0,Math.PI*2);c.fill();
 c.strokeStyle=normal?"#8080ff":"#99b3a6";c.lineWidth=2;
 c.beginPath();c.arc(0,-76,20,0,Math.PI*2);c.stroke();
 c.restore();
}
export function paintLandscape({ctx,normal,occlusion,time},state){
 const cam=state.cameraX;
 sky(ctx,time);mountains(ctx,cam);forest(ctx,cam);ruinsLayer(ctx,cam,time);
 ctx.save();ctx.translate(-cam,0);normal.save();normal.translate(-cam,0);occlusion.save();occlusion.translate(-cam,0);
 for(const solid of SOLIDS){
  const b=solid;if(b.x+b.w<cam-80||b.x>cam+VIEW.width+80)continue;
  dirt(ctx,b.x,b.y,b.w,b.h);
  normal.fillStyle=solid.type==="stone"?"rgb(129,106,251)":"rgb(129,121,253)";
  normal.fillRect(b.x,b.y,b.w,b.h);
  occlusion.fillStyle="#fff";occlusion.fillRect(b.x,b.y,b.w,b.h);
  if(solid.type==="stone"){
   ctx.strokeStyle="#bda99890";ctx.lineWidth=3;ctx.strokeRect(b.x+3,b.y+3,b.w-6,b.h-6);
   ctx.fillStyle="#587d64";ctx.fillRect(b.x,b.y,b.w,3);
  }
 }
 for(let j=0;j<42;j++){
  const x=j*57+18,y=431-((j*7)%5),r=7+(j*13)%14;
  const ground=SOLIDS.find(b=>b.type==="earth"&&x>=b.x&&x<b.x+b.w);
  if(!ground)continue;
  boulder(ctx,x,y,r);
 }
 hangingBridge(ctx,528,433,91,time);
 hangingBridge(ctx,1140,433,83,time);
 hangingBridge(ctx,1660,433,84,time);
 foliage(ctx,cam,time);
 shrine(ctx,time,false);shrine(normal,time,true);
 for(let i=0;i<RELICS.length;i++){
  const r=RELICS[i];relic(ctx,r.x,r.y,time,state.collected[i]);
  relic(normal,r.x,r.y,time,state.collected[i],true);
 }
 drawHero(ctx,state.player,time,{normal:false});
 drawHero(normal,state.player,time,{normal:true});
 for(const p of state.particles){
  const alpha=1-p.time/p.life;
  ctx.strokeStyle=`rgba(255,224,167,${alpha})`;ctx.lineWidth=2;
  for(let i=0;i<12;i++){
   const a=i/12*2*Math.PI;
   const dist=p.time*66;
   ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*dist,p.y+Math.sin(a)*dist);
   ctx.lineTo(p.x+Math.cos(a)*(dist+6),p.y+Math.sin(a)*(dist+6));ctx.stroke();
  }
 }
 ctx.restore();normal.restore();occlusion.restore();
 // Vignette, fireflies and optical mist in painterly 2D.
 for(let i=0;i<38;i++){
  const xx=(i*139.7+Math.sin(time*.6+i)*24-cam*.12)%VIEW.width;
  const yy=220+(i*37)%215+Math.sin(time*.9+i)*11;
  ctx.globalAlpha=.12+.2*Math.pow(Math.sin(time*1.3+i),2);
  ctx.fillStyle=i%3===0?"#ffe1a8":"#91dad1";
  ctx.beginPath();ctx.arc(xx,yy,i%4===0?2.3:1.2,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
 const mist=ctx.createLinearGradient(0,330,0,540);
 mist.addColorStop(0,"#b6a5ac00");mist.addColorStop(.57,"#b6a5ac10");mist.addColorStop(1,"#3b647128");
 ctx.fillStyle=mist;ctx.fillRect(0,330,VIEW.width,210);
}
export function createLights(state,time){
 const cam=state.cameraX,p=state.player;
 const arr=[
  {x:p.x-cam+p.facing*14,y:p.y-19,radius:230,intensity:1.4,color:[1,.69,.33]},
  {x:725,y:130,radius:400,intensity:.45,color:[.53,.63,.95],exposure:1},
 ];
 for(let i=0;i<RELICS.length;i++){
  if(state.collected[i])continue;
  const r=RELICS[i];if(Math.abs(r.x-cam-VIEW.width/2)>660)continue;
  arr.push({x:r.x-cam,y:r.y,radius:143,intensity:.82,color:[1,.64,.36]});
 }
 const endX=2270-cam;
 if(endX>0&&endX<VIEW.width+100)
  arr.push({x:endX,y:354,radius:195,intensity:1.1,color:[.45,.87,.88]});
 // Stable order: lantern is first and casts genuine screen-space shadows.
 return arr.slice(0,6);
}
