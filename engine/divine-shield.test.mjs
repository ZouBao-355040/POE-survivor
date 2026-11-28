import test from 'node:test';
import assert from 'node:assert/strict';
import {mitigateHit} from './defence.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {newTownServices} from './town-services.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {stepWorld} from './game-loop.mjs';
import {recordDivineShieldHit,tickDivineShield} from './keystones.mjs';
import {applyDamage,recover,recoveryLimit} from './resources.mjs';
import {retryBeach} from './campaign.mjs';
import {addHitLeech,advancePlayerLeech} from './player-leech.mjs';
import {rangerHooks} from './ranger.mjs';
import {catalog} from './projectile-catalog.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,actual+' ≠ '+expected);

test('prevention is the post-shift physical amount minus final physical hit damage',()=>{
 const hit=({source='attack',defender={},...rolls}={})=>mitigateHit({source,damage:{physical:100},defender,...rolls});
 near(hit({defender:{armour:500}}).physicalPrevented,50);
 near(hit({defender:{armour:500,attackBlock:.75},blockRoll:.5}).physicalPrevented,100);
 near(hit({defender:{armour:500,attackBlock:.75,blockedDamageFraction:.65},blockRoll:.5}).physicalPrevented,67.5);
 near(hit({source:'spell',defender:{suppressionChance:1},suppressRoll:.5}).physicalPrevented,50);
 near(hit({defender:{takenAs:[{from:'physical',to:'fire',fraction:.8}],resistances:{fire:.75}}}).physicalPrevented,0);
 near(hit({defender:{increasedTaken:.2}}).physicalPrevented,0);
});

test('Ranger acquires a functioning Divine Shield route using actual armour and energy shield',()=>{
 const pick=(p,id)=>tracePath(p,id).slice(1).reduce((s,n)=>allocate(s,n),p);
 const p=[58556,10661,3452].reduce(pick,{characterClass:'Ranger',passivePoints:50,level:51});
 const loaded=applyLoadout({life:100,mana:20,x:0,y:0},newTownServices({starter:true}),p,new ModifierStore());
 assert.ok(loaded.defence.armour>0);
 assert.ok(loaded.maximumEnergyShield>0);
 assert.equal(loaded.rules.divineShield,true);
 const opts={enemyModifiers:new ModifierStore(),random:()=>.3};
 let state={player:loaded,enemies:[],projectiles:[],time:0,enemyCasts:[
  {source:'physical',x:0,y:0,radius:1,damage:10,element:'physical',impactAt:.05}
 ]};
 state=stepWorld(state,.05,opts);
 assert.equal(state.player.energyShield,0);
 assert.equal(state.player.divineShieldHits.length,1);
 const prevented=state.player.divineShieldHits[0].prevented;
 near(prevented,10*loaded.defence.armour/(loaded.defence.armour+50));
 state=stepWorld(state,.05,opts);
 near(state.player.energyShield,.05*.03*prevented);
 const retried=retryBeach({...state,zone:'beach',dead:true});
 assert.equal(retried.player.divineShieldHits,undefined);
});

test('overlapping windows expire to substep precision; recovery respects armour and Ghost Dance, without removing shield',()=>{
 const original={rules:{divineShield:true,ghostDance:true},life:50,energyShield:0,maximumEnergyShield:100,evasion:4,defence:{armour:8}};
 const hit=(n,hit=true)=>({hit:{hit},mitigation:{physicalPrevented:n}});
 let p=recordDivineShieldHit(original,hit(50),0);
 p=recordDivineShieldHit(p,hit(10),0);
 p=recordDivineShieldHit(p,hit(40),1);
 p=recordDivineShieldHit(p,hit(90,false),1);
 assert.deepEqual(p.divineShieldHits,[{time:0,prevented:60},{time:1,prevented:40}]);
 const end=tickDivineShield(p,3.99,.03);
 near(end.energyShield,1.8*.01+1.2*.03);
 assert.equal(end.divineShieldHits.length,1);
 const over={...end,energyShield:6};
 assert.equal(recoveryLimit(over,'energyShield'),4);
 assert.equal(tickDivineShield(over,4.02,.02).energyShield,6);
 const lowArmour={...end,evasion:15,defence:{armour:2}};
 assert.equal(recover(lowArmour,'energyShield',80).energyShield,2);
});

test('DoT cannot create prevention and secondary energy shield recovery cannot bypass armour',()=>{
 const p={x:0,y:0,life:100,maximumLife:100,mana:50,maximumMana:50,maximumEnergyShield:100,energyShield:0,
  accuracy:1000,evasion:50,defence:{armour:5},rules:{divineShield:true}};
 const world=(player,extras={})=>({player,enemies:[],projectiles:[],time:0,...extras});
 const e={id:'shell-target',x:3,y:0,life:100,maximumLife:100};
 const dot=applyDamage({...p,energyShield:8},{physical:3},p.rules).state;
 near(dot.energyShield,5);assert.equal(dot.divineShieldHits,undefined);
 near(stepWorld(world({...p,esRegen:120}),.05).player.energyShield,5);
 near(stepWorld(world({...p,energyShield:4},{time:5}),.05).player.energyShield,5);
 near(stepWorld(world({...p,energyShield:25},{time:5}),.05).player.energyShield,25);
 const m=new ModifierStore();m.replace('leech',[{stat:'leechEnergyShield',kind:'flat',value:1}]);
 const result={hit:{hit:true},mitigation:{damage:{physical:100}}},shot={skill:{source:'attack'}};
 const instant={...p,energyShield:4,leechConfig:{instant:.5}};
 addHitLeech(instant,shot,result,m);
 near(instant.energyShield,5);
 const gradual={...p,energyShield:4};addHitLeech(gradual,shot,result,m);
 advancePlayerLeech(gradual,1);near(gradual.energyShield,5);
 const shell=catalog.find(g=>g.shell);
 const hooks=rangerHooks({modifiers:m,active:shell,random:()=>.4});
 near(stepWorld(world(p,{enemies:[e]}),.05,hooks).player.energyShield,5);
});
