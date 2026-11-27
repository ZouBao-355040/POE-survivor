import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,nodes,points,starts,tracePath,treeStatus} from './passive-tree.mjs';
import {ModifierStore} from './modifiers.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {compileAttack} from './skill.mjs';
import {basicBowAttack,crudeBow,burningArrow} from './starter-data.mjs';
import {weaponStats} from './weapon.mjs';
import {paySkillCost,applyDamage} from './resources.mjs';
import {rangerHooks} from './ranger.mjs';
import {GemInventory} from './gem-inventory.mjs';
import {stepWorld} from './game-loop.mjs';

const all=[...nodes.values()];
const initial={passiveClass:'Ranger',passivePoints:100};
const walk=(p,id)=>{
 const path=tracePath(p,id);
 assert.ok(path.length>=2,'no implemented route to '+id);
 return path.slice(1,-1).reduce((state,node)=>allocate(state,node),p);
};
const pick=(p,id,option)=>allocate(walk(p,id),id,option);
const load=(p=initial)=>{
 const mods=new ModifierStore();
 const player=applyLoadout({x:0,y:0,life:70,mana:58,maximumLife:70,maximumMana:58},newTownServices({starter:true}),p,mods,{refill:true});
 return {player,mods};
};
const testHit=(player,skill={},target={},mods=new ModifierStore())=>resolveAttackImpact({
 attacker:player,target:{life:500,maximumLife:500,evasion:0,defence:{},...target},
 modifiers:mods,skill:{source:'attack',baseDamage:{physical:20,cold:10,chaos:4},context:{tags:['attack','projectile','bow']},criticalChance:.9,...skill},
 rolls:{critical:.1,confirmation:.1,ignite:1,block:1}
});
test('all 2,321 canonical shared-tree nodes are present, linked, and every class has valid starts',()=>{
 assert.equal(nodes.size,2321);
 assert.equal(all.filter(n=>n.kind==='keystone').length,48);
 assert.equal(all.filter(n=>n.kind==='mastery').length,315);
 assert.equal(Object.keys(starts).length,7);
 for(const node of all){
  assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));
  for(const neighbor of node.neighbors)assert.ok(nodes.get(neighbor)?.neighbors.includes(node.id),''+node.id+' '+neighbor);
 }
 for(const [klass,start] of Object.entries(starts)){
  const p={...initial,passiveClass:klass};const tree=treeStatus(p);
  assert.equal(tree.start,start);
  assert.ok(all.some(n=>tree.availability(n.id).state==='available'));
  for(const n of all.filter(n=>n.key))assert.ok(tracePath(p,n.id).length>0,klass+' '+n.name);
 }
 assert.throws(()=>allocate(initial,starts.Witch),/其他職業/);
 assert.throws(()=>allocate(initial,23540),/尚未完整接入/);
});
test('masteries consume one point, require same-cluster notable, and a repeated effect is forbidden',()=>{
 const masteries=all.filter(n=>n.original==='Life Mastery'&&tracePath(initial,n.id).length);
 assert.ok(masteries.length>=2);
 const first=masteries[0],second=masteries[1];
 assert.throws(()=>allocate(initial,first.id,47642),/重要天賦/);
 let p=walk(initial,first.id);assert.throws(()=>allocate(p,first.id),/選擇/);
 const before=load(p).player.maximumLife; const allocated=allocate(p,first.id,47642);
 assert.ok(load(allocated).player.maximumLife>before);
 assert.equal(points(allocated).spent,points(p).spent+1);
 p=walk(allocated,second.id);
 assert.throws(()=>allocate(p,second.id,47642),/只能配置一次/);
 const next=allocate(p,second.id,31822);
 assert.equal(load(next).player.rules.lowLifeThreshold,.55);
});
test('projectile mastery changes actual projectile travel; cannot be picked on an empty group',()=>{
 const id=5826, p=walk(initial,id);assert.throws(()=>allocate(initial,id,1167),/重要天賦/);
 const fire=progression=>{
  const {player,mods}=load(progression);
  return rangerHooks({active:burningArrow,supports:[],modifiers:mods,random:()=>.4}).onFire(player,{x:4,y:0},0).projectiles[0];
 };
 const base=fire(p),after=fire(allocate(p,id,1167));
 assert.ok(Math.abs(after.speed/base.speed-1.15)<1e-9);
 assert.ok(after.remainingRange>base.remainingRange);
});
test('Blood Magic and Mind Over Matter change real resource settlement',()=>{
 const blood=load(pick(initial,57279)).player;
 assert.equal(blood.maximumMana,0);
 assert.equal(paySkillCost(blood,8).state.life,blood.life-8);
 assert.equal(paySkillCost({...blood,life:8},8).paid,false);
 const mind=load(pick(initial,34098)).player, damaged=applyDamage({...mind,energyShield:0},{physical:20},mind.rules).state;
 assert.equal(damaged.mana,mind.mana-8);
 assert.equal(damaged.life,mind.life-12);
});
test('Precise Technique checks accuracy against max life, suppresses crits, and applies only to attacks',()=>{
 const player={...load(pick(initial,63620)).player,maximumLife:100,accuracy:120};
 const physical={baseDamage:{physical:10}};
 const good=testHit(player,physical);assert.equal(good.hit.critical,false);assert.equal(good.damage.physical,14);
 assert.equal(testHit({...player,accuracy:100},physical).damage.physical,10);
 assert.equal(testHit(player,{...physical,source:'spell'}).damage.physical,10);
});
test('Resolute Technique guarantees hit without crit; Avatar of Fire removes all non-fire and CI is chaos immunity',()=>{
 const resolute=load(pick(initial,31961)).player, h=testHit({...resolute,accuracy:0},{},{evasion:50000});
 assert.equal(h.hit.hit,true);assert.equal(h.hit.critical,false);
 const fire=load(pick(initial,44941)).player, hit=testHit(fire,{criticalChance:0});
 assert.deepEqual(Object.entries(hit.damage).filter(([,amount])=>amount>0),[['fire',15]]);
 const ci=load(pick(initial,11455)).player;
 assert.equal(ci.maximumLife,1);assert.equal(applyDamage(ci,{chaos:80},ci.rules).state.life,1);
});
test('Ancestral Bond blocks the self attack and raises the live ballista cap by one',()=>{
 const {player,mods}=load(pick(initial,41970));
 const fake={id:'dummy',x:3,y:0,life:1000,maximumLife:1000,evasion:0,speed:0,defence:{}};
 const normal=rangerHooks({active:basicBowAttack,supports:[],modifiers:mods,random:()=>.4});
 let world={player,enemies:[fake],projectiles:[]};
 for(let i=0;i<12;i++)world=stepWorld(world,.02,normal);
 assert.equal(world.enemies[0].life,1000);
 const deployed=[],aim=fake,ballista={...basicBowAttack,id:'test-ballista',deploy:'totem'};
 const {onFire,onPulse,onImpact}=rangerHooks({modifiers:mods,inventory:new GemInventory(),random:()=>.4});
 const env={activeFields:f=>deployed.filter(f),addField:f=>deployed.push(f)};
 for(let i=0;i<3;i++)assert.equal(onFire(player,aim,i,[fake],env,{linked:{active:ballista,supports:[]}}).deferred,undefined);
 assert.equal(deployed.length,3);
 assert.equal(onFire(player,aim,3,[fake],env,{linked:{active:ballista,supports:[]}}).deferred,true);
 const spawned=[];onPulse(deployed[0],{player,enemies:[fake],spawn:p=>spawned.push(p)});
 assert.ok(spawned.length>0);assert.ok(onImpact(fake,spawned[0],3,player).life<fake.life);
});
test('minor attack-only armour costs and projectile passives do not silently affect spells',()=>{
 const m=new ModifierStore();
 m.replace('test',[{stat:'manaEfficiency',kind:'flat',value:.25,tags:['attack']},{stat:'criticalMultiplier',kind:'flat',value:.25,tags:['attack']}]);
 const b=weaponStats(crudeBow);
 const attack=compileAttack({...basicBowAttack,cost:10},b,[],m,()=>.5);
 const spell=compileAttack({tags:['spell','projectile'],baseSpellDamage:{fire:[10,10]},cost:10},b,[],m,()=>.5);
 assert.equal(attack.cost,8);assert.equal(spell.cost,10);assert.equal(attack.criticalMultiplier,1.75);assert.equal(spell.criticalMultiplier,1.5);
});
test('Elemental Overload tracks critical strike timing per skill and stops all extra critical hit damage',()=>{
 const {player,mods}=load(pick(initial,22088));
 const hooks=rangerHooks({modifiers:mods,active:burningArrow,supports:[],random:()=>.4});
 const gear=weaponStats(crudeBow);
 const make=(id,type)=>({skill:compileAttack({id,tags:['spell','projectile'],baseSpellDamage:{[type]:[10,10]}},gear,[],mods,()=>.5),rolls:{critical:0,confirmation:0,block:1,ignite:1}});
 const target={life:500,maximumLife:500,evasion:0,defence:{}};
 const baseline=hooks.onImpact(target,make('fire-one','fire'),1,player);
 const other=hooks.onImpact(target,make('fire-two','fire'),2,player);
 assert.ok(Math.abs(baseline.life-other.life)<1e-8);
 const boosted=hooks.onImpact(target,make('fire-one','fire'),2,player);
 assert.ok(Math.abs((500-boosted.life)/(500-baseline.life)-1.4)<1e-8);
 const expired=hooks.onImpact(target,make('fire-one','fire'),10.1,player);
 assert.ok(Math.abs(baseline.life-expired.life)<1e-8);
});
test('Elemental Equilibrium rewards alternating elements instead of applying exposure to the current element',()=>{
 const {player,mods}=load(pick(initial,39085));
 const hooks=rangerHooks({modifiers:mods,active:burningArrow,supports:[],random:()=>.4});
 const gear=weaponStats(crudeBow);
 const make=type=>({skill:compileAttack({id:type,tags:['spell','projectile'],baseSpellDamage:{[type]:[10,10]}},gear,[],mods,()=>.5),rolls:{critical:1,confirmation:1,block:1,ignite:1}});
 const target={life:500,maximumLife:500,evasion:0,defence:{resistances:{fire:.25,cold:.25,lightning:.25}}};
 const first=hooks.onImpact(target,make('fire'),1,player);
 assert.deepEqual(first.exposed,['cold','lightning']);
 const alternate=hooks.onImpact(first,make('cold'),2,player);
 assert.equal(alternate.life,first.life-10);
 assert.deepEqual(alternate.exposed,['fire','lightning']);
});
