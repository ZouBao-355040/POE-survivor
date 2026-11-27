import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHit} from './hit.mjs';
test('spell ignores evasion',()=>{const r=resolveHit({source:'spell',evasion:1e9,criticalChance:1,criticalRoll:0});assert.equal(r.hit,true);assert.equal(r.critical,true);});
test('attack critical confirmation can downgrade hit',()=>{const r=resolveHit({source:'attack',accuracy:100,evasion:1000,entropy:99,criticalChance:1,criticalRoll:0,confirmationRoll:.99});assert.equal(r.hit,true);assert.equal(r.critical,false);});
test('cannot evade bypasses accuracy',()=>{const r=resolveHit({source:'attack',cannotEvade:true,criticalChance:1,criticalRoll:0});assert.equal(r.hit,true);assert.equal(r.critical,true);});
