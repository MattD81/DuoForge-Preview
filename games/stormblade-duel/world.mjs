import * as THREE from "three";
const PI=Math.PI, sin=Math.sin,cos=Math.cos;
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mat=(color,metalness=.1,roughness=.78,emissive=0x000000)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive});
const box=(w,h,d,m)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
const ball=(r,m,segments=14)=>new THREE.Mesh(new THREE.SphereGeometry(r,segments,10),m);
const cyl=(a,b,h,m,segments=12)=>new THREE.Mesh(new THREE.CylinderGeometry(a,b,h,segments),m);
const add=(root,mesh,x=0,y=0,z=0)=>{mesh.position.set(x,y,z);root.add(mesh);return mesh};
function shapeBlade(){
 const verts=new Float32Array([-.095,0,.036, .095,0,.036, -.075,1.24,.022,.075,1.24,.022,0,1.58,.012,
 -.095,0,-.036,.095,0,-.036,-.075,1.24,-.022,.075,1.24,-.022,0,1.58,-.012]);
 const faces=[0,1,3,0,3,2,2,3,4,5,8,6,5,6,7,7,6,9,0,2,7,0,7,5,1,6,8,1,8,3,2,4,9,2,9,7,3,8,9,3,9,4,0,5,6,0,6,1];
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(verts,3));g.setIndex(faces);g.computeVertexNormals();return g;
}
const bladeGeometry=shapeBlade();
function makeWarrior(primary,accent,enemy=false){
 const root=new THREE.Group();root.name=enemy?"SKADI / Rune Guardian":"RAGNAR / Storm Warden";
 const cloth=mat(primary,.05,.92),metal=mat(accent,.76,.3),iron=mat(0x889ca5,.8,.24);
 const skin=mat(enemy?0xb38a73:0xd5a988,.02,.83),dark=mat(0x1a2026,.45,.48),gold=mat(0xb99157,.83,.3);
 const eyes=mat(enemy?0x74f4f2:0xd6a273,.08,.24,enemy?0x12636f:0x000000);
 const hips=add(root,ball(.44,cloth),0,.85,0);hips.scale.set(1.1,.72,.78);
 const torso=add(root,new THREE.Group(),0,1.62,0);
 const chest=add(torso,box(.94,1.02,.53,metal),0,0,-.02);
 chest.rotation.y=.04;
 add(torso,box(1.04,.12,.61,gold),0,.26,-.02);
 add(torso,box(.17,.88,.61,cloth),0,-.03,.0);
 add(torso,box(.1,1.02,.66,gold),.19,0,.005);
 add(torso,ball(.13,gold),0,.35,-.33);
 for(let k=0;k<4;k++){
  const plate=add(torso,box(1.04,.17,.54,metal),0,-.43-k*.12,0);
  plate.scale.x=1-k*.085;plate.rotation.x=.04*k;
 }
 const cape=new THREE.Group();torso.add(cape);
 const capeGeo=new THREE.PlaneGeometry(1.55,1.95,9,9);
 const capeObj=new THREE.Mesh(capeGeo,new THREE.MeshStandardMaterial({color:enemy?0x23575b:0x5e1e28,side:THREE.DoubleSide,roughness:1}));
 capeObj.position.set(0,-.82,.43);cape.add(capeObj);
 const collar=add(torso,new THREE.Mesh(new THREE.TorusGeometry(.35,.1,7,18),mat(0x574632,.55,.56)),0,.52,.0);collar.rotation.x=PI/2;
 const head=add(root,new THREE.Group(),0,2.39,-.02);
 add(head,ball(.33,skin),0,0,-.04).scale.set(.92,1.2,.9);
 const brow=add(head,box(.66,.18,.4,iron),0,.26,-.11);brow.rotation.z=.05;
 add(head,cyl(.36,.36,.18,iron,16),0,.36,-.025);
 add(head,ball(.33,iron),0,.44,0).scale.set(1.03,.5,1.0);
 const cheekL=add(head,box(.095,.39,.24,iron),-.28,-.03,-.1);
 add(head,box(.095,.39,.24,iron),.28,-.03,-.1);
 add(head,box(.08,.43,.1,gold),0,-.03,-.37);
 for(const side of [-1,1]){
  const eye=add(head,ball(.048,eyes,9),side*.13,.06,-.333);
  eye.scale.set(1,.6,.45);
  add(head,box(.21,.055,.075,dark),side*.13,.135,-.34);
 }
 if(!enemy){
  add(head,ball(.24,mat(0x4c2c20)),0,-.27,-.2).scale.set(1.02,.7,.48);
  for(let k=0;k<5;k++)add(head,cyl(.02,.08,.23,mat(0x4c2c20),5),-.16+k*.08,-.39,-.285);
 } else {
  for(const side of [-1,1]) {
   const braid=add(head,cyl(.08,.05,.67,mat(0xd3c0a2),8),side*.29,-.20,.08);
   braid.rotation.z=side*.18;
  }
  add(head,cyl(.04,.055,.45,gold,8),0,.63,0).rotation.z=.12;
 }
 const shoulders=[],arms=[],legs=[];
 for(const side of [-1,1]){
  const pivot=add(root,new THREE.Group(),side*.62,1.95,.0);arms.push(pivot);
  const pauldron=add(pivot,ball(.3,metal),side*.10,-.03,0);
  pauldron.scale.set(1.08,.68,1.16);
  add(pivot,box(.28,.53,.32,cloth),side*.12,-.32,-.015);
  add(pivot,box(.32,.21,.34,iron),side*.13,-.50,-.015);
  add(pivot,ball(.17,skin),side*.13,-.74,-.01).scale.set(1,.85,1);
  const hip=add(root,new THREE.Group(),side*.27,.79,.015);legs.push(hip);
  add(hip,box(.32,.67,.42,cloth),0,-.30,0);
  add(hip,box(.36,.44,.43,metal),0,-.54,-.02);
  add(hip,box(.30,.48,.37,iron),0,-.83,0);
  add(hip,box(.37,.2,.56,dark),0,-1.10,-.13);
  shoulders.push(pauldron);
 }
 const hand=arms[1];
 const grip=add(hand,new THREE.Group(),.16,-.82,-.03);
 if(enemy){
  add(grip,cyl(.048,.048,1.15,mat(0x4b3526),9),0,.56,0);
  const axe=add(grip,box(.92,.57,.12,iron),.26,1.04,0);
  const edge=add(grip,box(.13,.61,.14,gold),.72,1.04,0);
  edge.rotation.z=.17;axe.rotation.z=.05;
  add(grip,box(.16,.12,.24,metal),0,1.1,0);
 }else{
  add(grip,cyl(.055,.063,.46,dark,10),0,.16,0);
  add(grip,box(.62,.095,.13,gold),0,.48,0);
  add(grip,ball(.12,gold),0,-.1,0);
  const blade=new THREE.Mesh(bladeGeometry,iron);add(grip,blade,0,.55,0);
  add(grip,box(.04,1.13,.024,mat(0xa7e2ee,.7,.24,0x14343f)),0,1.15,.045);
 }
 const shield=add(arms[0],new THREE.Group(),-.27,-.51,-.08);
 const shieldM=mat(enemy?0x306b6b:0x5a2430,.36,.53);
 const disk=add(shield,cyl(.56,.54,.095,shieldM,18),0,0,-.18);disk.rotation.x=PI/2;
 const rim=add(shield,new THREE.Mesh(new THREE.TorusGeometry(.53,.055,8,24),gold),0,0,-.24);
 add(shield,ball(.16,iron),0,0,-.25).scale.z=.58;
 for(let k=0;k<8;k++){let a=k*PI/4;const stud=add(shield,ball(.035,gold,7),sin(a)*.42,cos(a)*.42,-.26);stud.scale.z=.55;}
 return {
  root,head,torso,arms,legs,cape,capeGeo,shield,baseY:root.position.y,
  animate(time,state={}){
   const t=time*2.3,run=clamp(state.walk||0,0,1),strike=clamp(state.swing||0,0,1),hurt=clamp(state.hurt||0,0,1);
   const attack=sin(strike*PI),duck=clamp(state.block||0,0,1);
   torso.rotation.y=sin(t*.4)*.035+attack*(enemy?-.36:.36)+hurt*.18;
   torso.rotation.z=attack*.16*(enemy?-1:1)+hurt*.12;
   head.rotation.z=.035*sin(t*.8)-hurt*.22;
   arms[0].rotation.x=-.15+duck*(-.70)+run*sin(t*3.2)*.4;
   arms[0].rotation.z=enemy?-.14:.14;
   arms[1].rotation.x=-.2-attack*1.95+run*sin(t*3.2+PI)*.45;
   arms[1].rotation.z=(enemy?-.1:.1)+attack*(enemy?-.24:.4);
   arms[1].rotation.y=attack*.32;
   legs[0].rotation.x=run*sin(t*3.2)*.58;
   legs[1].rotation.x=-run*sin(t*3.2)*.58;
   root.position.y=(state.groundY??0)+sin(t*.7)*.018+attack*.06;
   shield.rotation.x=duck*.65;
   const a=capeGeo.attributes.position;
   for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setZ(i,.06*sin(t*.6+y*2.4+x)+.08*(-y));}
   a.needsUpdate=true;capeGeo.computeVertexNormals();
  }
 };
}
const OCEAN_VERT=[
 'uniform float uTime;varying vec3 vNormalWater;varying vec3 vWorld;varying float vWave;',
 'float wave(vec2 p,float t){return .42*sin(p.x*.22+p.y*.11-t*.92)+.27*sin(p.y*.38-p.x*.13-t*1.45)+.1*sin(p.x*.8+p.y*.4-t*2.2);}',
 'void main(){vec3 p=position;float t=uTime;p.z+=wave(p.xy,t);',
 'float eps=.12;float sx=(wave(p.xy+vec2(eps,0.),t)-wave(p.xy-vec2(eps,0.),t))/(2.*eps);',
 'float sy=(wave(p.xy+vec2(0.,eps),t)-wave(p.xy-vec2(0.,eps),t))/(2.*eps);',
 'vNormalWater=normalize(mat3(modelMatrix)*vec3(-sx,-sy,1.));vWave=p.z;',
 'vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;',
 'gl_Position=projectionMatrix*viewMatrix*world;}'
].join('\n');
const OCEAN_FRAG=[
 'precision highp float;uniform float uTime;uniform vec3 uCamera,uMoon;',
 'varying vec3 vNormalWater;varying vec3 vWorld;varying float vWave;',
 'void main(){vec3 V=normalize(uCamera-vWorld);vec3 N=normalize(vNormalWater);',
 'float fresnel=.025+.975*pow(1.-max(.0,dot(N,V)),5.);',
 'float glint=pow(max(.0,dot(reflect(-normalize(uMoon),N),V)),22.);',
 'vec3 deep=vec3(.012,.077,.112);vec3 sky=vec3(.14,.32,.42);',
 'float sweep=.5+.5*sin(vWorld.x*.13+vWorld.z*.04-uTime*.3);',
 'vec3 color=mix(deep,sky,fresnel*.62+sweep*.04);',
 'color+=vec3(.67,.78,.79)*glint*.33;',
 'float foam=smoothstep(.60,.82,vWave)*smoothstep(.19,.45,1.-N.y);',
 'color=mix(color,vec3(.28,.43,.46),foam*.11);',
 'float haze=1.-exp(-distance(vWorld,uCamera)*.006);',
 'color=mix(color,vec3(.045,.11,.16),haze*.72);',
 'gl_FragColor=vec4(color,1.);}'
].join('\n');
export function createWorld(scene,camera,renderer){
 scene.background=new THREE.Color(0x081b2a);
 scene.fog=new THREE.FogExp2(0x081b2a,.009);
 const ambient=new THREE.HemisphereLight(0x83a7c4,0x091018,1.25);scene.add(ambient);
 const moon=new THREE.DirectionalLight(0xb8dbe4,2.55);moon.position.set(-15,25,-20);scene.add(moon);
 const rim=new THREE.DirectionalLight(0xd8a065,1.8);rim.position.set(9,11,12);scene.add(rim);
 const storm=new THREE.PointLight(0x6aebf7,0,45);storm.position.set(0,13,-10);scene.add(storm);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(850,850,145,145),
  new THREE.ShaderMaterial({vertexShader:OCEAN_VERT,fragmentShader:OCEAN_FRAG,uniforms:{uTime:{value:0},uCamera:{value:camera.position},uMoon:{value:new THREE.Vector3(-.4,.85,-.2)}}}));
 water.rotation.x=-PI/2;water.position.y=-1.42;water.frustumCulled=false;scene.add(water);
 // Procedural moon halo and distant mountainous silhouettes give scale.
 const moonDisk=new THREE.Mesh(new THREE.SphereGeometry(7,24,12),new THREE.MeshBasicMaterial({color:0x9ec7d4,fog:false}));
 moonDisk.position.set(-90,48,-150);scene.add(moonDisk);
 const halo=new THREE.Mesh(new THREE.SphereGeometry(10,24,12),new THREE.MeshBasicMaterial({color:0x397283,transparent:true,opacity:.22,depthWrite:false,fog:false}));
 halo.position.copy(moonDisk.position);scene.add(halo);
 const far=mat(0x102a39,.08,.95);
 for(let i=0;i<31;i++){
  const x=(i-15)*11+rand(-5,5),z=-115+rand(-22,12),h=rand(8,37);
  const m=add(scene,new THREE.Mesh(new THREE.ConeGeometry(rand(5,13),h,5),far),x,h*.5-3,z);
  m.rotation.z=rand(-.18,.18);
 }
 // Hand-built longship: curved hull rings, planks, gunwales, carved rails and mast.
 const ship=new THREE.Group();ship.name="Longship / procedural 3D";scene.add(ship);
 const wood=mat(0x4d2c1f,.1,.75),wood2=mat(0x785137,.08,.7),wood3=mat(0x2b221c,.1,.85);
 const gold=mat(0xab7b45,.65,.34),iron=mat(0x6f868f,.76,.38);
 const rows=[[-9,.18],[-7,1.22],[-5,2.10],[-2,2.38],[2,2.38],[5,2.10],[7,1.24],[9,.18]];
 const verts=[],idx=[];
 // Waterline, mid hull, and gunwale; positions are XYZ.
 for(const [z,w] of rows){for(const y of [-1.38,-.59,.49])for(const s of [-1,1])verts.push(w*s*(y===-1.38?.42:y===-.59?.84:1),y,z);}
 for(let k=0;k<rows.length-1;k++){for(let tier=0;tier<2;tier++){for(let side=0;side<2;side++){
  const a=k*6+tier*2+side,b=(k+1)*6+tier*2+side,c=a+2,d=b+2;
  if(side===0)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);
 }}}
 const hullGeo=new THREE.BufferGeometry();hullGeo.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));hullGeo.setIndex(idx);hullGeo.computeVertexNormals();
 const hull=add(ship,new THREE.Mesh(hullGeo,new THREE.MeshStandardMaterial({color:0x5e3726,roughness:.76,side:THREE.DoubleSide})));
 hull.castShadow=true;
 // 15 carefully shaped beams on the deck, with natural alternating boards.
 for(let i=0;i<15;i++){
  const z=-6.85+i*.98;
  const w=2.25*Math.sqrt(Math.max(.08,1-Math.pow(z/9,2)));
  const plank=add(ship,box(w*2,.13,.89,i%3===0?wood:wood2),0,.43,z);
  plank.castShadow=true;plank.receiveShadow=true;
  const seam=add(ship,box(w*2,.025,.03,wood3),0,.505,z+.43);
 }
 for(const side of [-1,1]){
  for(let i=0;i<11;i++){
   const z=-7.3+i*1.46,w=2.31*Math.sqrt(Math.max(.05,1-Math.pow(z/9.2,2)));
   add(ship,box(.13,.85,.16,wood3),side*w,.88,z);
   const brass=add(ship,ball(.075,gold,9),side*w,1.33,z);
   brass.scale.y=.8;
   if(i<10){
    const nz=z+.73,nw=2.31*Math.sqrt(Math.max(.05,1-Math.pow(nz/9.2,2)));
    const rail=add(ship,box(.18,.13,1.52,wood2),side*(w+nw)/2,1.29,z+.73);
    rail.rotation.y=side*(w-nw)*.15;
   }
  }
  for(let i=0;i<5;i++){
   const z=-5.3+i*2.65,w=2.40*Math.sqrt(Math.max(.04,1-Math.pow(z/9.2,2)));
   const shield=add(ship,cyl(.48,.48,.09,mat(i%2?0x8f3430:0x466a73,.38,.48),20),side*(w+.11),.66,z);
   shield.rotation.z=PI/2;
   shield.rotation.x=PI/2;
   add(ship,ball(.16,iron,10),side*(w+.19),.66,z);
  }
 }
 for(const z of [-8,8]){
  const prow=add(ship,cyl(.12,.2,2.3,wood3,9),0,1.28,z);prow.rotation.x=z>0?-.42:.42;
  add(ship,ball(.37,gold),0,2.49,z+(z>0?-.5:.5)).scale.set(.75,.48,1.4);
 }
 const mast=add(ship,cyl(.15,.23,7.3,wood3,12),0,3.95,-3.15);mast.castShadow=true;
 add(ship,box(6.3,.16,.16,wood3),0,5.8,-3.2);
 add(ship,box(4.7,.12,.12,wood3),0,2.52,-3.2);
 const sailCanvas=typeof document!=="undefined"?document.createElement("canvas"):null;
 let sailMat;
 if(sailCanvas){
  sailCanvas.width=256;sailCanvas.height=256;
  const c=sailCanvas.getContext("2d");c.fillStyle="#c7b48d";c.fillRect(0,0,256,256);
  for(let j=0;j<7;j++){c.fillStyle=j%2?"#a34b44":"#d2bb97";c.fillRect(j*38,0,38,256);}
  c.strokeStyle="#493028";c.lineWidth=6;c.beginPath();c.arc(125,125,72,0,2*PI);c.stroke();
  c.font="bold 102px serif";c.textAlign="center";c.fillStyle="#422831";c.fillText("ᚱ",125,157);
  sailMat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(sailCanvas),side:THREE.DoubleSide,roughness:1});
 }else sailMat=mat(0xb78c77);
 const sailGeo=new THREE.PlaneGeometry(5.9,3.3,14,12);
 const sail=add(ship,new THREE.Mesh(sailGeo,sailMat),0,4.15,-3.23);sail.castShadow=true;
 const ropes=mat(0x8a6b4d);
 for(const side of [-1,1]){
  const a=new THREE.Vector3(side*2.8,5.80,-3.18),b=new THREE.Vector3(side*1.8,.50,3.1);
  const d=b.clone().sub(a);const rope=add(ship,cyl(.022,.022,d.length(),ropes,6),...a.clone().add(b).multiplyScalar(.5).toArray());
  rope.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
 }
 for(const z of [-5.3,5.3]){
  for(const x of [-1.3,1.3]){
   const barrel=add(ship,cyl(.38,.40,.8,wood2,12),x,.93,z);barrel.castShadow=true;
   for(const h of [-.25,.25])add(barrel,new THREE.Mesh(new THREE.TorusGeometry(.39,.035,6,18),iron),0,h,0).rotation.x=PI/2;
  }
 }
 // Small torch flames for warm counterpoint to cold moonlight.
 const flames=[];
 const torchMat=new THREE.MeshBasicMaterial({color:0xffa44e,transparent:true,opacity:.85,depthWrite:false});
 for(const z of [-5.8,5.8]){
  const x=z>0?1.4:-1.4;
  add(ship,cyl(.045,.06,1.3,wood3,8),x,1.21,z);
  const flame=add(ship,new THREE.Mesh(new THREE.ConeGeometry(.19,.56,7),torchMat.clone()),x,2.05,z);
  flames.push(flame);
  const light=new THREE.PointLight(0xff9955,3.5,7);light.position.set(x,2.1,z);ship.add(light);
 }
 // Blown rain: bounded line segment geometry, no per-frame allocations.
 const count=600, rainPos=new Float32Array(count*6);
 for(let i=0;i<count;i++){
  const p=i*6;rainPos[p]=rand(-26,26);rainPos[p+1]=rand(0,22);rainPos[p+2]=rand(-30,20);
  rainPos[p+3]=rainPos[p]+.18;rainPos[p+4]=rainPos[p+1]-.6;rainPos[p+5]=rainPos[p+2]+.08;
 }
 const rainGeo=new THREE.BufferGeometry();
 rainGeo.setAttribute("position",new THREE.BufferAttribute(rainPos,3));
 const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xabc8d2,transparent:true,opacity:.25,depthWrite:false}));
 rain.frustumCulled=false;scene.add(rain);
 const sparks=[];
 const sparksMat=new THREE.MeshBasicMaterial({color:0xffc56e,transparent:true,depthWrite:false});
 function spark(at,color=0xfcb66a){
  const g=new THREE.Group();const m=mat(color,.3,.32,color);
  for(let i=0;i<12;i++){
   const p=add(g,ball(rand(.026,.065),m,5),rand(-.16,.16),rand(-.18,.2),rand(-.12,.12));
   p.userData.velocity=new THREE.Vector3(rand(-2.6,2.6),rand(.7,3),rand(-2,2));
  }
  g.position.copy(at);ship.add(g);sparks.push({group:g,life:.6,material:m});
 }
 const player=makeWarrior(0x51303b,0xb49a68,false),opponent=makeWarrior(0x173e49,0x849ea6,true);
 add(ship,player.root,-2.2,.57,1.2);
 add(ship,opponent.root,2.2,.57,1.2);
 player.root.rotation.y=-PI/2;opponent.root.rotation.y=PI/2;
 function update(time,dt){
  water.material.uniforms.uTime.value=time;
  // Rock the whole ship and all attached fighters, instead of desynchronizing floor.
  ship.rotation.z=sin(time*.72)*.014+sin(time*1.38)*.009;
  ship.rotation.x=sin(time*.67)*.021;
  ship.position.y=sin(time*.95)*.11+sin(time*1.38)*.05;
  for(const f of flames){f.scale.y=.68+.4*sin(time*11+f.position.z);f.rotation.z=sin(time*8)*.16;}
  const attr=sailGeo.attributes.position;
  for(let i=0;i<attr.count;i++)attr.setZ(i,.20*sin(time*1.5+attr.getX(i)*.8+attr.getY(i)*.5));
  attr.needsUpdate=true;sailGeo.computeVertexNormals();
  for(let i=0;i<count;i++){
   const p=i*6;
   rainPos[p+1]-=dt*22;
   rainPos[p]-=dt*3.8;
   if(rainPos[p+1]<-2){rainPos[p+1]=21;rainPos[p]=rand(-26,26);rainPos[p+2]=rand(-25,22);}
   rainPos[p+3]=rainPos[p]+.18;rainPos[p+4]=rainPos[p+1]-.6;rainPos[p+5]=rainPos[p+2]+.08;
  }rainGeo.attributes.position.needsUpdate=true;
  const lightning=sin(time*1.2+sin(time*.13)*22)> .995 ?8:0;
  storm.intensity=lightning;ambient.intensity=1.12+lightning*.1;
  moon.intensity=2.5+lightning*.15;
  for(let i=sparks.length-1;i>=0;i--){
   const item=sparks[i];item.life-=dt;
   for(const obj of item.group.children){
    obj.position.addScaledVector(obj.userData.velocity,dt);
    obj.userData.velocity.y-=dt*6;
    obj.scale.setScalar(Math.max(.08,item.life/.6));
   }
   if(item.life<=0){ship.remove(item.group);item.group.traverse(x=>{if(x.isMesh)x.geometry.dispose()});item.material.dispose();sparks.splice(i,1);}
  }
  return lightning>0;
 }
 function dispose(){
  scene.remove(water,moonDisk,halo,rain,ship,ambient,moon,rim,storm);
  rainGeo.dispose();sailGeo.dispose();water.geometry.dispose();water.material.dispose();rain.material.dispose();
 }
 return {ship,player,opponent,update,spark,dispose};
}
