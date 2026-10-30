/**
 * DuoForge V5 AURORA GT – original parametric GLB-ready showcase model.
 * No network assets, generated on demand. All parts are real, editable meshes.
 * Designed for full-fidelity PBR; the experimental BVH Ray Cinema uses only
 * an intentionally limited subset of the triangles, so prefer Detail PBR.
 */
import * as THREE from "three";
export const AURORA_V5_ID="v5-aurora";
export const AURORA_V5_NAME="AURORA V5 · Hyper GT";
export function createAuroraV5({quality="auto"}={}){
 const low=quality==="mobile"||(quality==="auto"&&
  ((typeof navigator!=="undefined"&&navigator.deviceMemory&&navigator.deviceMemory<=4)||
   (typeof window!=="undefined"&&Math.min(window.innerWidth,window.innerHeight)<620)));
 const detail=low?18:32,radial=low?24:40;
 const group=new THREE.Group();
 group.name=AURORA_V5_NAME;
 group.userData={duoforgeGenerator:"aurora-v5@1",modelId:AURORA_V5_ID,
  modelQuality:low?"mobile":"cinematic",license:"CC0-1.0 (original)",
  axes:"Y-up, front=-Z",optimizedFor:"GPU Deluxe V5 Detail PBR"};
 const physical=(color,roughness=.3,metalness=0,extras={})=>
  new THREE.MeshPhysicalMaterial({color,roughness,metalness,...extras});
 const mats={
  pearl:physical(0x167d78,.21,.67,{clearcoat:1,clearcoatRoughness:.12}),
  highlight:physical(0x8afbe3,.18,.28,{clearcoat:.9}),
  graphite:physical(0x172231,.39,.66,{clearcoat:.34}),
  carbon:physical(0x0d1420,.74,.16),
  rubber:physical(0x11141a,.93,.04),
  silver:physical(0xc6dde4,.19,.92),
  titanium:physical(0x60798b,.28,.78),
  bronze:physical(0xb89056,.25,.77),
  glass:physical(0x172d47,.085,.26,{clearcoat:1,clearcoatRoughness:.045,
   transparent:true,opacity:.84,depthWrite:false}),
  darkGlass:physical(0x0b1b2c,.12,.3,{clearcoat:1}),
  led:physical(0x4cffff,.23,.03,{emissive:0x16e9e9,emissiveIntensity:2.6}),
  tail:physical(0xff4166,.2,.04,{emissive:0xf0223e,emissiveIntensity:2}),
  amber:physical(0xffae68,.27,.12,{emissive:0xffa137,emissiveIntensity:.95})
 };
 const add=(geo,mat,name,x=0,y=0,z=0,parent=group)=>{
  const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 };
 const box=(name,mat,w,h,l,x,y,z)=>{
  const m=add(new THREE.BoxGeometry(w,h,l),mat,name,x,y,z);
  return m;
 };
 const capsule=(name,mat,x,y,z,wx,hy,lz)=>{
  const m=add(new THREE.SphereGeometry(1,detail,Math.max(10,Math.floor(detail*.65))),
   mat,name,x,y,z);
  m.scale.set(wx,hy,lz);return m;
 };
 function curve(name,mat,coords,radius=.019){
  const c=new THREE.CatmullRomCurve3(coords.map(p=>new THREE.Vector3(...p)));
  return add(new THREE.TubeGeometry(c,Math.max(20,coords.length*10),radius,6,false),mat,name);
 }
 function hull(name,mat,rings){
  const vertices=[],uvs=[],faces=[],count=detail*2;
  for(let i=0;i<rings.length;i++){
   const [z,w,h,y]=rings[i];
   for(let j=0;j<count;j++){
    const a=j/count*Math.PI*2;
    const taper=Math.sin(a)>0?1:.9;
    vertices.push(w*Math.cos(a),y+h*Math.sin(a)*taper,z);
    uvs.push(j/count,i/(rings.length-1));
   }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<count;j++){
   const a=i*count+j,b=(i+1)*count+j,c=(i+1)*count+(j+1)%count,d=i*count+(j+1)%count;
   faces.push(a,d,b,b,d,c);
  }
  // tapered end rings close visually without an expensive secondary cap mesh
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(faces);geometry.computeVertexNormals();
  return add(geometry,mat,name);
 }
 hull("01 · sculpted aerodynamic body",mats.pearl,[
  [-3.16,.035,.03,.79],[-2.96,.73,.18,.8],[-2.62,.95,.28,.83],
  [-2.03,1.08,.29,.87],[-1.45,1.13,.27,.94],[-.7,1.04,.3,.96],
  [.25,1.02,.28,.96],[1.15,1.12,.31,.95],
  [2.12,1.13,.34,.9],[2.73,.98,.25,.89],[3.03,.25,.13,.91],[3.07,.01,.01,.91]
 ]);
 hull("02 · floating glass canopy",mats.glass,[
  [-1.67,.015,.014,1.15],[-1.39,.46,.15,1.3],[-.93,.72,.3,1.37],
  [-.3,.76,.39,1.48],[.4,.7,.4,1.48],[1.03,.58,.29,1.38],
  [1.42,.22,.17,1.28],[1.5,.01,.01,1.22]
 ]);
 // Real structural center roof arch and seal visible beneath glass.
 curve("03 · canopy upper carbon arc",mats.graphite,
  [[0,1.59,-1.32],[0,1.84,-.8],[0,1.93,-.03],[0,1.81,.75],[0,1.48,1.38]],.045);
 for(const side of [-1,1]){
  curve("04 · canopy shoulder gasket",mats.carbon,[
   [side*.37,1.32,-1.44],[side*.68,1.48,-.93],
   [side*.76,1.44,-.28],[side*.64,1.39,.55],[side*.28,1.31,1.39]],.032);
  // Strong side aerodynamic fins and sills on both flanks.
  capsule("05 · side skirt airfoil",mats.graphite,side*1.03,.64,0,.14,.12,2.16);
  box("06 · carbon side-blade",mats.carbon,.15,.11,2.85,side*1.13,.68,-.08);
  curve("07 · luminous aerodynamic belt",mats.highlight,[
   [side*.81,1.04,-2.65],[side*1.035,1.08,-1.9],
   [side*1.075,1.13,-.75],[side*1.07,1.1,.68],[side*.91,1.09,2.57]],.016);
  capsule("08 · sculpted rear shoulder",mats.pearl,side*1.02,1.08,1.76,.23,.27,.86);
  capsule("09 · front fender contour",mats.pearl,side*.99,1.03,-1.8,.23,.26,.79);
  // Side mirrors, glass and mounting stalks.
  box("10 · mirror support",mats.titanium,.11,.11,.23,side*.8,1.4,-.84);
  capsule("11 · wing mirror",mats.pearl,side*.94,1.47,-.85,.19,.095,.23);
  box("12 · mirror glass",mats.darkGlass,.02,.12,.26,side*1.126,1.47,-.85);
  // Headlamp modules with cyan emissive laser-outline.
  capsule("13 · headlight shell",mats.graphite,side*.63,.94,-2.73,.28,.105,.26);
  box("14 · LED main light",mats.led,.37,.055,.08,side*.63,.98,-2.934);
  curve("15 · headlight contour",mats.highlight,[
   [side*.3,.98,-2.91],[side*.57,1.02,-2.88],[side*.83,.98,-2.77]],.022);
  // Rear LED graphics, diffuser vents, copper-accent detail.
  box("16 · rear LED",mats.tail,.61,.075,.095,side*.56,1.01,2.955);
  box("17 · rear carbon diffuser",mats.carbon,.35,.13,.38,side*.67,.58,2.82);
  box("18 · functional front air intake",mats.carbon,.34,.095,.21,side*.47,.63,-2.95);
  box("19 · intake titanium surround",mats.titanium,.4,.025,.21,side*.47,.72,-2.93);
  for(let k=0;k<4;k++){
   box("20 · louver",mats.graphite,.018,.052,.3,side*(.95+k*.065),1.19,1.94+k*.13);
  }
 }
 // Front sculpted lower bumper, rear wing and diffuser.
 box("21 · front splitter",mats.carbon,2.05,.07,.39,0,.57,-2.79);
 box("22 · splitter jewel accent",mats.highlight,1.5,.018,.037,0,.66,-3.012);
 capsule("23 · bonnet power dome",mats.pearl,0,1.13,-2.15,.49,.13,.76);
 curve("24 · bonnet signature left",mats.highlight,[
  [-.19,1.2,-2.8],[-.25,1.25,-2.35],[-.33,1.28,-1.7]],.018);
 curve("25 · bonnet signature right",mats.highlight,[
  [.19,1.2,-2.8],[.25,1.25,-2.35],[.33,1.28,-1.7]],.018);
 box("26 · rear wing main carbon",mats.carbon,2.24,.085,.42,0,1.59,2.5);
 box("27 · rear wing trailing titanium",mats.bronze,2.12,.028,.055,0,1.63,2.72);
 for(const side of [-1,1]){
  box("28 · wing strut",mats.titanium,.09,.39,.12,side*.8,1.35,2.48);
  box("29 · roof carbon spine",mats.graphite,.048,.047,.82,side*.43,1.79,-.14);
 }
 // Mechanical underframe and low-profile cockpit insert.
 box("30 · monocoque carbon underbody",mats.carbon,1.8,.15,4.7,0,.56,0);
 box("31 · cockpit center tunnel",mats.graphite,.36,.14,1.23,0,1.27,-.05);
 capsule("32 · cockpit seat left",mats.graphite,-.39,1.25,.16,.23,.27,.39);
 capsule("33 · cockpit seat right",mats.graphite,.39,1.25,.16,.23,.27,.39);
 // Real tires, brake disks, hubs, bolts, rims, and tread sections.
 for(const z of [-1.72,1.69])for(const side of [-1,1]){
  const wheel=new THREE.Group();
  wheel.name=(z<0?"Front":"Rear")+(side<0?" left":" right")+" · wheel assembly";
  wheel.position.set(side*1.12,.56,z);group.add(wheel);
  const tire=add(new THREE.CylinderGeometry(.55,.55,.3,radial,1,false),
   mats.rubber,"34 · tire carcass",0,0,0,wheel);
  tire.rotation.z=Math.PI/2;
  const outer=side*.17;
  const shoulder=add(new THREE.TorusGeometry(.445,.095,10,radial),mats.rubber,
   "35 · tire shoulder",outer,0,0,wheel);shoulder.rotation.y=Math.PI/2;
  const rim=add(new THREE.CylinderGeometry(.35,.35,.315,radial,1,false),
   mats.titanium,"36 · forged alloy wheel",0,0,0,wheel);rim.rotation.z=Math.PI/2;
  const ring=add(new THREE.TorusGeometry(.352,.023,8,radial),mats.bronze,
   "37 · satin bronze rim edge",side*.181,0,0,wheel);ring.rotation.y=Math.PI/2;
  const brake=add(new THREE.CylinderGeometry(.24,.24,.018,radial,1,false),
   mats.silver,"38 · brake rotor",side*.195,0,0,wheel);brake.rotation.z=Math.PI/2;
  for(let k=0;k<7;k++){
   const a=k*Math.PI*2/7;
   const spoke=add(new THREE.BoxGeometry(.029,.25,.075),mats.graphite,
    "39 · aerodynamic wheel spoke",side*.202,Math.cos(a)*.19,Math.sin(a)*.19,wheel);
   spoke.rotation.x=-a;
  }
  add(new THREE.CylinderGeometry(.087,.087,.38,radial,1,false),mats.bronze,
   "40 · central locking nut",0,0,0,wheel).rotation.z=Math.PI/2;
  for(let k=0;k<9;k++){
   const a=k*Math.PI*2/9;
   add(new THREE.SphereGeometry(.018,8,6),mats.silver,
    "41 · rim lock bolt",side*.227,Math.cos(a)*.29,Math.sin(a)*.29,wheel);
  }
  // Short segments of actual tread geometry, rather than painted strips.
  for(let k=0;k<radial;k++){
   const a=k*Math.PI*2/radial;
   for(const offset of [-.093,.093]){
    const block=add(new THREE.BoxGeometry(.105,.028,.13),mats.rubber,
     "42 · radial tire tread",offset,Math.cos(a)*.555,Math.sin(a)*.555,wheel);
    block.rotation.x=a;
   }
  }
  const caliper=add(new THREE.BoxGeometry(.062,.145,.12),mats.amber,
   "43 · visible brake caliper",side*.19,-.03,-.2,wheel);
  caliper.rotation.x=.33;
 }
 // Rear powertrain lights and charge socket.
 box("44 · charge port",mats.bronze,.19,.045,.15,0,1.19,2.53);
 box("45 · rear central LED",mats.tail,.26,.046,.078,0,1.05,3.02);
 // Placeholder visual ground is not included; Studio already has shadow floor.
 // The scene stays in meters with y=0 at the wheel contact patch.
 return group;
}
