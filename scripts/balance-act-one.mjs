// Deterministic combat baseline. Neither mode purchases from the merchant.
// Simulation measures combat, not real-time campaign duration or player experience.
import {actOne,advanceRoute} from '../engine/act-one.mjs';
import {beginTrial,stepTrial} from '../engine/campaign.mjs';
import {GemInventory} from '../engine/gem-inventory.mjs';
import {gemById} from '../engine/projectile-catalog.mjs';
import {starterFlasks} from '../engine/flasks.mjs';
import {rangerHooks} from '../engine/ranger.mjs';
import {ModifierStore} from '../engine/modifiers.mjs';
import {resolveLevelChoice} from '../engine/progression.mjs';
import {allocateTalent,talentPoints} from '../engine/act-one-talents.mjs';
import {allocate,points,tracePath} from '../engine/passive-tree.mjs';
import {applyLoadout} from '../engine/player-loadout.mjs';
import {rollCurrencyChoices,claimLevelCurrency} from '../engine/currency.mjs';
import {craftAvailability,craftGear} from '../engine/gear-crafting.mjs';
import {newTownServices,emptyBattleLoot,queueTrialLoot,claimBattleLoot,equipGear,gearSlots} from '../engine/town-services.mjs';

const seed=number=>()=>((number=Math.imul(number,1664525)+1013904223|0)>>>0)/4294967296;
const checkGuard=process.env.CHECK_GUARD==='1',checkYouth=process.env.CHECK_YOUTH==='1';
const score=g=>g?g.value+(g.affixes??[]).reduce((n,x)=>n+x.value*(x.key==='life'?1:.45),0)+(checkGuard?.3*(g.baseDefence?.armour??0)+.5*(g.baseDefence?.energyShield??0):0):0;
const started={x:0,y:0,speed:4,attackRange:12,life:70,maximumLife:70,mana:58,maximumMana:58,energyShield:0,accuracy:90,evasion:15,defence:{}};
const output=[];
const checkCrimson=process.env.CHECK_CRIMSON==='1';
const builds=checkGuard||checkYouth?['split-arrow']:process.env.CHECK_BLEED==='1'||checkCrimson?['puncture']:['burning-arrow','split-arrow','fireball'];

for(const id of builds)for(const selfFound of checkGuard||checkYouth?[true]:[false,true]){
 const random=seed(137),lootRandom=seed(1737),inventory=new GemInventory(),modifiers=new ModifierStore();
 inventory.acquire(gemById.get(id));inventory.equip(id,'weapon',0);inventory.setMode(id,'auto');
 if(id!=='fireball'){inventory.acquire(gemById.get('momentum'));inventory.equip('momentum','weapon',1);}
 let town=newTownServices({starter:true}),drops=0,crafts=0,guardAreas=0,youthAreas=0;
 let state={player:started,zone:'town',gold:0,progression:{level:2,passivePoints:1},flasks:starterFlasks(),pendingLoot:emptyBattleLoot()};
 const rows=[];
 const opts={...rangerHooks({modifiers,inventory,random}),enemyModifiers:new ModifierStore(),random,manaRegen:2.85,
  experienceRequired:l=>24+l*13,deferLoot:true};
 const claimChoices=()=>{
  while(state.progression.pendingChoices){
   if(!selfFound){state={...state,progression:resolveLevelChoice(state.progression)};continue;}
   const choices=rollCurrencyChoices(lootRandom),choice=['點金石','蛻變石','富豪石','增幅石','改造石'].find(g=>choices.includes(g));
   const result=claimLevelCurrency(state.progression,town.storedOrbs,choices,choice);
   town={...town,storedOrbs:result.wallet};state={...state,progression:result.progression};
  }
 };
 for(const area of actOne){
  if(selfFound&&!state.progression.talents?.length&&talentPoints(state.progression).remaining)
   state={...state,progression:allocateTalent(state.progression,'39821')};
  if(checkCrimson||checkGuard||checkYouth){
   let progress=state.progression;
   for(const node of tracePath(progress,checkYouth?21650:checkGuard?24720:17818).slice(1)){
    if(progress.talents?.includes(String(node)))continue;
    if(points(progress).remaining===0)break;
    progress=allocate(progress,node);
   }
   state={...state,progression:progress};
  }
  const player=applyLoadout(started,town,state.progression,modifiers,{refill:true});
  if(checkGuard&&player.defence.hitArmourMultiplier===2&&player.defence.armour>0)guardAreas++;
  if(checkYouth&&player.rules.eternalYouth)youthAreas++;
  state=beginTrial({...state,player,flasks:starterFlasks(),zone:'town'},area);
  let bossAt,bossKO,minLife=player.life;
  for(let i=0;i<18000&&!state.dead&&state.encounter.phase!=='cleared';i++){
   claimChoices();
   const g=state.encounter.glyphs.find(g=>!g.taken);
   const dir=g?{x:g.x-state.player.x,y:g.y-state.player.y}:{x:Math.cos(i/54),y:Math.sin(i/54)};
   state=stepTrial(state,.02,{...opts,direction:dir,castPlan:inventory.castPlan()});
   minLife=Math.min(minLife,state.player.life);
   if(checkYouth&&Number.isFinite(state.player.lifeRechargeStarted))lifeRechargeSeen=true;
   for(const e of state.events??[]){
    if(e.type==='kill'){
     inventory.grantExperience(e.experience,state.progression.level);
     if(e.boss)bossKO=state.time;
     if(selfFound)state=queueTrialLoot(state,e,{random:lootRandom});
    }
    if(e.type==='boss-arrives')bossAt=state.time;
   }
  }
  rows.push({area:area.name,seconds:Math.round(state.time),bossSeconds:bossKO!==undefined&&bossAt!==undefined?Math.round(bossKO-bossAt):null,minLife:Math.round(minLife),phase:state.encounter.phase});
  if(state.dead||state.encounter.phase!=='cleared')break;
  claimChoices();
  if(selfFound){
   const result=claimBattleLoot(town,state.gold,state.pendingLoot,lootRandom);
   town=result.town;drops+=result.claimedGear;
   state={...state,gold:result.gold,pendingLoot:result.pending};
   for(const item of town.gear.filter(g=>!g.starter)){
    const orb=['點金石','蛻變石','富豪石'].find(o=>craftAvailability(item,o,town.storedOrbs).enabled);
    const equipped=town.gear.find(g=>g.id===town.equipped[item.slot]);
    if(orb&&score(item)>=score(equipped)*.8){
     town=craftGear(town,item.id,orb,lootRandom).town;crafts++;break;
    }
   }
   for(const slot of Object.keys(gearSlots)){
    const best=town.gear.filter(g=>g.slot===slot).sort((a,b)=>score(b)-score(a))[0];
    if(best&&town.equipped[slot]!==best.id)town=equipGear(town,best.id);
   }
  }
  state=advanceRoute(state);
 }
 const result={build:id,mode:selfFound?'field gear + crafting':'starter gear',
  cleared:!!state.chapterComplete,maps:state.routeIndex??0,drops,crafts,
  ...(checkCrimson?{level:state.progression.level,allocated:state.progression.talents?.includes('17818')??false}:{}),
  ...(checkGuard?{level:state.progression.level,guardAreas,armour:state.player.defence.armour,energyShield:state.player.maximumEnergyShield}:{}),
  ...(checkYouth?{youthAreas,level:state.progression.level}:{}),
  seconds:rows.reduce((sum,r)=>sum+r.seconds,0),minLife:Math.min(...rows.map(r=>r.minLife))};
 output.push(result);
 if(process.env.VERBOSE_BALANCE==='1'){console.log(result);console.table(rows);}
}
console.table(output);
if(output.some(r=>!r.cleared||checkCrimson&&!r.allocated||checkGuard&&!r.guardAreas||checkYouth&&!r.youthAreas||r.mode==='field gear + crafting'&&(r.drops<1||r.crafts<1)))process.exitCode=1;
