import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatEvents} from './events.mjs';
test('recent events use simulation time and actor identity',()=>{const e=new CombatEvents();e.emit('kill','a');e.advance(3.9);assert.equal(e.recently('a','kill'),true);assert.equal(e.recently('b','kill'),false);e.pause();e.advance(100);assert.equal(e.recently('a','kill'),true);e.pause(false);e.advance(.2);assert.equal(e.recently('a','kill'),false);});
test('life thresholds and movement',()=>{const e=new CombatEvents();const c=e.conditions('a',{life:50,maximumLife:100,moving:true});assert.equal(c.lowLife,true);assert.equal(c.fullLife,false);assert.equal(c.stationary,false);});
test('event subscriptions can be removed',()=>{const e=new CombatEvents();let n=0;const off=e.on('hit',()=>n++);e.emit('hit','a');off();e.emit('hit','a');assert.equal(n,1);});
