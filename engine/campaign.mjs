import {stepWorld} from './game-loop.mjs';

export const places=Object.freeze({beach:'絕望岩灘',town:'獅眼守望',trial:'暮光海灘',practice:'試射場'});
export const gate={x:30,y:0};
export const hillockId='hillock';
const bounds={left:-2,right:31,top:-5,bottom:5};
const soulsDefault={range:.65,speed:1.6};
function shoreEnemy(id,x,y,life=12,options={}){
 const {speed=soulsDefault.speed,range=soulsDefault.range,physical=3,attacksPerSecond=.8,...extra}=options;
 return {id,x,y,life,maximumLife:life,evasion:0,accuracy:72,defence:{},speed,attackRange:range,radius:.38,experienceReward:7,
  attack:{baseDamage:{physical},attacksPerSecond,criticalChance:0},...extra};
}
export function openingBeach(){
 return [
  shoreEnemy('shore-1',5,.1),shoreEnemy('shore-2',10,-2.3),shoreEnemy('shore-3',14,2.2),
  shoreEnemy('shore-4',18,-1.5,14),shoreEnemy('shore-5',21,2,14),
  shoreEnemy(hillockId,26,0,88,{boss:true,name:'西拉克',speed:1.38,range:1.15,physical:10,attacksPerSecond:.54,
   radius:.68,experienceReward:16,goldReward:0,flaskChargeReward:11,attackCooldown:.7})
 ];
}
export function canEnterTown(state){
 return state.zone==='beach'&&!state.dead&&state.gateOpen===true&&Math.hypot(state.player.x-gate.x,state.player.y-gate.y)<=2.7;
}
export function stepBeach(state,dt,options){
 if(state.zone!=='beach'||state.paused||state.dead)return state;
 const next=stepWorld(state,dt,{...options,enemyStats:null,
  // The tutorial awards XP without interrupting the route with a level shop.
  experienceRequired:null});
 const opened=next.events.some(e=>e.type==='kill'&&e.target===hillockId);
 const x=Math.max(bounds.left,Math.min(bounds.right,next.player.x)),y=Math.max(bounds.top,Math.min(bounds.bottom,next.player.y));
 let gold=next.gold,goldDrops=next.goldDrops;
 if(opened){
  gold+=(goldDrops??[]).reduce((sum,d)=>sum+d.amount,0);goldDrops=[];
 }
 // Keep tutorial XP earned so the town is not a progression reset.
 const beachXP=(state.beachXP??0)+next.events.filter(e=>e.type==='kill').reduce((sum,e)=>sum+(e.experience??0),0);
 return {...next,player:{...next.player,x,y},gold,goldDrops,gateOpen:!!(state.gateOpen||opened),beachXP};
}

export const coastRules=Object.freeze({duration:120,packs:10,packSize:6,maxActive:12,refillAt:6});
export const coastBossId='coast-boss';
export function trialBudget({packs,packSize},{extraPacks=0,increasedPackSize=0}={}){
 const groups=Math.max(0,Math.floor(packs+extraPacks));
 const perGroup=Math.max(0,Math.floor(packSize*(1+increasedPackSize)));
 return {groups,perGroup,total:groups*perGroup};
}
export function beginTrial(state,rules=coastRules,mapMods){
 const budget=trialBudget(rules,mapMods);
 const maxActive=rules.maxActive??coastRules.maxActive;
 const refillAt=rules.refillAt??Math.floor(maxActive/2);
 if(!Number.isSafeInteger(maxActive)||maxActive<1||!Number.isSafeInteger(refillAt)||refillAt<0||refillAt>=maxActive)
  throw new RangeError('Active ceiling must exceed the non-negative refill line');
 return {...state,zone:'trial',time:0,nextSpawn:0,cooldown:0,dead:false,
  paused:false,projectiles:[],enemies:[],fields:[],goldDrops:[],events:[],
  player:{...state.player,x:0,y:0},encounter:{...budget,generated:0,arrivals:0,
   duration:rules.duration,maxActive,refillAt,phase:'waves',bossReason:null,heldEnemy:null}};
}
function refill(state,random){
 const e=state.encounter;
 const alive=state.enemies.filter(enemy=>enemy.life>0).length;
 if(alive>e.refillAt)return state;
 const count=Math.min(e.maxActive-alive,e.total-e.generated);
 if(count<=0)return state;
 const additions=[];
 let arrivals=e.arrivals;
 while(additions.length<count){
  const groupLength=Math.min(e.perGroup,count-additions.length);
  const angle=2.399963*arrivals+random()*Math.PI/2;
  arrivals++;
  const x=state.player.x+Math.cos(angle)*11,y=state.player.y+Math.sin(angle)*11;
  for(let i=0;i<groupLength;i++){
   const n=e.generated+additions.length,band=Math.floor(n/e.perGroup),side=(i-(groupLength-1)/2)*.62;
   additions.push(shoreEnemy('coast-'+n,x+side*Math.sin(angle),y-side*Math.cos(angle),17+Math.floor(band/3)*3,
    {speed:1.58+.07*(i%3),physical:3+Math.floor(band/4),experienceReward:6}));
  }
 }
 return {...state,enemies:[...state.enemies,...additions],encounter:{...e,arrivals,generated:e.generated+additions.length}};
}
function createCoastBoss(player){
 return shoreEnemy(coastBossId,player.x+8,player.y,156,{boss:true,name:'怒炎之使',speed:1.58,
  range:1.4,physical:12,attacksPerSecond:.65,radius:.76,experienceReward:23,goldReward:9,flaskChargeReward:11});
}
function launchBoss(state,reason){
 const e=state.encounter,enemies=[...state.enemies];
 // Reserve one slot without treating the displaced monster as a kill.
 const heldEnemy=enemies.length>=e.maxActive?enemies.pop():null;
 return {...state,encounter:{...e,phase:'boss',bossReason:reason,heldEnemy},
  enemies:[...enemies,createCoastBoss(state.player)],
  events:[...(state.events??[]),{type:'boss-arrives',reason}]};
}
export function stepTrial(state,dt,options={}){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Trial step must be between 0 and 50ms');
 if(state.zone!=='trial'||state.paused||state.dead||state.progression?.pendingChoices>0||state.encounter?.phase==='cleared')return {...state,events:[]};
 const random=options.random??Math.random;
 // Load the starting monsters immediately, then check the threshold again after combat.
 const input=state.encounter.phase==='waves'&&state.time<state.encounter.duration&&state.encounter.generated===0
  ?refill(state,random):state;
 const next=stepWorld(input,dt,{...options,enemyStats:null});
 if(next.dead)return next;
 const encounter=next.encounter;
 if(encounter.phase==='waves'){
  if(next.time+1e-9>=encounter.duration)return launchBoss(next,'time');
  if(encounter.generated===encounter.total&&next.enemies.length===0)return launchBoss(next,'clear');
  return refill(next,random);
 }
 if(encounter.phase==='boss'&&next.events.some(event=>event.type==='kill'&&event.target===coastBossId)){
  const gold=next.gold+(next.goldDrops??[]).reduce((total,item)=>total+item.amount,0);
  return {...next,gold,goldDrops:[],progression:{...next.progression,pendingChoices:0},
   encounter:{...encounter,phase:'cleared',heldEnemy:null},events:[...next.events,{type:'trial-cleared'}]};
 }
 if(encounter.phase==='boss'&&encounter.heldEnemy&&next.enemies.length<encounter.maxActive){
  return {...next,enemies:[...next.enemies,encounter.heldEnemy],encounter:{...encounter,heldEnemy:null}};
 }
 return next;
}
