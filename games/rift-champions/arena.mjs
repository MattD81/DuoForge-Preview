import * as THREE from 'three';
const m=(c,metalness=.45,roughness=.5,emissiveIntensity=0)=>new THREE.MeshStandardMaterial({color:c,metalness,roughness,emissive:c,emissiveIntensity});
function cube(parent,material,x,y,z,w,h,d){const v=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);v.position.set(x,y,z);parent.add(v);v.receiveShadow=true;v.castShadow=true;return v;}
function cylinder(parent,material,x,y,z,r,depth=1,segments=8){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,segments),material);o.position.set(x,y,z);parent.add(o);o.receiveShadow=true;return o;}
function ring(parent,material,x,y,z,r,tube=.06,rot=Math.PI/2){const o=new THREE.Mesh(new THREE.TorusGeometry(r,tube,6,60),material);o.position.set(x,y,z);o.rotation.x=rot;parent.add(o);return o;}
function spline(parent,material,points,r=.02){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const o=new THREE.Mesh(new THREE.TubeGeometry(path,32,r,6,false),material);parent.add(o);return o;}
function seed(n){let s=n>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function createArena(scene){
  const rnd=seed(0xF17E);const group=new THREE.Group();scene.add(group);
  const dark=m(0x121927,.5,.44),stone=m(0x1e2c38,.2,.91),metal=m(0x647282,.8,.26),metal2=m(0x252b3b,.84,.39),teal=m(0x18ffe1,.15,.27,2.1),red=m(0xff4f78,.12,.3,2.5),gold=m(0xe2b36e,.55,.32,.4);
  // Large raised platform, exposed hexagonal cut stone, technical gaps.
  cube(group,dark,0,-.49,0,15,.9,9);cube(group,metal2,0,-.04,0,14.4,.1,8.5);
  for(let x=-6.5;x<7;x+=1.05)for(let z=-3.55;z<=3.55;z+=1.05){
    const tile=cylinder(group,stone,x,-.012,z,.55,.035,6);tile.rotation.y=Math.PI/6;
    if(rnd()>.87){const inset=cylinder(group,metal2,x,.014,z,.42,.022,6);inset.rotation.y=Math.PI/6;}
  }
  for(const z of [-4.22,4.22]){
    cube(group,metal,0,.04,z,14.4,.13,.08);
    for(let i=-6.5;i<=6.5;i+=.8)cube(group,i%2?teal:red,i,.11,z,.26,.018,.12);
  }
  // In-world battle lane lines.
  for(let i=-6;i<=6;i+=2){cube(group,teal,i,.025,-.54,.42,.012,.028);cube(group,red,i,.025,.56,.42,.012,.028);}
  ring(group,teal,0,.04,0,3.8,.018);ring(group,metal,0,.037,0,3.42,.013);
  // Back megastructure, gate, pylons and orbiting portal.
  cube(group,dark,0,2.7,-6,16,5.4,2.5);
  cube(group,metal2,0,5.35,-5.6,13,.6,1);
  for(const side of [-1,1]){
    cube(group,metal,side*5.35,2.7,-4.4,.55,5.4,.65);
    cube(group,teal,side*5.35,2.5,-4.02,.11,3.8,.06);
    cube(group,dark,side*5.5,.8,-5.0,1.4,1.6,1.4);
    cylinder(group,gold,side*5.36,4.9,-4.22,.33,.2,12);
  }
  const portal=new THREE.Group();portal.position.set(0,3.15,-5.12);group.add(portal);
  const portalRing=ring(portal,metal,0,0,0,2.05,.17,0);const portalRing2=ring(portal,teal,0,0,.05,1.81,.065,0);const portalRing3=ring(portal,red,0,0,-.07,1.55,.026,0);
  for(let i=0;i<22;i++){const a=(i/22)*Math.PI*2;cube(portal,i%3===0?red:gold,Math.cos(a)*1.92,Math.sin(a)*1.92,.06,.13,.08,.1).rotation.z=a;}
  // Skyline populated with individually lit structures, haze-friendly.
  const skyline=new THREE.Group();scene.add(skyline);const windows=[];
  for(let i=0;i<48;i++){
    const x=(rnd()-.5)*42, h=1+rnd()*8, z=-12-rnd()*30;
    const b=cube(skyline,i%2?dark:metal2,x,h/2-1.2,z,1.1+rnd()*2.3,h,1.4+rnd()*2.4);
    b.castShadow=false;
    if(i%4===0){cube(skyline,i%3===0?teal:red,x,h-1.15,z,.25,.055,1.8);}
    for(let j=0;j<5;j++){if(rnd()>.42){const ww=cube(skyline,rnd()>.5?teal:gold,x+(rnd()-.5)*.6,.3+j*(h/6),z+1.1,.07,.07,.03);ww.castShadow=false;windows.push(ww);}}
  }
  // Floating ember shards, hanging strips, rain-esque atmosphere.
  const particles=[];
  for(let i=0;i<130;i++){const material=i%3===0?red:teal;
    const o=new THREE.Mesh(new THREE.OctahedronGeometry(.017+rnd()*.045,0),material);
    o.position.set((rnd()-.5)*23,.4+rnd()*8,(rnd()-.5)*17-3);o.userData={speed:.22+rnd()*.56,phase:rnd()*6.28};group.add(o);particles.push(o);
  }
  // Mechanical pillars and animated glow tubes framing fighting space.
  for(const x of [-8,8])for(const z of [-2.4,2.4]){
    cylinder(group,metal2,x,2.2,z,.35,4.5,8);cube(group,gold,x,4.35,z,.83,.3,.82);
    for(let y=.5;y<4.1;y+=.55){ring(group,teal,x,y,z,.31,.025);}
  }
  // Environment and cinematic lights.
  scene.background=new THREE.Color(0x050912);scene.fog=new THREE.FogExp2(0x080d1c,.027);
  const hemi=new THREE.HemisphereLight(0x87cbd5,0x0e111b,1.65);scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffe2c7,3.15);key.position.set(-4,9,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-12;key.shadow.camera.right=12;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.camera.near=.5;key.shadow.camera.far=28;key.shadow.bias=-.0005;scene.add(key);
  const rim=new THREE.PointLight(0x18eddb,120,20,2);rim.position.set(-6,4,-3);scene.add(rim);
  const rim2=new THREE.PointLight(0xff5574,120,18,2);rim2.position.set(6,4,-3);scene.add(rim2);
  const portalLight=new THREE.PointLight(0x00e8de,65,13,2);portalLight.position.set(0,3,-4);scene.add(portalLight);
  const clock=new THREE.Clock();
  return {group,update:(t,dt)=>{
    portalRing.rotation.z=t*.1;portalRing2.rotation.z=-t*.15;portalRing3.rotation.z=t*.09;
    portalLight.intensity=48+Math.sin(t*1.5)*13;
    for(const o of particles){o.position.y+=o.userData.speed*dt;if(o.position.y>8.6)o.position.y=.25;o.rotation.y+=dt;}
    for(let i=0;i<windows.length;i++)windows[i].visible=(Math.sin(t*.7+i*2.04)>-.8);
  }};
}
