import test from 'node:test';
import assert from 'node:assert/strict';
import {poisonApplication} from './poison.mjs';
import {allocate,tracePath,nodes} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {rangerHooks} from './ranger.mjs';
import {newTownServices} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {stepWorld} from './game-loop.mjs';

const base={characterClass:'Ranger',level:32,passivePoints:31};
const path=(p,id)=>{
 const route=tracePath(p,id);
 assert.equal(route.at(-1),id);
 return route.slice(1).reduce((state,n)=>allocate(state,n),p);
};
const enemy={id:'enemy',x:1,y:0,radius:.34,speed:0,evasion:0,life:200,maximumLife:200,defence:{chaosResistance:0}};
const shot=(source='attack',proxy,active={})=>({x:0,y:0,dx:1,dy:0,speed:80,remainingRange:10,leechProxy:proxy,attacker:{},
 skill:{id:'test-poison',source,active:{tags:['projectile'],...active},baseDamage:{physical:30,chaos:10},context:{tags:[source,'projectile',...(source==='attack'?['bow']:[])]}},
 rolls:{block:.4,critical:.8,confirmation:.8,ignite:.8}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);

test('regular physical bow attacks gain poison with the real Ranger passive, spells require their own chance',()=>{
 const town=newTownServices({starter:true}),mods=new ModifierStore();
 const load=p=>({...applyLoadout({life:70,mana:58,energyShield:0},town,p,mods,{refill:true}),x:0,y:0,accuracy:300});
 const hit=(p,s,roll)=>stepWorld({player:p,enemies:[enemy],projectiles:[s],time:0},.05,rangerHooks({modifiers:mods,random:()=>roll}));
 assert.equal(hit(load(base),shot(),.01).enemies[0].dots.length,0);
 const attack=path(base,64769),p=load(attack);
 near(hit(p,shot(),.14).enemies[0].dots[0].rate,12);
 assert.equal(hit(p,shot(),.16).enemies[0].dots.length,0);
 assert.equal(hit(p,shot('spell'),.01).enemies[0].dots.length,0);
 assert.equal(hit(p,shot('attack','minion'),.01).enemies[0].dots.length,0);
 const spell=load(path(base,5018));
 assert.ok(hit(spell,shot('spell'),.01).enemies[0].dots.length>0);
});

test('poison tick damage and duration scale independently; repeated hits stack and expire separately',()=>{
 const mods=new ModifierStore();
 mods.replace('fixture',[
  {stat:'poisonDuration',kind:'increased',value:.2},{stat:'poisonDotMultiplier',kind:'flat',value:.3},
  {stat:'poisonDamage',kind:'increased',value:.4},{stat:'chaosDamage',kind:'increased',value:.2},
  {stat:'damage',kind:'increased',value:4,tags:['hit']},
  {stat:'damage',kind:'increased',value:3,tags:['projectile']},
  {stat:'damage',kind:'increased',value:.1,tags:['bow']},
 ]);
 const skill=shot().skill;skill.active.poisonChance=1;
 const args={result:{hit:{hit:true},canInflictHitAilments:true,ailmentBase:{physical:30,chaos:10,fire:200}},skill,player:{},modifiers:mods,time:0,random:()=>.5};
 const a=poisonApplication(args),b=poisonApplication({...args,time:1});
 near(a.rate,12*1.7*1.3);near(a.end,2.4);near(b.end,3.4);
 const tick=(time)=>stepWorld({time,player:{x:0,y:0,life:40,mana:20,maximumMana:20},enemies:[{...enemy,dots:[a,b]}],projectiles:[]},.05).enemies[0].life;
 near(tick(1.5),200-.05*(a.rate+b.rate));
 near(tick(2.5),200-.05*b.rate);
 assert.equal(poisonApplication({...args,result:{...args.result,ailmentBase:{fire:200}}}),null);
 assert.equal(poisonApplication({...args,result:{...args.result,mitigation:{blocked:true}}}),null);
 assert.ok(nodes.get(31359).implemented);
});
