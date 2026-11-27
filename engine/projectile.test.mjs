import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceProjectile,stepProjectiles} from './projectile.mjs';
import {stepWorld} from './game-loop.mjs';
const p={x:0,y:0,dx:1,dy:0,speed:100,remainingRange:10};
const e=(id,x,y=0)=>({id,x,y,life:20,radius:.1});
const run=(shot,enemies,settings={})=>{
 const hits=[],ends=[];
 const shots=stepProjectiles([shot],.05,{enemies,player:{x:0,y:0},impact:(enemy,projectile)=>hits.push([enemy.id,projectile.returning??false]),terminate:q=>{ends.push(q);return [];},...settings});
 return {hits,shots,ends};
};
test('swept collisions choose first target and pierce with remaining time',()=>{
 const a=e('first',1),b=e('second',3);
 assert.equal(advanceProjectile(p,.05,[b,a]).hitId,'first');
 const r=run({...p,pierce:1},[b,a]);
 assert.deepEqual(r.hits.map(h=>h[0]),['first','second']);
 assert.ok(Math.abs(r.ends[0].distanceTravelled-2.9)<1e-8);
});
test('fork replaces chain at collision, with conserved remaining time',()=>{
 const r=run({...p,fork:1,chain:2},[e('a',2)]);
 assert.equal(r.shots.length,2);
 assert.ok(r.shots.every(q=>q.fork===0&&q.chain===2&&q.x>4));
 assert.ok(r.shots[0].dy<0&&r.shots[1].dy>0);
});
test('split takes priority over pierce; children keep pierce budget',()=>{
 const r=run({...p,pierce:1,split:2},[e('a',1),e('b',8,1),e('c',8,-1)].map(x=>x.id==='a'?x:{...x,x:6}));
 assert.equal(r.shots.length,2);
 assert.ok(r.shots.every(q=>q.split===0&&q.pierce===1));
});
test('chain seeks a living new target and does not replenish flight distance',()=>{
 const r=run({...p,chain:1},[e('a',1),e('b',2,2),e('far',9)]);
 assert.deepEqual(r.hits.map(h=>h[0]),['a','b']);
 assert.ok(r.ends[0].remainingRange>6);
});
test('return has independent hit history, pierces, and follows current player position',()=>{
 const r=run({...p,canReturn:true,pierce:1},[e('a',1),e('b',3)]);
 assert.deepEqual(r.hits,[['a',false],['b',false],['a',true]]);
 assert.equal(r.shots.length,1);
 const next=stepProjectiles(r.shots,.05,{enemies:[],player:{x:0,y:3}});
 assert.equal(next.length,0);
});
test('scheduled shots wait without spending their flight distance',()=>{
 const r=run({...p,delay:.03},[]);
 assert.ok(Math.abs(r.shots[0].x-2)<1e-8);
 assert.ok(Math.abs(r.shots[0].remainingRange-8)<1e-8);
});
test('world pause freezes elapsed time, enemies, mana, and queued projectiles',()=>{
 const state={paused:true,time:8,player:{x:0,y:0,speed:4,mana:5,maximumMana:10},enemies:[e('a',3)],projectiles:[{...p,delay:.04}]};
 const next=stepWorld(state,.05,{direction:{x:1,y:0},manaRegen:10});
 assert.deepEqual(next,{...state,events:[]});
});
