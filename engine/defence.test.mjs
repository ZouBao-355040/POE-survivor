import test from 'node:test';import assert from 'node:assert/strict';import {blockStats,mitigateHit,shiftTaken} from './defence.mjs';
test('armour and resistance apply after damage shift',()=>{const r=mitigateHit({source:'attack',damage:{physical:200},defender:{armour:500,resistances:{fire:.75},takenAs:[{from:'physical',to:'fire',fraction:.5}]}});assert.equal(r.damage.physical,50);assert.equal(r.damage.fire,25);assert.equal(r.total,75);});
test('taken as does not chain',()=>{const r=shiftTaken({physical:100},[{from:'physical',to:'fire',fraction:1},{from:'fire',to:'cold',fraction:1}]);assert.equal(r.fire,100);assert.equal(r.cold,0);});
test('ordinary block prevents hit damage',()=>{assert.equal(mitigateHit({source:'attack',damage:{fire:100},defender:{attackBlock:.75},blockRoll:0}).total,0);});
test('spell suppression halves ordinary damage',()=>{assert.equal(mitigateHit({source:'spell',damage:{fire:100},defender:{suppressionChance:1},suppressRoll:0}).total,50);});

test('attack and spell block respect separate caps; a glancing block still takes 65% of the hit',()=>{
 const defender={attackBlock:1,spellBlock:1,maximumAttackBlock:.65,maximumSpellBlock:.79,blockedDamageFraction:.65};
 const hit=source=>mitigateHit({source,defender,damage:{fire:100},blockRoll:.7});
 assert.equal(hit('attack').total,100);
 assert.equal(hit('attack').blocked,false);
 assert.equal(hit('spell').total,65);
 assert.equal(hit('spell').blocked,true);
});

test('overcapped attack chance adds to base spell block before Glancing Blows multiplies it',()=>{
 const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,actual+' ≠ '+expected);
 const basic=blockStats({attack:.75,versatile:true});
 near(basic.attackBlock,.65);near(basic.spellBlock,.20);
 const combo=blockStats({attack:.37,spell:.05,glancing:true,versatile:true,attackMaxBonus:.02,spellMaxBonus:.04});
 near(combo.maximumAttackBlock,.67);near(combo.maximumSpellBlock,.69);
 near(combo.attackBlockExcess,.07);near(combo.spellBlock,.38);
 near(combo.blockedDamageFraction,.65);
 near(blockStats({attack:.26,glancing:true,versatile:true}).spellBlock,0);
});
