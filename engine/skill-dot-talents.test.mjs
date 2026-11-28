import test from 'node:test';
import assert from 'node:assert/strict';
import {ModifierStore} from './modifiers.mjs';
import {skillDotRate} from './dot.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {rangerHooks} from './ranger.mjs';
import {newTownServices} from './town-services.mjs';
import {activeGems} from './projectile-catalog.mjs';
import {GemInventory} from './gem-inventory.mjs';
import {stepWorld} from './game-loop.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const start={characterClass:'Ranger',level:28,passivePoints:27};
const path=(end,p=start)=>{
 const route=tracePath(p,end);
 assert.equal(route.at(-1),end);
 return route.slice(1).reduce((s,n)=>allocate(s,n),p);
};
const target=extra=>({id:'dummy',x:0,y:0,radius:.4,evasion:0,speed:0,life:1000,maximumLife:1000,defence:{},...extra});
function hitOrGround(p,key){
 const gem=activeGems.find(g=>g.sourceKey===key),inventory=new GemInventory(),modifiers=new ModifierStore();
 const player={...applyLoadout({life:70,mana:58,energyShield:0},newTownServices({starter:true}),p,modifiers,{refill:true}),x:2,y:0,accuracy:1000};
 inventory.acquire(gem);inventory.equip(gem.id,'weapon',0);inventory.setMode(gem.id,'auto');
 const hooks=rangerHooks({modifiers,inventory,random:()=>.40});
 const shot=hooks.onFire(player,target(),0).projectile;
 const fields=[],env={player,time:1,enemies:[target()],hit:()=>{},addField:f=>fields.push(f)};
 if(gem.drain){env.enemies=[hooks.onImpact(target(),shot,1,player)];}
 else if(gem.ground){
  shot.x=0;shot.y=0;
  hooks.onTerminate(shot,null,env);
  hooks.onPulse(fields.find(f=>f.type===gem.ground),env);
 }else{
  hooks.onPulse({...shot,x:0,y:0},env);
 }
 const [dot]=env.enemies[0].dots;
 const tick=stepWorld({player,enemies:env.enemies,projectiles:[],time:1},.04).enemies[0];
 near((env.enemies[0].life-tick.life)/.04,dot.rate);
 return {rate:dot.rate,life:env.enemies[0].life};
}

test('real chaos DoT talent independently raises Caustic Arrow ground, Soulrend trail and Essence Drain',()=>{
 const prefix=tracePath(start,58968).slice(1,-1).reduce((s,n)=>allocate(s,n),start);
 const chaos=allocate(prefix,58968);
 for(const key of ['CausticArrow','Soulrend','EssenceDrain']){
  const before=hitOrGround(prefix,key),after=hitOrGround(chaos,key);
  near(after.rate/before.rate,1.05);
  near(after.life,before.life);
 }
 near(hitOrGround(chaos,'FireballAltX').rate,hitOrGround(prefix,'FireballAltX').rate);
});

test('fire attack DoT multiplier scales Oil Arrow ground and not spell radiation',()=>{
 const fire=path(36736);
 near(hitOrGround(fire,'OilArrow').rate/hitOrGround(start,'OilArrow').rate,1.18);
 near(hitOrGround(fire,'FireballAltX').rate,hitOrGround(start,'FireballAltX').rate);
});

test('non-ailment multiplier is separate from increased damage and does not take hit-only or mismatched element modifiers',()=>{
 const m=new ModifierStore();
 m.replace('fixture',[{stat:'damageOverTime',kind:'increased',value:.2},
  {stat:'coldDamage',kind:'increased',value:.3},{stat:'elementalDamage',kind:'increased',value:.1},
  {stat:'damageOverTime',kind:'increased',value:.9,tags:['hit']},
  {stat:'dotMultiplier',kind:'flat',value:.15},{stat:'coldDotMultiplier',kind:'flat',value:.25},
  {stat:'fireDotMultiplier',kind:'flat',value:.80}]);
 near(skillDotRate(10,'cold',m,{tags:['spell','hit']}),10*1.6*1.4);
 near(skillDotRate(10,'chaos',m,{tags:['spell']}),10*1.2*1.15);
 near(skillDotRate(10,'cold',m,{tags:['minion']}),10*1.6);
});
