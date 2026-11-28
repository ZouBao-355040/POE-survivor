import test from 'node:test';
import assert from 'node:assert/strict';
import {ModifierStore} from './modifiers.mjs';
import {stepWorld} from './game-loop.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {allocate,tracePath} from './passive-tree.mjs';
import {newTownServices} from './town-services.mjs';

const initial={characterClass:'Ranger',level:35,passivePoints:34};
const town=newTownServices({starter:true});
const take=(state,id)=>tracePath(state,id).slice(1).reduce((p,n)=>allocate(p,n),state);
const load=p=>applyLoadout({x:0,y:0,life:100,mana:10,defence:{}},town,p,new ModifierStore());
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' ≠ '+b);

test('canonical Ranger path grants real spell block, not attack block, and Mystic Bulwark scales mana regeneration',()=>{
 const earlier=take(initial,50826),later=take(earlier,18174);
 assert.ok(earlier.talents.includes('50826'));
 assert.ok(later.talents.includes('18174'));
 const small=load(earlier),notable=load(later);
 near(small.defence.spellBlock,.02);
 near(notable.defence.spellBlock,.08);
 near(notable.defence.attackBlock,0);
 near(notable.manaRegenMultiplier-small.manaRegenMultiplier,.08);
 const hit=(player,roll)=>stepWorld({player,enemies:[],projectiles:[],time:2,
  enemyCasts:[{x:0,y:0,radius:1,damage:10,element:'fire',impactAt:2}]},.05,{
   enemyModifiers:new ModifierStore(),random:()=>roll,manaRegen:2.85*player.manaRegenMultiplier
  });
 const blocked=hit(notable,.07),notBlocked=hit(small,.07);
 assert.equal(blocked.events.find(e=>e.type==='enemyAttack')?.blocked,true);
 assert.equal(notBlocked.events.find(e=>e.type==='enemyAttack')?.blocked,false);
 assert.equal(blocked.player.life,notable.life);
 assert.ok(notBlocked.player.life<small.life);
 near(blocked.player.mana-notBlocked.player.mana,2.85*.08*.05);
});
