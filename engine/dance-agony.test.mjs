import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveAttackImpact} from './combat.mjs';
import {hitChance} from './core.mjs';
import {stepWorld} from './game-loop.mjs';
import {rangerHooks} from './ranger.mjs';
import {ModifierStore} from './modifiers.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices} from './town-services.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {retryBeach} from './campaign.mjs';

const initial={characterClass:'Ranger',level:1,passivePoints:100};
const path=(state,end)=>tracePath(state,end).slice(1).reduce((s,id)=>allocate(s,id),state);
const player={x:0,y:0,life:70,maximumLife:100,maximumMana:40,mana:40,evasion:0,accuracy:500,defence:{}};
const target={id:'foe',x:.2,y:0,life:1000,maximumLife:1000,speed:0,defence:{},evasion:0};
const rolls={critical:0,confirmation:0,block:.4,ignite:0};
const m=new ModifierStore();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' ≠ '+b);
const skill={id:'test',source:'attack',baseDamage:{physical:10},criticalChance:0};

test('allocated Wind Dancer protects first attack, switches after a true hit, and ignores spells',()=>{
 const p=applyLoadout(player,newTownServices({starter:true}),path(initial,11239),m);
 assert.equal(p.rules.windDancer,true);
 const world={player:{...p,evasion:0,lifeRegen:0},enemies:[{...target,accuracy:1000,attack:{...skill,attacksPerSecond:1}}],projectiles:[]};
 const opts={enemyModifiers:new ModifierStore(),random:()=>.4};
 const first=stepWorld(world,.05,opts);
 near(first.player.life,62);near(first.player.lastAttackHit,.05);
 const staggered=stepWorld({...first,time:.95,enemies:[{...first.enemies[0],attackCooldown:.03}]},.05,opts);
 near(staggered.player.life,50);
 const onlySpell=stepWorld({...staggered,enemies:[],enemyCasts:[{x:0,y:0,radius:1,damage:10,element:'fire',impactAt:2}],time:2},.05,opts);
 near(onlySpell.player.life,40);near(onlySpell.player.lastAttackHit,1);
 const reset=stepWorld({...staggered,time:4.95,enemies:[{...staggered.enemies[0],attackCooldown:.04}]},.05,opts);
 near(reset.player.life,42);
 const retry=retryBeach({...staggered,zone:'beach',dead:true});
 assert.equal(retry.player.lastAttackHit,undefined);
});

test('Wind Dancer applies more chance to evade, honors attack confirmation and counts blocked but not avoided hits',()=>{
 const attack=(state,combatTime,overrides={})=>resolveAttackImpact({attacker:{accuracy:100,...overrides.attacker},target:state,skill:overrides.skill??skill,modifiers:m,rolls:{...rolls,...overrides.rolls},combatTime});
 const p={...player,evasion:500,rules:{windDancer:true},entropy:99};
 const unprimed=attack(p,0);
 const primed=attack({...p,lastAttackHit:0},1);
 const base=hitChance(100,500);
 near(unprimed.hit.chance,base);near(primed.hit.chance,1-(1-base)*1.1);
 const blocked=attack({...p,defence:{attackBlock:.75}},2);
 assert.equal(blocked.mitigation.blocked,true);near(blocked.target.life,p.life);near(blocked.target.lastAttackHit,2);
 const glancing=attack({...p,defence:{attackBlock:.75,blockedDamageFraction:.65}},2);
 near(glancing.target.life,p.life-5.2);near(glancing.target.lastAttackHit,2);
 const miss=attack({...p,entropy:0,lastAttackHit:0},2,{attacker:{accuracy:0}});
 assert.equal(miss.hit.hit,false);assert.equal(miss.target.lastAttackHit,0);
 const sure=attack({...p,lastAttackHit:0},1,{attacker:{rules:{resolute:true}}});
 assert.equal(sure.hit.chance,1);
});

test('Perfect Agony redirects the real crit multiplier to damaging ailments without boosting hits',()=>{
 const mods=new ModifierStore();
 const p=applyLoadout(player,newTownServices({starter:true}),path(initial,23407),mods);
 assert.equal(p.rules.perfectAgony,true);
 mods.replace('test-dot',[{stat:'dotMultiplier',value:1,kind:'flat'}]);
 const tagged={...skill,criticalChance:1,criticalMultiplier:2.5,baseDamage:{fire:10,physical:10},active:{tags:[],bleed:true,poisonChance:1}};
 const rng=rangerHooks({modifiers:mods,random:()=>0});
 const fire=(p,skill=tagged,targetState=target)=>rng.onImpact(targetState,{skill,rolls,attacker:{}},0,p);
 const regular=fire({...p,rules:{}});
 const agony=fire(p);
 near(regular.life,950);near(agony.life,980);
 near(agony.ignites[0].rate,22.5); // 10 * .9 * 2.5, ignoring the ordinary DoT bonus.
 near(agony.dots.find(d=>d.key==='bleed').rate,22.75);
 near(agony.dots.find(d=>d.key==='poison').rate,7.5);
 const unique=fire({...p,rules:{perfectAgony:true,criticalUnique:.25}},tagged,{...target,boss:true,defence:{reducedCritExtra:.3}});
 near(unique.ignites[0].rate,24.75);near(unique.life,980);
 const noAilments=(attacker,cast)=>{const t=fire(attacker,cast);assert.equal(t.ignites.length,0);assert.ok(!t.dots?.length);};
 noAilments(p,{...tagged,criticalChance:0,igniteChance:1});
 noAilments({...p,rules:{perfectAgony:true,elementalOverload:true}},tagged);
 noAilments({...p,rules:{perfectAgony:true,precise:true}},tagged);
});

test('Perfect Agony gates hit freeze/shock, but not independent debuffs or native skill DoT',()=>{
 const active={tags:['projectile'],freezeChance:1,guaranteedShock:true,drain:true,baseDot:10,duration:3,ensnare:true};
 const spell={...skill,source:'spell',baseDamage:{cold:10,lightning:10,chaos:10},active,criticalChance:0};
 const hooks=rangerHooks({modifiers:m,random:()=>0});
 const shoot=criticalChance=>hooks.onImpact(target,{skill:{...spell,criticalChance,damageMultiplier:1},rolls,attacker:{}},1,{...player,rules:{perfectAgony:true}});
 const plain=shoot(0),critical=shoot(1);
 assert.equal(plain.frozenUntil,undefined);assert.equal(plain.shockedUntil,undefined);
 assert.ok(critical.frozenUntil>1);assert.ok(critical.shockedUntil>1);
 assert.equal(plain.ensnaredUntil,2.5);assert.equal(plain.dots[0].rate,critical.dots[0].rate);
 const env={time:1,enemies:[target],player:{...player,rules:{perfectAgony:true}}};
 hooks.onPulse({x:0,y:0,skill:{...spell,active:{...active,sourceKey:'test'}},type:'cold'},env);
 assert.ok(env.enemies[0].chilledUntil>1);
 const minion=hooks.onImpact(target,{skill:{...spell,damageMultiplier:1},rolls,leechProxy:'minion'},1,{...player,rules:{perfectAgony:true}});
 assert.ok(minion.frozenUntil>1);
});
