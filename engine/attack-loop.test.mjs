import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCombat} from './attack-loop.mjs';
import {ModifierStore} from './modifiers.mjs';
test('fallback and resumption',()=>{const a=advanceCombat({attacker:{life:100,mana:5,maximumMana:10,accuracy:1000},target:{life:1000,mana:0,evasion:0}},4,{skill:{id:'skill',cost:5,baseDamage:{physical:20},attacksPerSecond:1},basicAttack:{id:'basic',cost:0,baseDamage:{physical:10},attacksPerSecond:1},modifiers:new ModifierStore(),manaRegen:2,rolls:()=>({critical:.9,confirmation:.9,block:.9})});assert.deepEqual(a.events.map(x=>x.skill),['skill','basic','basic','skill']);assert.equal(a.target.life,940);assert.equal(a.attacker.mana,3);});
