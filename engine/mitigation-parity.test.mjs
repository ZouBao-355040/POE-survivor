import test from 'node:test';import assert from 'node:assert/strict';import {mitigateHit} from './defence.mjs';import {mitigateDot} from './dot.mjs';
const defender={resistances:{fire:.75},additionalElementalReduction:.12,hitTakenMultipliers:[.8]};
test('resistance penetration does not penetrate elemental reduction',()=>assert.ok(Math.abs(mitigateHit({damage:{fire:1000},source:'attack',defender,penetration:{fire:.2}}).total-316.8)<1e-9));
test('elemental reduction applies to DoT but hit multipliers do not',()=>assert.equal(mitigateDot({fire:1000},defender).fire,220));
