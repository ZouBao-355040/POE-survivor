import test from 'node:test';
import assert from 'node:assert/strict';
import {activeGems,supportGems,catalog,gemById,researchIndex} from './projectile-catalog.mjs';
import {projectilePattern} from './projectile-pattern.mjs';
import {compatible,compileAttack} from './skill.mjs';
import {GemInventory} from './gem-inventory.mjs';
import {ModifierStore} from './modifiers.mjs';
import {weaponStats} from './weapon.mjs';
import {crudeBow} from './starter-data.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {gemXpRequired} from './gem-growth.mjs';
const mods=new ModifierStore(),weapon=weaponStats(crudeBow);
const player={x:0,y:0,life:100,maximumLife:100,mana:500,maximumMana:500,attackRange:12,accuracy:200,speed:4};
const target=(id,x,y)=>({id,x,y,life:1500,maximumLife:1500,radius:.4,defence:{},evasion:0,speed:0});
const t=target('a',5,0);
const g=id=>gemById.get(id);
const load=(active,supports=[])=>{
 const i=new GemInventory();for(const [n,item] of [active,...supports].entries()){i.acquire(item);i.equip(item.id,'weapon',n);}
 i.select(active.id);return i;
};

test('projectile data is localized, unique and has an explicit playable mapping for every indexed gem',()=>{
 assert.equal(researchIndex.length,activeGems.length+supportGems.length);
 assert.equal(catalog.length,gemById.size);
 assert.ok(researchIndex.every(g=>/[\u4e00-\u9fff]/.test(g.zh)));
 assert.ok(catalog.every(g=>g.description&&researchIndex.some(r=>r.key===g.sourceKey&&r.playable)));
});
test('Split Arrow and extra projectiles are a fan; Volley is parallel and symmetric',()=>{
 const active=g('split-arrow'),extra=g('greater-multiple-projectiles');
 const a=compileAttack(active,weapon,[extra],mods,()=>.5);
 assert.equal(active.projectileCount,5);
 assert.equal(a.additionalProjectiles,4);
 const fan=projectilePattern({player,target:t,count:9,skill:a,cooldown:.5});
 assert.equal(fan.length,9);assert.equal(fan[4].dy,0);assert.ok(fan.every(x=>x.x===0&&x.y===0));
 assert.ok(fan[0].dy<fan[4].dy&&fan[8].dy>fan[4].dy);
 const lanes=projectilePattern({player,target:t,count:5,skill:{...a,volley:true},cooldown:.5});
 assert.ok(lanes.every(x=>x.dx===1&&x.dy===0));assert.equal(lanes[2].y,0);assert.equal(lanes[0].y,-lanes[4].y);
});
test('Barrage releases successive shots instead of rendering delayed arrows at origin',()=>{
 const active=g('barrage'),skill=compileAttack(active,weapon,[],mods,()=>.5);
 const shots=projectilePattern({player,target:t,count:active.projectileCount,skill,cooldown:1});
 assert.equal(shots[0].delay,.4);assert.ok(shots.every((s,i)=>!i||s.delay>shots[i-1].delay));
 assert.equal(new Set(shots.map(s=>s.group)).size,shots.length);
});
test('shooting speed changes range at equal lifetime',()=>{
 const active=g('split-arrow');
 const shot=supports=>rangerHooks({modifiers:mods,inventory:load(active,supports),random:()=>.5}).onFire(player,t,0);
 const base=shot([]).projectile,fast=shot([g('faster-projectiles')]).projectile,slow=shot([g('slower-projectiles')]).projectile;
 assert.ok(fast.remainingRange>base.remainingRange&&base.remainingRange>slow.remainingRange);
 assert.equal(fast.remainingRange/fast.speed,base.remainingRange/base.speed);
 assert.ok(Math.abs(slow.remainingRange/slow.speed-base.remainingRange/base.speed)<1e-10);
});
test('projectile spells use spell damage, cast speed and compatible added damage',()=>{
 const active=g('fireball'),cold=g('added-cold-damage');
 assert.equal(compatible(active,cold),true);
 assert.equal(compatible(active,g('faster-attacks')),false);
 const s=compileAttack(active,weapon,[cold,g('faster-casting')],mods,()=>.5);
 assert.equal(s.source,'spell');assert.equal(s.baseDamage.fire,11.5);assert.equal(s.baseDamage.cold,10);
 assert.ok(s.attacksPerSecond>1/active.castTime);assert.equal(s.baseDamage.physical,undefined);
});
test('only the selected active and compatible linked supports gain experience',()=>{
 const i=load(g('fireball'),[g('added-cold-damage'),g('faster-attacks')]);
 i.acquire(g('split-arrow'));i.acquire(g('pierce'));i.equip('split-arrow','body',0);i.equip('pierce','body',1);
 const before=i.current().active.baseSpellDamage.fire[0];
 const up=i.grantExperience(gemXpRequired(1),1);
 assert.deepEqual(up.map(g=>g.id),['fireball','added-cold-damage']);
 assert.ok(i.current().active.baseSpellDamage.fire[0]>before);
 assert.equal(i.owned.get('split-arrow').experience,0);
 assert.equal(i.owned.get('pierce').experience,0);
 assert.equal(i.owned.get('faster-attacks').experience,0);
 i.select('split-arrow');i.grantExperience(10,10);
 assert.ok(i.owned.get('split-arrow').experience>10||i.owned.get('split-arrow').level>1);
});
test('every enabled active runs in the world against multiple targets',()=>{
 const failed=[];
 for(const active of activeGems){
  const inventory=load(active,[g('faster-projectiles'),g('added-fire-damage')]);
  let seed=31;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const hook=rangerHooks({modifiers:mods,inventory,random});
  const enemies=[t,target('b',6,1),target('c',4,-1),target('close',1.9,.3),target('right',-3,-.4)];
  let world={player:{...player},enemies,projectiles:[]};
  let fire=0;
  for(let i=0;i<320;i++){
   world=stepWorld(world,.02,{...hook,manaRegen:40});
   fire+=world.events.filter(e=>e.type==='fire'&&e.skill===active.id).length;
   assert.ok(world.projectiles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),active.id);
  }
  if(!fire||!(world.enemies.length<enemies.length||world.enemies.some(e=>e.life<1500)))failed.push(active.id);
 }
 assert.deepEqual(failed,[]);
});
test('all support gems link to at least one eligible active and compile with finite resources',()=>{
 for(const support of supportGems){
  const matches=activeGems.filter(a=>compatible(a,support));
  assert.ok(matches.length,support.id+' has no playable matches');
  for(const active of matches){
   const s=compileAttack(active,weapon,[support],mods,()=>.5);
   assert.deepEqual(s.linkedSupports,[support.id]);
   assert.ok(Number.isFinite(s.cost)&&s.cost>=0,active.id+'/'+support.id);
   assert.ok(Number.isFinite(s.attacksPerSecond)&&s.attacksPerSecond>0,active.id+'/'+support.id);
  }
 }
});
test('a projectile explosion hits the primary and adjacent enemy once',()=>{
 const inventory=load(g('fireball'));
 const hooks=rangerHooks({modifiers:mods,inventory,random:()=>.42});
 let world={player:{...player},enemies:[target('main',3,0),target('near',3,.7)],projectiles:[]};
 for(let i=0;i<22;i++)world=stepWorld(world,.02,hooks);
 assert.ok(world.enemies.every(e=>e.life<1500&&e.life>1475));
});
test('Vaal skill consumes souls and safely falls back until recharged',()=>{
 const active=g('vaal-fireball');
 const hooks=rangerHooks({modifiers:mods,inventory:load(active),random:()=>.4});
 assert.equal(hooks.onFire(player,t,0).skill,active.id);
 assert.equal(hooks.onFire(player,t,2).skill,active.id);
 assert.equal(hooks.onFire(player,t,4).skill,'fireball');
 hooks.addSouls(30,4.9);
 assert.equal(hooks.onFire(player,t,5.1).skill,'fireball');
 hooks.addSouls(30,6);
 assert.equal(hooks.onFire(player,t,6.1).skill,active.id);
});
test('copying supports do not consume additional mana and schedule independent repeats',()=>{
 const active=g('fireball');
 const hooks=rangerHooks({modifiers:mods,inventory:load(active,[g('spell-echo')]),random:()=>.4});
 const shot=hooks.onFire(player,t,0);
 assert.equal(shot.projectiles.length,2);
 assert.equal(shot.player.mana,player.mana-Math.floor(active.cost*g('spell-echo').costMultiplier));
 assert.ok(shot.projectiles[1].delay>shot.projectiles[0].delay);
 assert.notEqual(shot.projectiles[0].volley,shot.projectiles[1].volley);
});
test('a mine deploys at a target and its detonation does not spend the skill cost again',()=>{
 const active=g('icicle-mine'),hooks=rangerHooks({modifiers:mods,inventory:load(active),random:()=>.42});
 let world={player:{...player},enemies:[target('target',4,0)],projectiles:[]};
 world=stepWorld(world,.02,hooks);
 assert.equal(world.projectiles.length,0);
 assert.equal(world.fields[0].deploy,'mine');
 assert.equal(world.player.mana,player.mana-active.cost);
 for(let i=0;i<22;i++)world=stepWorld(world,.02,hooks);
 assert.equal(world.player.mana,player.mana-active.cost);
 assert.ok(world.enemies[0].life<1500);
});
