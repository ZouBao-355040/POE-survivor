import test from 'node:test';import assert from 'node:assert/strict';import {ailmentTrigger as t} from './ailment-trigger.mjs';
test('critical fire hit ignites unless immune',()=>{const a={type:'ignite',damage:{fire:100},critical:true};assert.equal(t(a).applied,true);assert.equal(t({...a,immune:true}).applied,false);});
test('critical alone does not poison',()=>assert.equal(t({type:'poison',damage:{physical:100},critical:true}).applied,false));
test('avoidance and minimum effect prevent application',()=>{const a={type:'shock',damage:{lightning:100},critical:true};assert.equal(t({...a,avoidance:1}).applied,false);assert.equal(t({...a,minimumEffectMet:false}).applied,false);});
test('ordinary spell cannot bleed',()=>assert.equal(t({type:'bleed',source:'spell',damage:{physical:100},chance:1,roll:0}).applied,false));
