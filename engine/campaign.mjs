import {starterFlasks} from './flasks.mjs?v=0.5.24';
import {actOne} from './act-one.mjs';
import {stepWorld} from './game-loop.mjs?v=0.5.27';

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
// Keep defeated enemies defeated: retry cannot duplicate tutorial rewards or reopen Hillock's fight.
function clearTransientRecovery(player={}){
 const {activeLeech,ghostClock,ghostShrouds,lifeCharging,lifeRechargeStarted,lifeRechargeInterruptedAt,divineShieldHits,recoupEffects,lastAttackHit,flaskHitReadyAt,pendingLifeFlaskCharges,...rest}=player;return rest;
}
export function retryBeach(state){
 if(state.zone!=='beach'||!state.dead)return state;
 const survivors=new Set(state.enemies.filter(e=>e.life>0).map(e=>e.id));
 return {...state,dead:false,paused:false,time:0,cooldown:0,skillCooldowns:{},
  enemies:openingBeach().filter(e=>survivors.has(e.id)),projectiles:[],fields:[],enemyCasts:[],enemyArrows:[],events:[],
  flasks:starterFlasks(),player:{...clearTransientRecovery(state.player),x:0,y:0,life:state.player.maximumLife,
   mana:state.player.maximumMana,energyShield:state.player.maximumEnergyShield??0}};
}
export function canEnterTown(state){
 return state.zone==='beach'&&!state.dead&&state.gateOpen===true&&Math.hypot(state.player.x-gate.x,state.player.y-gate.y)<=2.7;
}
export function stepBeach(state,dt,options){
 if(state.zone!=='beach'||state.paused||state.dead)return state;
 const next=stepWorld(state,dt,{...options,enemyStats:null,
  // The tutorial awards XP without interrupting the route with a reward prompt.
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

export const coastRules=actOne[0];
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
 return {...state,zone:'trial',time:0,nextSpawn:0,cooldown:0,skillCooldowns:{},dead:false,
  paused:false,projectiles:[],enemies:[],fields:[],enemyCasts:[],enemyArrows:[],goldDrops:[],events:[],
  player:{...clearTransientRecovery(state.player),x:0,y:0},encounter:{...budget,generated:0,arrivals:0,
   duration:rules.duration,maxActive,refillAt,phase:'waves',bossReason:null,heldEnemy:null,
   stageId:rules.id??'coast',stageName:rules.name??'暮光海灘',theme:rules.theme??'coast',
   rank:Math.max(0,actOne.findIndex(s=>s.id===rules.id)),
   boss:Object.hasOwn(rules,'id')?(rules.boss??null):coastRules.boss,
   glyphs:rules.glyphs?[{x:0,y:-5.5,taken:false},{x:-7,y:3,taken:false},{x:7,y:3,taken:false}]:[]}};
}
// PoE Coast families: Cannibal, Cannibal Fire-eater, Shore Crab and Fire Fury.
const coastFamilies=['cannibal','cannibal','fire-eater','cannibal','crab','cannibal'];
function coastNormal(id,x,y,band,i){
 const family=coastFamilies[(i+Math.floor(band/2))%coastFamilies.length];
 const life=Math.floor(band/3)*3;
 if(family==='fire-eater')return shoreEnemy(id,x,y,19+life,{family,name:'食人族噬火者',speed:1.48,range:5.6,attacksPerSecond:.33,
  radius:.37,experienceReward:6,fireCast:{damage:7,radius:1.12,windup:.82}});
 if(family==='crab')return shoreEnemy(id,x,y,27+life,{family,name:'沿岸蟹',speed:1.45,range:.7,physical:5,
  radius:.46,experienceReward:6,defence:{armour:5}});
 return shoreEnemy(id,x,y,19+life,{family,name:'食人族',speed:2.02+.08*(i%3),physical:4+Math.floor(band/4),experienceReward:6});
}
function routeNormal(encounter,id,x,y,band,i){
 if(encounter.theme==='coast')return coastNormal(id,x,y,band,i);
 const role=(i+band)%6,rank=encounter.rank,life=20+rank*2+Math.floor(band/3)*3;
 const kind=encounter.theme==='mud'?'恐喙鳥':encounter.theme==='prison'?'囚牢不死者':encounter.theme==='ridge'?'山道襲擊者':'洞穴爬行者';
 if(role===2&&encounter.stageId==='ledge')return shoreEnemy(id,x,y,life,{family:'ancient-archer',name:'遠古之弓',
  speed:1.55,range:7.1,physical:9,attacksPerSecond:.45,arrow:{speed:12,windup:.48,lifetime:.92},experienceReward:6});
 if(role===2)return shoreEnemy(id,x,y,life,{family:'fire-eater',name:'遠程伏擊者',speed:1.48,range:5.9,attacksPerSecond:.34,
  fireCast:{damage:8+Math.floor(rank*.7),radius:1.2,windup:.86},experienceReward:6});
 if(role===4)return shoreEnemy(id,x,y,life+10,{family:'crab',name:'重甲'+kind,speed:1.58,physical:6,radius:.49,defence:{armour:6+rank},experienceReward:6});
 return shoreEnemy(id,x,y,life,{family:'chaser',name:kind,speed:2.02+rank*.034,physical:4+Math.floor(rank/3),experienceReward:6});
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
   additions.push(routeNormal(e,e.stageId+'-'+n,x+side*Math.sin(angle),y-side*Math.cos(angle),band,n%e.perGroup));
  }
 }
 return {...state,enemies:[...state.enemies,...additions],encounter:{...e,arrivals,generated:e.generated+additions.length}};
}
function createStageBoss(player,encounter){
 const b=encounter.boss;
 return shoreEnemy(coastBossId,player.x+8,player.y,b.health,{boss:true,name:b.name,speed:b.speed??1.64,
  range:b.range??1.35,physical:b.physical??12,attacksPerSecond:b.rate,radius:.8,
  experienceReward:23,goldReward:9,flaskChargeReward:11,...(b.fireCast?{fireCast:b.fireCast}:{})});
}
function launchBoss(state,reason){
 const e=state.encounter,enemies=[...state.enemies];
 const heldEnemy=enemies.length>=e.maxActive?enemies.pop():null;
 return {...state,encounter:{...e,phase:'boss',bossReason:reason,heldEnemy},
  enemies:[...enemies,createStageBoss(state.player,e)],
  events:[...(state.events??[]),{type:'boss-arrives',reason,name:e.boss.name}]};
}
function collectGlyphs(next){
 const e=next.encounter;
 if(!e.glyphs.length)return next;
 const glyphs=e.glyphs.map(g=>g.taken||Math.hypot(g.x-next.player.x,g.y-next.player.y)>1.4?g:{...g,taken:true});
 if(glyphs.every((g,i)=>g===e.glyphs[i]))return next;
 return {...next,encounter:{...e,glyphs},events:[...next.events,{type:'glyph',count:glyphs.filter(g=>g.taken).length}]};
}
function finishStage(next){
 const encounter=next.encounter;
 const gold=next.gold+(next.goldDrops??[]).reduce((total,item)=>total+item.amount,0);
 const waiting=encounter.glyphs.some(g=>!g.taken);
 return {...next,gold,goldDrops:[],enemyCasts:[],enemyArrows:[],
  ...(waiting?{enemies:[],projectiles:[],fields:[]}:{}),
  encounter:{...encounter,phase:waiting?'glyphs':'cleared',heldEnemy:null},
  events:[...next.events,{type:waiting?'glyphs-needed':'trial-cleared'}]};
}
export function stepTrial(state,dt,options={}){
 if(!Number.isFinite(dt)||dt<0||dt>.05)throw new RangeError('Trial step must be between 0 and 50ms');
 if(state.zone!=='trial'||state.paused||state.dead||state.progression?.pendingChoices>0||state.encounter?.phase==='cleared')return {...state,events:[]};
 const random=options.random??Math.random;
 // Load the starting monsters immediately, then check the threshold again after combat.
 const input=state.encounter.phase==='waves'&&state.time<state.encounter.duration&&state.encounter.generated===0
  ?refill(state,random):state;
 const next=collectGlyphs(stepWorld(input,dt,{...options,enemyStats:null}));
 if(next.dead)return next;
 const encounter=next.encounter;
 if(encounter.phase==='waves'){
  const time=next.time+1e-9>=encounter.duration;
  const clear=encounter.generated===encounter.total&&next.enemies.length===0;
  if(time||clear)return encounter.boss?launchBoss(next,time?'time':'clear'):finishStage(next);
  return refill(next,random);
 }
 if(encounter.phase==='boss'&&next.events.some(event=>event.type==='kill'&&event.target===coastBossId))return finishStage(next);
 if(encounter.phase==='glyphs'&&encounter.glyphs.every(g=>g.taken))return finishStage(next);
 if(encounter.phase==='boss'&&encounter.boss?.phaseTwo){
  const boss=next.enemies.find(e=>e.boss&&!e.enraged&&e.life<=e.maximumLife/2);
  if(boss)return {...next,enemies:next.enemies.map(e=>e===boss?{...e,enraged:true,
   fireCast:{...e.fireCast,radius:e.fireCast.radius*1.25,windup:e.fireCast.windup*.8},
   attack:{...e.attack,attacksPerSecond:e.attack.attacksPerSecond*1.3}}:e),
   events:[...next.events,{type:'boss-phase',name:boss.name}]};
 }
 if(encounter.phase==='boss'&&encounter.heldEnemy&&next.enemies.length<encounter.maxActive){
  return {...next,enemies:[...next.enemies,encounter.heldEnemy],encounter:{...encounter,heldEnemy:null}};
 }
 return next;
}
