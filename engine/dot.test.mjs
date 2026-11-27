import test from 'node:test';import assert from 'node:assert/strict';import {mitigateDot,dotRate,integrateDot} from './dot.mjs';
test('physical DoT ignores armour but respects physical reduction',()=>assert.equal(mitigateDot({physical:100},{armour:100000,additionalPhysicalReduction:.2}).physical,80));
test('fire DoT respects resistance but ignores hit defences',()=>assert.equal(mitigateDot({fire:100},{resistances:{fire:.75},spellBlock:1,suppressionChance:1}).fire,25));
test('DoT multiplier is separate from increased',()=>assert.ok(Math.abs(dotRate(100,{increased:.5,dotMultiplier:.2,more:[1.1]})-198)<1e-9));
test('integration stops at expiration',()=>assert.equal(integrateDot([{type:'chaos',rate:100,start:0,end:2}],1.5,3).chaos,50));
