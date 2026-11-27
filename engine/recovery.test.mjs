import test from 'node:test';import assert from 'node:assert/strict';import {LeechPool,rechargeShield} from './recovery.mjs';
test('individual leech amount cap and rate',()=>{const p=new LeechPool();p.add(10000,1,1000);assert.equal(p.advance(1,0,1000),20);assert.equal(p.advance(4,20,1000),100);assert.equal(p.instances.length,0);});
test('stacked leech respects total rate cap',()=>{const p=new LeechPool();for(let i=0;i<20;i++)p.add(1000,1,1000);assert.equal(p.advance(1,0,1000),200);});
test('ordinary leech removed at full',()=>{const p=new LeechPool();p.add(1000,1,1000);assert.equal(p.advance(1,990,1000),1000);assert.equal(p.instances.length,0);});
test('recharge delay crossing',()=>{assert.ok(Math.abs(rechargeShield(0,100,2.5,1)-100/6)<1e-9);});
