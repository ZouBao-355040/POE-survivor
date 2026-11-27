import test from 'node:test';
import assert from 'node:assert/strict';
import {Character} from './character.mjs';
test('level one ranger baseline',()=>{const c=new Character();const s=c.snapshot();assert.equal(s.maximumLife,57);assert.equal(s.maximumMana,47);assert.equal(s.dexterity,32);assert.equal(s.energyShield,0);});
test('level growth',()=>{const c=new Character('Ranger',2);assert.equal(c.snapshot().maximumLife,69);assert.equal(c.snapshot().maximumMana,53);});
test('attribute and life modifiers recompute on removal',()=>{const c=new Character();c.modifiers.replace('gear',[{stat:'strength',kind:'flat',value:20},{stat:'maximumLife',kind:'increased',value:.2}]);assert.equal(c.snapshot().maximumLife,80);c.modifiers.remove('gear');assert.equal(c.snapshot().maximumLife,57);});
