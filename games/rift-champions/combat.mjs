// DUOFORGE RIFT CHAMPIONS — pure, deterministic fighting simulation (no renderer required).
export const MOVES = Object.freeze({
  jab:{label:'JAB', startup:.11, active:.10, recovery:.20, damage:6, range:1.42, stun:.25, push:.24, meter:6, height:'high', impulse:.5},
  heavy:{label:'CROSS',startup:.26,active:.13,recovery:.40,damage:13,range:1.57,stun:.43,push:.49,meter:10,height:'high',impulse:1.1},
  kick:{label:'ROUNDHOUSE',startup:.22,active:.15,recovery:.34,damage:10,range:2.06,stun:.34,push:.42,meter:9,height:'mid',impulse:1.0},
  special:{label:'RIFT BURST',startup:.37,active:.21,recovery:.51,damage:19,range:4.9,stun:.54,push:.8,meter:0,cost:40,height:'mid',impulse:2.4},
});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function newFighter(name,x){return {name,x,y:0,vy:0,hp:100,guard:100,meter:0,face:x<0?1:-1,move:'idle',t:0,hitApplied:false,hitstun:0,blockstun:0,roundWins:0,combo:0,comboTimer:0,flash:0,impact:0,grounded:true};}
export function newMatch(){return {fighters:[newFighter('KAEL',-2.25),newFighter('VEX',2.25)],state:'intro',phaseTime:2.4,clock:90,round:1,winner:null,events:[],t:0,slow:0};}
function event(match,type,detail={}){match.events.push({type,...detail});}
function beginMove(match,f,i,type){const m=MOVES[type];if(!m||f.hitstun>0||f.blockstun>0||f.move!=='idle'||(m.cost&&f.meter<m.cost))return false;
  if(m.cost)f.meter-=m.cost;f.move=type;f.t=0;f.hitApplied=false;event(match,'move',{fighter:i,move:type});return true;}
function isBlocking(input,defender,attacker){return !!input.block&&defender.grounded&&defender.move==='idle'&&defender.hitstun<=0;}
function hit(match,attacker,defender,idx,defInput,move){
  if(attacker.hitApplied)return;
  const distance=Math.abs(attacker.x-defender.x);
  if(distance>move.range||distance<0.1||((defender.y>1.1)&&(move.height==='high')))return;
  attacker.hitApplied=true;
  const blocked=isBlocking(defInput,defender,attacker);
  const guardBreak=blocked&&defender.guard<move.damage*2.1;
  const blockedReal=blocked&&!guardBreak;
  const damage=blockedReal?Math.max(1,Math.round(move.damage*.17)):move.damage;
  defender.hp=clamp(defender.hp-damage,0,100);defender.guard=clamp(defender.guard-(blocked?move.damage*2.1:0),0,100);
  if(!blockedReal){defender.hitstun=move.stun;defender.move='idle';defender.t=0;defender.vy=move.impulse*.22;attacker.combo=attacker.comboTimer>0?attacker.combo+1:1;attacker.comboTimer=1.35;}
  else defender.blockstun=.17;
  attacker.meter=clamp(attacker.meter+move.meter+(blockedReal?1:4),0,100);defender.meter=clamp(defender.meter+(blockedReal?3:5),0,100);
  attacker.impact=.22;defender.impact=.32;defender.flash=.18;
  const direction=Math.sign(defender.x-attacker.x)||1;
  defender.x=clamp(defender.x+direction*move.push,-6.1,6.1);
  event(match,blockedReal?'block':guardBreak?'guardbreak':'hit',{fighter:idx,target:1-idx,move:attacker.move,damage,x:(attacker.x+defender.x)/2,y:1.2+(attacker.move==='kick'?.2:.45),combo:attacker.combo});
  if(defender.hp===0) {match.state='ko';match.phaseTime=2.4;match.winner=idx;match.fighters[idx].roundWins++;event(match,'ko',{winner:idx,loser:1-idx});}
}
function updateFighter(match,f,i,input,other,defInput,dt){
  f.face=other.x>f.x?1:-1;
  f.hitstun=Math.max(0,f.hitstun-dt);f.blockstun=Math.max(0,f.blockstun-dt);f.comboTimer=Math.max(0,f.comboTimer-dt);
  if(f.comboTimer===0)f.combo=0;
  f.flash=Math.max(0,f.flash-dt);f.impact=Math.max(0,f.impact-dt);
  f.guard=clamp(f.guard+(input.block?2.2:14)*dt,0,100);
  f.vy-=19.5*dt;f.y=Math.max(0,f.y+f.vy*dt);if(f.y===0)f.vy=0;f.grounded=f.y===0;
  if(f.hitstun>0||f.blockstun>0)return;
  if(f.move!=='idle'){
    const move=MOVES[f.move];f.t+=dt;
    if(f.t>=move.startup&&f.t<=move.startup+move.active)hit(match,f,other,i,defInput,move);
    if(f.t>=move.startup+move.active+move.recovery){f.move='idle';f.t=0;}
    return;
  }
  if(input.jump&&f.grounded){f.vy=6.8;event(match,'jump',{fighter:i});}
  if(input.special&&beginMove(match,f,i,'special'))return;
  if(input.heavy&&beginMove(match,f,i,'heavy'))return;
  if(input.kick&&beginMove(match,f,i,'kick'))return;
  if(input.jab&&beginMove(match,f,i,'jab'))return;
  const speed=(input.block?1.5:3.6)*(f.grounded?1:.7);
  const axis=clamp((input.right?1:0)-(input.left?1:0),-1,1);
  f.x=clamp(f.x+axis*speed*dt,-6.3,6.3);
}
function timeout(match){const [a,b]=match.fighters;const winner=a.hp===b.hp?null:a.hp>b.hp?0:1;
  match.state='ko';match.phaseTime=2.4;match.winner=winner;if(winner!==null)match.fighters[winner].roundWins++;event(match,'timeout',{winner});}
function prepareNextRound(match){
  const [a,b]=match.fighters;
  if(a.roundWins>=2||b.roundWins>=2){match.state='matchover';match.winner=a.roundWins>b.roundWins?0:1;event(match,'matchover',{winner:match.winner});return;}
  for(let i=0;i<2;i++){const f=match.fighters[i],fresh=newFighter(f.name,i===0?-2.25:2.25);Object.assign(f,fresh,{roundWins:f.roundWins,meter:clamp(f.meter*.5,0,100)});}
  match.round++;match.state='intro';match.phaseTime=2.0;match.clock=90;match.winner=null;event(match,'round',{round:match.round});
}
export function stepMatch(match,inputs=[{},{}],dt=1/60){
  dt=clamp(Number(dt)||0,0,1/20);match.events=[];match.t+=dt;const [a,b]=match.fighters;
  if(match.state==='matchover')return match;
  if(match.state==='intro'){match.phaseTime-=dt;if(match.phaseTime<=0){match.state='fight';event(match,'fight',{round:match.round});}return match;}
  if(match.state==='ko'){match.phaseTime-=dt;if(match.phaseTime<=0)prepareNextRound(match);return match;}
  match.clock=Math.max(0,match.clock-dt);if(match.clock<=0){timeout(match);return match;}
  const f1={...inputs[0]},f2={...inputs[1]};
  updateFighter(match,a,0,f1,b,f2,dt);
  if(match.state==='fight')updateFighter(match,b,1,f2,a,f1,dt);
  const distance=Math.abs(a.x-b.x),min=.98;
  if(distance<min){const center=(a.x+b.x)/2;const sign=a.x<=b.x?-1:1;a.x=clamp(center+sign*min/2,-6.3,6.3);b.x=clamp(center-sign*min/2,-6.3,6.3);}
  return match;
}
export function getPosePhase(f){if(f.hitstun>0)return 'hurt';if(f.blockstun>0)return 'block';if(f.move==='idle')return 'idle';const m=MOVES[f.move];return f.t<m.startup?'windup':f.t<m.startup+m.active?'active':'recovery';}
export function makeAI(level='normal'){
  let cooldown=0, plan='idle', guardTime=0; const diff=level==='hard'?1.4:level==='easy'?.68:1;
  return (match,dt)=>{const self=match.fighters[1],enemy=match.fighters[0],dist=Math.abs(self.x-enemy.x);
    cooldown-=dt;guardTime=Math.max(0,guardTime-dt);
    const input={};if(match.state!=='fight')return input;
    if(enemy.move!=='idle'&&dist<2.2&&enemy.t>.03&&Math.random()<.09*diff)guardTime=.35;
    input.block=guardTime>0;
    if(cooldown<=0){cooldown=(.24+Math.random()*.48)/diff;
      if(dist>2.9)plan='approach';else if(dist<1.1)plan=Math.random()<.45?'retreat':'attack';else plan=Math.random()<.67?'attack':'approach';
      if(plan==='attack'&&!input.block){const roll=Math.random();input.special=self.meter>=40&&dist<4.6&&roll>.85;input.heavy=roll>.53&&roll<=.85;input.kick=roll>.3&&roll<=.53;input.jab=roll<=.3;}
    }
    if(plan==='approach'&&dist>1.35)input[self.face===1?'right':'left']=true;
    if(plan==='retreat'&&dist<1.8)input[self.face===1?'left':'right']=true;
    return input;};
}
