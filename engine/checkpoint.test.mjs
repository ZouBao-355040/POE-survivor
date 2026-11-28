import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointKey,encodeCheckpoint,decodeCheckpoint,checkpointStore,versionCompare} from './checkpoint.mjs';
import {versionCheck} from './version-check.mjs';
import {GemInventory} from './gem-inventory.mjs';
import {gemById} from './projectile-catalog.mjs';
import {newTownServices,equipGear,equippedSocketLayout,rollGear,transferGem} from './town-services.mjs';
import {allocate} from './passive-tree.mjs';

function fixture(){
 let town=newTownServices({starter:true});
 const rolled=rollGear(town,26,'helmet',()=>.75,10);
 town=equipGear(rolled.town,rolled.item.id);
 town.storedOrbs={改造石:3,富豪石:9007199254740994n};
 const inventory=new GemInventory();
 inventory.setLayout(equippedSocketLayout(town));
 for(const id of ['burning-arrow','momentum','fireball','split-arrow'])inventory.acquire(gemById.get(id));
 inventory.equip('burning-arrow','weapon',0);inventory.equip('momentum','weapon',1);
 inventory.equip('fireball','helmet',0);
 inventory.setMode('fireball','auto');inventory.setMode('burning-arrow','manual');
 inventory.grantExperience(72,9);
 transferGem(town,inventory,'split-arrow',true);
 const state={zone:'town',routeIndex:3,gold:20,kills:35,bossGearRewards:{coast:true},progression:allocate({level:4,characterClass:'Ranger',passivePoints:3,experience:7,pendingChoices:1},39821)};
 return {state,town,inventory,choices:['改造石','富豪石','點金石']};
}
const build='0.5.25';
test('round-trip safely restores gear, BigInt currency, selected rewards, talents and functional gem bindings',()=>{
 const source=fixture(),raw=encodeCheckpoint(source,build);
 assert.ok(!raw.includes('baseSpellDamage')&&!raw.includes('board'));
 const restored=decodeCheckpoint(raw,build);
 assert.equal(restored.status,'ready');
 assert.deepEqual(restored.town,source.town);
 assert.deepEqual(restored.choices,source.choices);
 assert.deepEqual(restored.progression,source.state.progression);
 assert.deepEqual(restored.bossGearRewards,{coast:true});
 assert.equal(restored.routeIndex,3);assert.equal(restored.gold,20);
 assert.equal(restored.inventory.board.groups.weapon[0],restored.inventory.owned.get('burning-arrow'));
 assert.equal(restored.inventory.castPlan().manual.active.id,'burning-arrow');
 assert.equal(restored.inventory.castPlan().auto[0].active.id,'fireball');
 assert.ok(restored.inventory.board.groups.weapon[0].level>1);
 assert.equal(decodeCheckpoint(raw,'0.5.26').status,'ready');
});

test('corrupt, future builds, invalid professions/gear/socket bindings do not produce a checkpoint',()=>{
 const raw=encodeCheckpoint(fixture(),build);
 assert.equal(decodeCheckpoint(raw,'0.5.24').status,'incompatible');
 assert.equal(decodeCheckpoint('{ no more JSON',build).status,'invalid');
 for(const mutate of [
  s=>s.progression.characterClass='Witch',
  s=>s.progression.talents.push('54447'),
  s=>s.town.equipped.weapon='gear-1',
  s=>s.inventory.sockets.weapon[2]='burning-arrow',
  s=>s.inventory.sockets.body[0]='not-an-existing-gem',
 ]){
  const s=JSON.parse(raw);mutate(s);assert.equal(decodeCheckpoint(JSON.stringify(s),build).status,'invalid');
 }
 assert.throws(()=>encodeCheckpoint({...fixture(),state:{zone:'trial'}},build),/Not a town/);
});

test('storage failures are non-fatal; invalid/newer saves and writes by another tab are not overwritten',()=>{
 let raw=null,writes=0;
 const storage={getItem(k){assert.equal(k,checkpointKey);return raw;},setItem(k,v){raw=v;writes++;},removeItem(){raw=null;}};
 const first=checkpointStore(storage,build),second=checkpointStore(storage,build);
 assert.equal(first.load().status,'empty');assert.equal(second.load().status,'empty');
 const snapshot=fixture();
 assert.equal(first.save(snapshot),true);
 assert.equal(first.save(snapshot),true);assert.equal(writes,1);
 const kept=raw;
 assert.equal(second.save(snapshot),false);assert.equal(second.clear(),false);assert.equal(raw,kept);
 const older=checkpointStore(storage,'0.5.24');
 assert.equal(older.load().status,'incompatible');assert.equal(older.save(snapshot),false);assert.equal(older.clear(),false);
 raw='{bad JSON';assert.equal(first.load().status,'invalid');assert.equal(first.save(snapshot),false);
 const denied=checkpointStore({getItem(){throw Error('denied');}},build);
 assert.equal(denied.load().status,'unavailable');assert.equal(denied.save(snapshot),false);
});

test('update checking has no timer, deduplicates events, ignores old/offline, and honors dismissal',async()=>{
 let time=0,requests=0,replies=[{version:'0.5.24'},{version:'0.5.26'},{version:'0.5.26'},Error('offline'),{version:'0.5.27'}];
 const shown=[];
 const check=versionCheck({build,now:()=>time,cooldown:60,read:()=>{
  requests++;const x=replies.shift();if(x instanceof Error)throw x;return x;
 },show:v=>shown.push(v)});
 assert.equal(requests,0);
 await Promise.all([check.check(),check.check()]);
 time=30;await check.check();assert.equal(requests,1);
 time=61;await check.check();assert.deepEqual(shown,['0.5.26']);
 check.dismiss('0.5.26');time=130;await check.check();
 time=200;await check.check();assert.equal(requests,4);
 time=270;await check.check();assert.deepEqual(shown,['0.5.26','0.5.27']);
 assert.ok(versionCompare('0.5.100','0.5.9')>0);
});
