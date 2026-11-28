import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,nodes,tracePath} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {rangerHooks} from './ranger.mjs';
import {stepWorld} from './game-loop.mjs';
import {compileAttack} from './skill.mjs';
import {basicBowAttack,crudeBow} from './starter-data.mjs';
import {weaponStats} from './weapon.mjs';

const start={characterClass:'Ranger',passivePoints:13};
const path=tracePath(start,49459);
const prefix=path.slice(1,-4).reduce((p,id)=>allocate(p,id),start);
const junior=path.slice(-4,-1).reduce((p,id)=>allocate(p,id),prefix);
const senior=allocate(junior,49459);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const target={id:'fixture',x:2,y:0,radius:.42,speed:0,life:1000,maximumLife:1000,evasion:0,defence:{}};

function setup(p,active=basicBowAttack,supports=[],random=()=>.1){
 const modifiers=new ModifierStore();
 const player=applyLoadout({x:0,y:0,life:70,mana:58,attackRange:12},newTownServices({starter:true}),p,modifiers,{refill:true});
 const hooks=rangerHooks({modifiers,active,supports,random});
 return {modifiers,player,hooks};
}
function fight(p,random){
 const {player,hooks}=setup(p,basicBowAttack,[],random);
 let state={player,enemies:[target],projectiles:[],time:0};
 for(let i=0;i<20;i++)state=stepWorld(state,.02,hooks);
 return target.life-state.enemies[0].life;
}

test('King of the Hill opens on a legal 13-point route and its bow crit changes actual ordinary arrow damage',()=>{
 assert.equal(path.length-1,13);
 assert.deepEqual(path.slice(-4),[55750,12948,32514,49459]);
 assert.ok(path.slice(-4).every(id=>nodes.get(id).implemented));
 const skill=p=>compileAttack(basicBowAttack,weaponStats(crudeBow),[],setup(p).modifiers,()=>.4);
 near(skill(prefix).criticalChance,.05);
 near(skill(junior).criticalChance,.077);
 near(skill(senior).criticalChance,.127);
 near(skill(senior).criticalMultiplier,1.86);
 near(fight(senior,()=>.10)/fight(junior,()=>.10),1.86);
 near(fight(junior,()=>.03)/fight(prefix,()=>.03),1.86/1.5);
 near(fight(senior,()=>.4),fight(prefix,()=>.4));
});

test('bow nodes do not affect wand attacks, spells, or the recruited Phantasm’s own critical profile',()=>{
 const get=(p,active,weapon)=>compileAttack(active,weaponStats(weapon),[],setup(p).modifiers,()=>.4);
 for(const [active,weapon] of [
  [{...basicBowAttack,tags:['attack','projectile','wand']},{...crudeBow,criticalChance:.07}],
  [{id:'spell',tags:['spell','projectile'],baseSpellDamage:{physical:[5,10]}},crudeBow]
 ]){
  near(get(senior,active,weapon).criticalChance,get(prefix,active,weapon).criticalChance);
  near(get(senior,active,weapon).criticalMultiplier,get(prefix,active,weapon).criticalMultiplier);
 }
 const summoned=(p)=>{
  let random=.10;
  const {player,hooks}=setup(p,basicBowAttack,[{id:'summon-phantasm',phantasm:true}],()=>random);
  const shot=hooks.onFire(player,target,0).projectiles[0];
  let field;
  hooks.onHitEffect(shot,{...target,life:0},{player,time:1,addField:f=>{field=f;}});
  assert.equal(field.deploy,'phantasm');
  random=.12;
  const [bolt]=field.mk(field,{...target,x:4});
  assert.equal(bolt.skill.context.tags.includes('bow'),false);
  near(bolt.skill.criticalChance,.05);
  near(bolt.skill.criticalMultiplier,1.5);
  near(bolt.rolls.critical,.12);
  return hooks.onImpact(target,bolt,1.1,player).life;
 };
 near(summoned(senior),summoned(prefix));
 assert.ok(summoned(senior)<target.life);
});
