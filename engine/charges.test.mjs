import test from 'node:test';import assert from 'node:assert/strict';import {Charges,chargeEffects} from './charges.mjs';
test('gain at cap refreshes duration',()=>{const c=new Charges();c.gain('frenzy',0,3);c.gain('frenzy',9);assert.equal(c.snapshot(10).frenzy,3);assert.equal(c.snapshot(19).frenzy,0);});
test('minimum charges cannot be consumed',()=>{const c=new Charges();c.gain('power',0,2,{minimum:1});assert.equal(c.consume('power',1,3,{minimum:1}),false);assert.equal(c.consume('power',1,2,{minimum:1}),true);assert.equal(c.snapshot(20,{power:{minimum:1}}).power,1);});
test('charge types expire independently',()=>{const c=new Charges();c.gain('power',0);c.gain('endurance',5);assert.equal(c.snapshot(10).power,0);assert.equal(c.snapshot(10).endurance,1);});
test('frenzy more damage is additive per charge',()=>assert.equal(chargeEffects({frenzy:3}).moreDamage,1.12));
