import test from 'node:test';
import assert from 'node:assert/strict';
import {attack} from './combat.mjs';
import {ModifierStore} from './modifiers.mjs';
const input=()=>({attacker:{mana:20,life:100,accuracy:1000},target:{life:100,mana:0,energyShield:0,evasion:0},skill:{cost:5,baseDamage:{physical:40}},modifiers:new ModifierStore(),rolls:{critical:.9,confirmation:.9,block:.9}});
test('attack spends mana and damages target',()=>{const a=attack(input());assert.equal(a.attacker.mana,15);assert.equal(a.target.life,60);});
test('insufficient mana prevents attack',()=>{const i=input();i.attacker.mana=2;assert.equal(attack(i).performed,false);});
test('lethal attack marks target dead',()=>{const i=input();i.target.life=30;assert.equal(attack(i).dead,true);});
