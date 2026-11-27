import test from 'node:test';
import assert from 'node:assert/strict';
import {ModifierStore} from './modifiers.mjs';
test('additive increased and multiplicative more',()=>{
 const s=new ModifierStore();
 s.replace('tree',[{stat:'attackSpeed',kind:'increased',value:.2}]);
 s.replace('gloves',[{stat:'attackSpeed',kind:'increased',value:.15}]);
 s.replace('support',[{stat:'attackSpeed',kind:'more',value:.25}]);
 assert.ok(Math.abs(s.calculate(1.5,'attackSpeed')-2.53125)<1e-10);
 s.remove('support');assert.ok(Math.abs(s.calculate(1.5,'attackSpeed')-2.025)<1e-10);
});
test('scope and conditions',()=>{
 const s=new ModifierStore();
 s.replace('tree',[{stat:'damage',kind:'increased',value:.5,tags:['attack'],conditions:{moving:true}}]);
 assert.equal(s.calculate(100,'damage'),100);
 assert.equal(s.calculate(100,'damage',{tags:['attack'],conditions:{moving:true}}),150);
 assert.equal(s.calculate(100,'damage',{tags:['spell'],conditions:{moving:true}}),100);
});
test('generic and specific increases combine',()=>{
 const s=new ModifierStore();
 s.replace('tree',[{stat:'damage',kind:'increased',value:.2},{stat:'projectileDamage',kind:'increased',value:.3}]);
 assert.equal(s.calculate(100,['damage','projectileDamage']),150);
});
