import test from 'node:test';import assert from 'node:assert/strict';import {mitigateHit,shiftTaken} from './defence.mjs';
test('armour and resistance apply after damage shift',()=>{const r=mitigateHit({source:'attack',damage:{physical:200},defender:{armour:500,resistances:{fire:.75},takenAs:[{from:'physical',to:'fire',fraction:.5}]}});assert.equal(r.damage.physical,50);assert.equal(r.damage.fire,25);assert.equal(r.total,75);});
test('taken as does not chain',()=>{const r=shiftTaken({physical:100},[{from:'physical',to:'fire',fraction:1},{from:'fire',to:'cold',fraction:1}]);assert.equal(r.fire,100);assert.equal(r.cold,0);});
test('ordinary block prevents hit damage',()=>{assert.equal(mitigateHit({source:'attack',damage:{fire:100},defender:{attackBlock:.75},blockRoll:0}).total,0);});
test('spell suppression halves ordinary damage',()=>{assert.equal(mitigateHit({source:'spell',damage:{fire:100},defender:{suppressionChance:1},suppressRoll:0}).total,50);});
