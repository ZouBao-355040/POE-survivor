import test from 'node:test';import assert from 'node:assert/strict';import {applyDamage,recover,mindOverMatterFraction} from './resources.mjs';
const s={life:1000,mana:100,energyShield:500,maximumMana:200};
const rules={eldritchBattery:true,damageTakenFromManaBeforeLife:mindOverMatterFraction};
test('EB shields redirected non-chaos damage',()=>{const r=applyDamage(s,{fire:1000},rules);assert.equal(r.state.energyShield,100);assert.equal(r.state.life,400);assert.equal(r.rechargeInterrupted,true);});
test('chaos bypasses EB and unpaid mana spills to life',()=>{const r=applyDamage(s,{chaos:1000},rules);assert.equal(r.state.energyShield,500);assert.equal(r.state.life,100);});
test('recovery cannot exceed unreserved mana',()=>assert.equal(recover({...s,reservedMana:80},'mana',100).mana,120));
