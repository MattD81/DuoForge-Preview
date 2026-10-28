import * as THREE from 'three';
export function createEffects(scene){
  let bursts=[],time=0;const globe=new THREE.SphereGeometry(1,10,8);
  const palette={hit:0xffc175,block:0x59ffea,guardbreak:0xff3e66,ko:0xffee7a,special:0x27ffe9};
  function sparkBurst(x,y,z,type='hit',count=30){
    const color=palette[type]||palette.hit;
    const meshMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false});
    const group=new THREE.Group();group.position.set(x,y,z);scene.add(group);
    const rays=[];
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,vr=Math.random()*.4+.35;
      const q=new THREE.Mesh(globe,meshMat.clone());q.scale.set(.03+Math.random()*.04,.027+Math.random()*.035,.04);q.position.set(0,0,0);group.add(q);
      rays.push({mesh:q,vx:Math.cos(a)*vr*6,vy:(Math.random()-.25)*6,vz:(Math.random()-.5)*3});
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.035,6,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));ring.scale.setScalar(.08);ring.rotation.y=Math.PI/2;group.add(ring);
    const light=new THREE.PointLight(color,30,4);group.add(light);
    bursts.push({group,rays,ring,light,t:0,duration:type==='ko'?.95:.45});
  }
  function shockwave(x,y,z,blue=true){
    const color=blue?0x3fffe7:0xff4f68;
    for(let k=0;k<3;k++){
      const m=new THREE.Mesh(new THREE.TorusGeometry(.6+k*.25,.05,8,60),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false,blending:THREE.AdditiveBlending}));
      m.rotation.y=Math.PI/2;m.position.set(x,y,z);scene.add(m);bursts.push({standalone:m,t:k*.1,duration:.5});
    }
  }
  function update(dt){time+=dt;for(let j=bursts.length-1;j>=0;j--){const b=bursts[j];b.t+=dt;const a=Math.min(1,b.t/b.duration);
    if(b.standalone){b.standalone.scale.setScalar(1+a*3.4);b.standalone.material.opacity=.5*(1-a);}
    else{for(const ray of b.rays){ray.mesh.position.x+=ray.vx*dt;ray.mesh.position.y+=ray.vy*dt;ray.mesh.position.z+=ray.vz*dt;ray.vy-=6*dt;ray.mesh.material.opacity=1-a;}
      b.ring.scale.setScalar(.05+a*1.7);b.ring.material.opacity=1-a;b.light.intensity=(1-a)*33;}
    if(a>=1){scene.remove(b.group||b.standalone);b.group?.traverse(o=>{if(o.geometry!==globe)o.geometry?.dispose?.();o.material?.dispose?.();});b.standalone?.material.dispose();bursts.splice(j,1);}
  }}
  return {sparkBurst,shockwave,update,get active(){return bursts.length;}};
}
export function makeAudio(){
  let context=null;const enabled=()=>!!context;
  function activate(){if(!context){const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;context=new C();}context.resume?.();return true;}
  function tone(freq,duration,shape='sawtooth',gain=.08,start=0){if(!context)return;
    const now=context.currentTime+start,o=context.createOscillator(),g=context.createGain();
    o.type=shape;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.3),now+duration);
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g).connect(context.destination);o.start(now);o.stop(now+duration+.01);
  }
  function sound(type){if(!context)return;
    if(type==='hit'){tone(120,.15,'sawtooth',.095);tone(310,.09,'square',.055);}
    else if(type==='block'){tone(410,.08,'triangle',.055);tone(700,.06,'sine',.03,.04);}
    else if(type==='move'){tone(180,.06,'sawtooth',.022);}
    else if(type==='ko'){for(let i=0;i<5;i++)tone(420-i*58,.25,'sawtooth',.07,i*.11);}
    else if(type==='special'){tone(190,.5,'sawtooth',.1);tone(900,.34,'sine',.07,.08);}
    else if(type==='fight'){for(let i=0;i<3;i++)tone(280+i*80,.12,'triangle',.048,i*.12);}
  }
  function mute(){context?.suspend?.();}
  return {activate,sound,enabled,mute};
}
