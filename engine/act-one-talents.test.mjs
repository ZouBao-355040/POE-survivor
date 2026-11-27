import test from 'node:test';
import assert from 'node:assert/strict';
import {rangerTalents,talentPoints,talentAvailability,allocateTalent,talentBonuses,talentModifiers,applyTalentStats,talentEffects} from './act-one-talents.mjs';
import {ModifierStore} from './modifiers.mjs';
import {resolveAttackImpact} from './combat.mjs';
import {rangerHooks} from './ranger.mjs';
import {gemById} from './projectile-catalog.mjs';

const path=(idList,progression={level:15,passivePoints:14})=>idList.reduce((result,id)=>allocateTalent(result,id),progression);
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
test('official starter graph has two entrances and bidirectional, reachable edges',()=>{
 const byId=new Map(rangerTalents.map(n=>[n.id,n]));
 assert.equal(byId.size,29);
 assert.deepEqual(rangerTalents.filter(n=>n.neighbors.includes('50459')).map(n=>n.id),['45035','39821']);
 for(const n of rangerTalents)for(const id of n.neighbors.filter(id=>id!=='50459')) assert.ok(byId.get(id)?.neighbors.includes(n.id),`${n.id} ↔ ${id}`);
 let state={passivePoints:29};
 for(let step=0;step<29;step++){
  const next=rangerTalents.find(t=>talentAvailability(state,t.id).available);
  assert.ok(next);
  state=allocateTalent(state,next.id);
 }
 assert.equal(talentPoints(state).remaining,0);
 assert.ok(rangerTalents.every(t=>talentEffects(t).length>0));
});
test('allocation is immutable, requires a link, and cannot overspend, duplicate, or invent IDs',()=>{
 const before=Object.freeze({level:2,passivePoints:1,talents:Object.freeze([])});
 assert.throws(()=>allocateTalent(before,'50338'),/連接/);
 assert.throws(()=>allocateTalent(before,'bogus'),/未知/);
 const next=allocateTalent(before,'39821');
 assert.deepEqual(before.talents,[]);
 assert.deepEqual(talentPoints(next),{earned:1,spent:1,remaining:0});
 assert.throws(()=>allocateTalent(next,'45035'),/沒有可用/);
 assert.throws(()=>allocateTalent(next,'39821'),/已配置/);
 // Levels add points; allocations do not overwrite total earned points.
 assert.deepEqual(talentPoints({...next,level:4,passivePoints:3}),{earned:3,spent:1,remaining:2});
 assert.deepEqual(talentPoints({passivePoints:2,talents:['39821','39821','fake']}),{earned:2,spent:1,remaining:1});
});
test('life, evasion, dexterity accuracy and movement alter the actual player numbers',()=>{
 const progression=path(['39821','2094','52904','444','61306','60942','32555','22266','9786','33558']);
 const bonuses=talentBonuses(progression);
 assert.equal(bonuses.life,14);
 assert.equal(bonuses.dexterity,60);
 assert.equal(bonuses.accuracy,120);
 close(bonuses.speed,.06);
 const player=applyTalentStats({maximumLife:100,accuracy:90,evasion:15,speed:4},progression);
 assert.equal(player.maximumLife,120);
 assert.equal(player.accuracy,210);
 assert.equal(player.evasion,90);
 close(player.speed,4.24);
});
test('projectile talents change spell projectile hits and projectile speed but not nonprojectile spells',()=>{
 const progression=path(['45035','465','65033','10017','38344','50338']);
 const base=new ModifierStore(),modified=new ModifierStore();
 modified.replace('talent',talentModifiers(progression));
 const rolls={critical:1,confirmation:1,block:1,ignite:1};
 const attacker={accuracy:200,mana:80};const target={life:100,maximumLife:100,evasion:0};
 const hit=(store,tags)=>resolveAttackImpact({attacker,target,rolls,modifiers:store,
  skill:{source:'spell',baseDamage:{physical:10},context:{tags},criticalChance:0}}).target.life;
 assert.equal(hit(base,['spell','projectile']),90);
 close(hit(modified,['spell','projectile']),85.4);
 assert.equal(hit(modified,['spell']),90);
 const getArrow=modifiers=>rangerHooks({modifiers,active:gemById.get('burning-arrow'),supports:[],random:()=>.4})
  .onFire({x:0,y:0,accuracy:100,mana:80,maximumMana:80}, {x:8,y:0}, 0);
 const normal=getArrow(base),enhanced=getArrow(modified);
 close(enhanced.projectile.speed,normal.projectile.speed*1.20);
 assert.ok(enhanced.cooldown<normal.cooldown);
});
