import test from 'node:test';import assert from 'node:assert/strict';import {reserve,reservationCost,eventRecovery} from './reservation.mjs';import {ModifierStore} from './modifiers.mjs';
const s={life:100,maximumLife:100,mana:100,maximumMana:100,energyShield:0,maximumEnergyShield:0};
test('reservation efficiency divides cost',()=>assert.equal(reservationCost(100,{fraction:.5,efficiency:.25}),40));
test('reservation preserves maximum resource',()=>{const r=reserve(s,[{resource:'mana',fraction:.5}]);assert.equal(r.state.maximumMana,100);assert.equal(r.state.mana,50);});
test('cannot reserve all life',()=>assert.equal(reserve(s,[{resource:'life',fraction:1}]).accepted,false));
test('on hit recovery respects reserved cap',()=>{const m=new ModifierStore();m.replace('gear',[{stat:'manaOnHit',kind:'flat',value:20}]);assert.equal(eventRecovery({...s,mana:40,reservedMana:50},m,'hit').mana,50);});
