import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {ModifierStore} from './modifiers.mjs';
import {newTownServices} from './town-services.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {addHitLeech,advancePlayerLeech} from './player-leech.mjs';

const classState={passiveClass:'Ranger',passivePoints:100};
const route=(p,end)=>tracePath(p,end).slice(1).reduce((s,id)=>allocate(s,id),p);
const load=p=>{
 const modifiers=new ModifierStore();
 const stats=applyLoadout({life:70,mana:58,energyShield:0},newTownServices({starter:true}),p,modifiers,{refill:true});
 return {modifiers,player:{...stats,x:0,y:0,accuracy:100,life:20,mana:10,energyShield:0}};
};
const hit=(source='attack',type='physical',proxy)=>({
 x:0,y:0,dx:1,dy:0,speed:30,remainingRange:5,leechProxy:proxy,attacker:{},
 skill:{id:'test-hit',source,active:{tags:[]},baseDamage:{[type]:100},context:{tags:[source]},hitDamageMultiplier:1,damageMultiplier:1},
 rolls:{block:.4,critical:.8,confirmation:.8,ignite:.8}
});
const foe={id:'test',x:1,y:0,radius:.4,speed:0,life:200,maximumLife:200,evasion:0,accuracy:0,defence:{}};
const impact=(player,modifiers,shot,enemy=foe)=>stepWorld({player,enemies:[enemy],projectiles:[shot],time:0},.05,{onImpact:rangerHooks({modifiers}).onImpact});
const drain=(p,dt=.01)=>{const s={...p};advancePlayerLeech(s,dt);return s;};
const pending=(p,key)=>(p.activeLeech?.[key]??[]).reduce((n,i)=>n+i.remaining,0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,a+' ≠ '+b);

test('actual skill hit queues both Life and Mana Leech; both settle over time',()=>{
 const {player,modifiers}=load(route(route(classState,3634),51420));
 const after=impact(player,modifiers,hit());
 near(pending(after.player,'life'),.4);
 near(pending(after.player,'mana'),.4);
 const next=stepWorld(after,.05);
 assert.ok(next.player.life>after.player.life);
 assert.ok(next.player.mana>after.player.mana);
 assert.equal(after.player.mana,player.mana);
 near(pending(after.player,'mana'),.4);
});

test('spell, physical, totem transfer and proxy ownership are scoped after combat mitigation',()=>{
 const {player,modifiers}=load(classState);
 const p={...player,maximumEnergyShield:100};
 modifiers.replace('leech',[
  {stat:'leechPhysicalLife',kind:'flat',value:.01,tags:['attack']},
  {stat:'leechEnergyShield',kind:'flat',value:.02,tags:['spell']},
  {stat:'leechTotemPhysicalLife',kind:'flat',value:.005},
 ]);
 near(pending(impact(p,modifiers,hit('attack','fire')).player,'life'),0);
 near(pending(impact(p,modifiers,hit('spell','physical')).player,'life'),0);
 near(pending(impact(p,modifiers,hit('spell','fire'),{...foe,defence:{resistances:{fire:.5}}}).player,'energyShield'),1);
 near(pending(impact(p,modifiers,hit('attack','physical','totem')).player,'life'),.5);
 for(const proxy of ['trap','mine','mirage','minion','wisp']){
  near(pending(impact(p,modifiers,hit('attack','physical',proxy)).player,'life'),0);
  near(pending(impact(p,modifiers,hit('spell','physical',proxy)).player,'energyShield'),0);
 }
 near(pending(impact({...p,accuracy:0},modifiers,hit(),{...foe,evasion:99999}).player,'life'),0);
 near(pending(impact(p,modifiers,hit(),{...foe,defence:{attackBlock:.75,blockedDamageFraction:.65}}).player,'life'),0);
});
test('Ghost Reaver redirects life leech, doubles the total ES leech cap, but leaves ES regeneration intact',()=>{
 const base=route(classState,3634), {player,modifiers}=load(route(base,24426));
 assert.ok(nodes.get(24426).implemented);
 const p={...player,maximumEnergyShield:100,lifeRegen:0};
 const after=impact(p,modifiers,hit());
 near(pending(after.player,'life'),0);
 near(pending(after.player,'energyShield'),.4);
 const tick=stepWorld({...after,time:5},.05);
 near(tick.player.energyShield,.1);
 const baseShield={...p,activeLeech:null,esRegen:2};
 near(stepWorld({player:baseShield,time:5,enemies:[],projectiles:[]},.05).player.energyShield,.1);
 const stacks=Array.from({length:15},()=>({rate:2,remaining:10}));
 near(drain({...baseShield,activeLeech:{energyShield:stacks}},.05).energyShield,1);
 near(drain({...baseShield,rules:{},activeLeech:{energyShield:stacks}},.05).energyShield,.5);
});

test('instant leech, rate and total cap obey the per-hit limit and clear at full or death',()=>{
 const p={life:20,maximumLife:100,leechConfig:{instant:.05,life:{cap:1.4,rate:2}}};
 const modifiers=new ModifierStore();
 modifiers.replace('leech',[{stat:'leechLife',kind:'flat',value:1,tags:['attack']}]);
 const syntheticHit={hit:{hit:true},mitigation:{damage:{physical:100}}};
 addHitLeech(p,hit(),syntheticHit,modifiers);
 near(p.life,20.5);
 near(pending(p,'life'),9.5);
 const one=drain(p,.05);
 near(one.life,20.7);
 near(pending(one,'life'),9.3);
 const capped=drain({...p,activeLeech:{life:Array.from({length:10},()=>({rate:4,remaining:10}))}},.05);
 near(capped.life,21.9);
 const unreserved=drain({...p,life:89.9,reservedLife:10},.05);
 near(unreserved.life,90);
 assert.equal(unreserved.activeLeech,undefined);
 assert.equal(drain({...p,life:0}).activeLeech,undefined);
});
