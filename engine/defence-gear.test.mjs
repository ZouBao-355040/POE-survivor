import test from 'node:test';
import assert from 'node:assert/strict';
import {newTownServices,emptyBattleLoot,queueTrialLoot,claimBattleLoot,equipGear,equippedStats} from './town-services.mjs';
import {craftGear} from './gear-crafting.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {mitigateHit} from './defence.mjs';
import {mitigateDot} from './dot.mjs';
import {stepWorld} from './game-loop.mjs';
import {recoveryLimit} from './resources.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const progression={characterClass:'Ranger',level:25,passivePoints:24};
const load=(town,p=progression)=>applyLoadout({x:0,y:0,life:100,mana:40},town,p,new ModifierStore(),{refill:true});
function dropBases(){
 let encounter={rank:0,stageId:'coast',stageName:'暮光海灘'};
 let state={encounter,pendingLoot:emptyBattleLoot()};
 for(const [slot,base] of [[.25,.45],[.45,.9]]){
  const rolls=[.005,.4,slot,base,.2];
  state=queueTrialLoot(state,{boss:false,gold:1},{random:()=>rolls.shift()??.9});
 }
 return claimBattleLoot(newTownServices({starter:true}),0,state.pendingLoot).town;
}
test('ordinary armour and ES loot keep legacy life bonuses, survive crafting and change a real hit',()=>{
 const town=dropBases(),[chest,helmet]=town.gear.slice(2);
 assert.equal(chest.rarity,'普通');assert.equal(helmet.rarity,'普通');
 assert.equal(chest.slot,'body');assert.equal(helmet.slot,'helmet');
 const baseline=load(town),equipped=equipGear(equipGear(town,chest.id),helmet.id);
 const ready=load(equipped),stats=equippedStats(equipped);
 assert.ok(ready.defence.armour>0);assert.ok(ready.energyShield>0);
 assert.equal(stats.life,chest.value+helmet.value);
 assert.equal(ready.maximumLife-baseline.maximumLife,stats.life);
 const hit=p=>stepWorld({player:p,enemies:[],projectiles:[],time:0,enemyCasts:[
  {x:0,y:0,radius:2,damage:20,element:'physical',impactAt:.05}
 ]},.05,{enemyModifiers:new ModifierStore(),random:()=>.3}).player;
 assert.equal(hit(baseline).life,baseline.life-20);
 const next=hit(ready);
 assert.ok(next.energyShield<ready.energyShield);
 assert.ok(ready.life-next.life+ready.energyShield-next.energyShield<20);
 const crafted=craftGear({...equipped,storedOrbs:{'蛻變石':1}},chest.id,'蛻變石',()=>0);
 assert.deepEqual(crafted.item.baseDefence,chest.baseDefence);
 assert.equal(load(equipGear(equipped,chest.id)).defence.armour,0);
});

test('Imbalanced Guard improves large hits but worsens small hits, without increasing sheet armour',()=>{
 const p=tracePath(progression,24720).slice(1).reduce((s,n)=>allocate(s,n),progression);
 const town=dropBases(),equipped=equipGear(town,town.gear[2].id),value=equipped.gear[2].baseDefence.armour;
 assert.equal(load(equipped,p).defence.hitArmourMultiplier,2);
 const balanced={armour:100},guard={...load(equipped,p).defence,armour:100};
 const hit=(physical,defender)=>mitigateHit({source:'attack',damage:{physical},defender}).total;
 near(hit(40,balanced),80/3);near(hit(40,guard),20);
 near(hit(20,balanced),10);near(hit(20,guard),10);
 near(hit(10,balanced),10/3);near(hit(10,guard),5);
 near(mitigateHit({source:'spell',damage:{fire:100},defender:{...guard,resistances:{fire:.75},suppressionChance:1},suppressRoll:0}).total,12.5);
 near(mitigateDot({physical:100},{...guard,additionalPhysicalReduction:.8}).physical,50);
 near(mitigateDot({physical:100},guard).physical,100);
 const testPlayer=load(equipped,p);
 assert.equal(testPlayer.defence.armour,value);
 assert.equal(recoveryLimit({...testPlayer,rules:{divineShield:true},maximumEnergyShield:200},'energyShield'),value);
});
