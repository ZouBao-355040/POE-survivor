// Deterministic, simplified tester: no purchases; circular movement, walks to glyphs, heals at town between maps.
// These are modelled combat times, not measured player playtimes.
import {actOne,advanceRoute} from '../engine/act-one.mjs';
import {beginTrial,stepTrial} from '../engine/campaign.mjs';
import {GemInventory} from '../engine/gem-inventory.mjs';
import {gemById} from '../engine/projectile-catalog.mjs';
import {starterFlasks} from '../engine/flasks.mjs';
import {rangerHooks} from '../engine/ranger.mjs';
import {ModifierStore} from '../engine/modifiers.mjs';
import {resolveLevelChoice} from '../engine/progression.mjs';

for(const id of ['burning-arrow','split-arrow','fireball']){
 let k=137;
 const random=()=>((k=Math.imul(k,1664525)+1013904223|0)>>>0)/4294967296;
 const inventory=new GemInventory(),modifiers=new ModifierStore();
 inventory.acquire(gemById.get(id));inventory.equip(id,'weapon',0);inventory.select(id);
 if(id!=='fireball'){inventory.acquire(gemById.get('momentum'));inventory.equip('momentum','weapon',1);}
 const player={x:0,y:0,speed:4,attackRange:12,life:70,maximumLife:70,mana:58,maximumMana:58,energyShield:0,accuracy:90,evasion:15,defence:{}};
 let state={player,zone:'town',gold:0,progression:{level:2},flasks:starterFlasks()};
 const rows=[];
 const opts={...rangerHooks({modifiers,inventory,random}),enemyModifiers:new ModifierStore(),random,manaRegen:2.85,experienceRequired:l=>24+l*13};
 for(const area of actOne){
  state=beginTrial({...state,player:{...player},flasks:starterFlasks(),zone:'town'},area);
  let bossAt,bossKO,minLife=player.life;
  for(let i=0;i<18000&&!state.dead&&state.encounter.phase!=='cleared';i++){
   if(state.progression.pendingChoices){state={...state,progression:resolveLevelChoice(state.progression)};continue;}
   const g=state.encounter.glyphs.find(g=>!g.taken);
   const dir=g?{x:g.x-state.player.x,y:g.y-state.player.y}:{x:Math.cos(i/54),y:Math.sin(i/54)};
   state=stepTrial(state,.02,{...opts,direction:dir});
   minLife=Math.min(minLife,state.player.life);
   for(const e of state.events??[]){
    if(e.type==='kill'){inventory.grantExperience(e.experience,state.progression.level);if(e.target==='coast-boss')bossKO=state.time;}
    if(e.type==='boss-arrives')bossAt=state.time;
   }
  }
  rows.push({area:area.name,seconds:Math.round(state.time),bossSeconds:bossKO!==undefined&&bossAt!==undefined?Math.round(bossKO-bossAt):null,minLife:Math.round(minLife),phase:state.encounter.phase});
  if(state.dead||state.encounter.phase!=='cleared')break;
  state=advanceRoute(state);
 }
 console.log(id, state.chapterComplete?'cleared':'unfinished');
 console.table(rows);
}
