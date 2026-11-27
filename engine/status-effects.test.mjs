import test from 'node:test';import assert from 'node:assert/strict';import {statusModifiers as s} from './status-effects.mjs';
test('rage produces attack-specific more damage',()=>assert.deepEqual(s('rage',{stacks:30}),[{stat:'attackDamage',kind:'more',value:.3}]));
test('fortification reduces hit damage only',()=>assert.deepEqual(s('fortification',{stacks:20}),[{stat:'hitDamageTaken',kind:'more',value:-.2}]));
test('exposure targets one element',()=>assert.deepEqual(s('exposure',{element:'fire',exposure:.15}),[{stat:'fireResistance',kind:'flat',value:-.15}]));
