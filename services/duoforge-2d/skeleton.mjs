/** Original DuoForge 2D skeletal character with two-bone leg IK. */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function solveLimb(root,target,upper=24,lower=24,bend=1){
 const dx=target.x-root.x,dy=target.y-root.y;
 const d=Math.max(.001,Math.hypot(dx,dy)),limit=clamp(d,.001,upper+lower-.01);
 const a=Math.atan2(dy,dx),inner=Math.acos(clamp((upper*upper+limit*limit-lower*lower)/(2*upper*limit),-1,1));
 const elbow={x:root.x+upper*Math.cos(a+inner*bend),y:root.y+upper*Math.sin(a+inner*bend)};
 return {elbow,foot:{x:root.x+dx*limit/d,y:root.y+dy*limit/d}};
}
const dot=(ctx,x,y,r,fill)=>{
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
};
const line=(ctx,x,y,a,b,width,color)=>{
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.lineCap="round";ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
};
export function drawHero(ctx,player,time,{normal=false}={}){
 const step=player.pose||0,run=Math.min(1,Math.abs(player.vx)/140),idle=Math.sin(time*2.9)*1.4;
 const bob=(player.onGround?Math.abs(Math.cos(step))*run*1.7:0)+idle*.3;
 const x=player.x,y=player.y-bob,sign=player.facing||1;
 ctx.save();ctx.translate(x,y);ctx.scale(sign,1);
 const shadow=normal?"#8080ff":"#15233e",cloak=normal?"#8080ff":"#354d78";
 const leg=normal?"#8080ff":"#293e63",boot=normal?"#8080ff":"#121f35";
 const scarf=normal?"#8080ff":"#df875f",face=normal?"#8080ff":"#e9c39f";
 const skinShade=normal?"#8080ff":"#a77171",light=normal?"#8080ff":"#ffeba1";
 // 2-bone leg IK with planted-ish feet and momentum-responsive swing.
 for(const side of [-1,1]){
  const hip={x:side*4,y:-23};
  const cycle=step+side*Math.PI*.5;
  const stride=Math.sin(cycle)*9*run;
  const lift=Math.max(0,Math.cos(cycle))*9*run;
  const foot={x:side*4+stride,y:-2-lift};
  const ik=solveLimb(hip,foot,13,13,side===-1?-1:1);
  line(ctx,hip.x,hip.y,ik.elbow.x,ik.elbow.y,7,leg);
  line(ctx,ik.elbow.x,ik.elbow.y,ik.foot.x,ik.foot.y,6,boot);
  line(ctx,ik.foot.x-4,ik.foot.y,ik.foot.x+6,ik.foot.y,5,boot);
 }
 // Coat and cape with animation phase, actual triangles rather than sprite sheets.
 ctx.beginPath();ctx.moveTo(-8,-35);ctx.quadraticCurveTo(-17-run*5,-28,-16-run*12,-14);
 ctx.lineTo(10,-15);ctx.lineTo(12,-31);ctx.closePath();ctx.fillStyle=cloak;ctx.fill();
 ctx.fillStyle=normal?"#8080ff":"#213a58";
 ctx.beginPath();ctx.moveTo(-9,-38);ctx.quadraticCurveTo(0,-43,10,-38);
 ctx.lineTo(11,-22);ctx.quadraticCurveTo(1,-18,-10,-23);ctx.closePath();ctx.fill();
 // Harness, animated arms, lantern.
 line(ctx,-6,-35,-13+Math.cos(step)*3,-24+Math.sin(step)*run*3,7,leg);
 line(ctx,7,-34,13,-24+Math.cos(step*1.4),7,leg);
 dot(ctx,13,-24,3,face);
 // Lantern light is an engine light source, this is the mesh only.
 ctx.fillStyle=normal?"#8080ff":"#72502a";ctx.fillRect(10,-22,8,11);
 ctx.fillStyle=light;ctx.fillRect(12,-21,4,7);
 line(ctx,14,-23,14,-26,1.3,scarf);
 // Neck and head, painterly facial depth.
 dot(ctx,1,-45,10,face);
 dot(ctx,5,-47,2.1,skinShade);
 dot(ctx,7,-47,1.2,shadow);
 ctx.fillStyle=normal?"#8080ff":"#202e47";ctx.fillRect(-8,-54,19,5);
 ctx.beginPath();ctx.moveTo(-8,-50);ctx.lineTo(1,-61);ctx.lineTo(11,-51);ctx.closePath();ctx.fill();
 line(ctx,-3,-39,13,-40,4,scarf);
 ctx.restore();
}
export function characterLantern(player,time){
 return {x:player.x+player.facing*14,y:player.y-20+Math.sin(time*3)*1.3,radius:165,color:[1,.63,.26],intensity:1.35};
}
