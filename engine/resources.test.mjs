import test from 'node:test';import assert from 'node:assert/strict';import {applyDamage,payManaCost} from './resources.mjs';
const state={life:100,mana:50,energyShield:40};
test('chaos bypasses ordinary shield',()=>{assert.deepEqual(applyDamage(state,{fire:30,chaos:20}).state,{life:80,mana:50,energyShield:10});});
test('mana absorbs portion before life',()=>{assert.deepEqual(applyDamage({...state,energyShield:0},{fire:100},{damageTakenFromManaBeforeLife:.4}).state,{life:40,mana:10,energyShield:0});});
test('EB pays mana costs from shield first',()=>{assert.deepEqual(payManaCost(state,60,{eldritchBattery:true}).state,{life:100,mana:30,energyShield:0});});
test('unpaid mana damage spills into life',()=>{assert.equal(applyDamage({life:100,mana:10,energyShield:0},{fire:100},{damageTakenFromManaBeforeLife:.4}).state.life,10);});
