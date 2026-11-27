import test from 'node:test';
import assert from 'node:assert/strict';
import {gemPrice,shopStock,purchaseGem,collectGold,shopCampaign,gemAvailability,selectDroppedGem} from './gem-shop.mjs';
import {stepWorld} from './game-loop.mjs';
import {catalog as fullCatalog,gemById} from './projectile-catalog.mjs';
const split={id:'split-arrow',kind:'active',tags:['attack']};
const spell={id:'spell',kind:'active',tags:['spell']};
const attack={id:'attack-support',kind:'support',requiresAll:['attack']};
const support={id:'spell-support',kind:'support',requiresAll:['spell']};
const catalog=[split,spell,attack,support];
test('shop lists all unowned stock deterministically and can filter compatible supports',()=>{
 assert.deepEqual(shopStock(catalog,['split-arrow'],'active'),[spell]);
 assert.deepEqual(shopStock(catalog,[],'support',split),[attack]);
 assert.deepEqual(shopStock(catalog,[],'support'),[attack,support]);
});
test('shop guards the balance, ownership and town-only access',()=>{
 const progression={level:2,pendingChoices:1},context={progression,gold:6,catalog,ownedIds:[],inTown:true,campaign:shopCampaign({zone:'town'})};
 const first=purchaseGem(context,'split-arrow');
 assert.equal(first.gold,3);
 assert.equal(first.gem,split);
 const second=purchaseGem({...context,gold:first.gold,ownedIds:[first.gem.id]},'attack-support');
 assert.equal(second.gold,1);
 assert.throws(()=>purchaseGem({...context,gold:1},split.id),/金幣不足/);
 assert.throws(()=>purchaseGem({...context,ownedIds:[split.id]},split.id),/已擁有/);
 assert.throws(()=>purchaseGem({...context,inTown:false},split.id),/商店尚未開放/);
 assert.equal(gemPrice({kind:'active',tags:['vaal']}),6);
});
test('gold drops exist on the ground, collect near the player, and sweep before a level shop',()=>{
 const player={x:0,y:0,speed:1,life:100,maximumLife:100,mana:100,maximumMana:100};
 const far={id:'far',x:9,y:0,life:0,experienceReward:1};
 const state={player,gold:0,goldDrops:[],enemies:[far],projectiles:[]};
 const first=stepWorld(state,.02,{experienceRequired:()=>2});
 assert.equal(first.gold,0);
 assert.deepEqual(first.goldDrops,[{x:9,y:0,amount:1}]);
 const close=collectGold({x:8,y:0},first.goldDrops,[]);
 assert.equal(close.amount,1);
 const second=stepWorld({...first,enemies:[far]},.02,{experienceRequired:()=>2});
 assert.equal(second.progression.pendingChoices,1);
 assert.equal(second.gold,2);
 assert.deepEqual(second.goldDrops,[]);
 assert.equal(stepWorld(second,.02).gold,2);
 assert.equal(stepWorld({...state,practice:true},.02).gold,0);
});

test('shop gates character level AND cleared main quest in Act I',()=>{
 const gem=gemById.get('lesser-multiple-projectiles');
 assert.equal(gem.requiredLevel,8);
 const state={zone:'trial',routeIndex:2,encounter:{phase:'boss'}};
 const at=(level,s)=>gemAvailability(gem,{progression:{level},campaign:shopCampaign(s)});
 assert.equal(at(100,state).available,false,'overlevelling must not unlock the quest gate');
 assert.match(at(100,state).reason,/海潮地穴/);
 assert.equal(at(7,{...state,encounter:{phase:'cleared'}}).reason,'角色等級 8');
 assert.equal(at(8,{...state,encounter:{phase:'cleared'}}).available,true);
 assert.equal(at(8,{...state,encounter:{phase:'cleared'},dead:true}).available,false);
 assert.equal(at(8,{zone:'town',routeIndex:3}).available,true);
 const budget={catalog:fullCatalog,ownedIds:[],gold:100,inTown:true,campaign:shopCampaign({zone:'town',routeIndex:0}),progression:{level:100}};
 assert.throws(()=>purchaseGem(budget,gem.id),/海潮地穴/);
});
test('regular greater projectiles are later stock; awakened, exceptional and transfigured stay off sale',()=>{
 assert.ok(fullCatalog.every(g=>Number.isSafeInteger(g.requiredLevel)&&g.requiredLevel>=1));
 const campaign=shopCampaign({chapter:4,zone:'town'}),progression={level:100},greater=gemById.get('greater-multiple-projectiles');
 assert.equal(greater.requiredLevel,38);
 assert.equal(gemAvailability(greater,{progression,campaign}).available,true);
 assert.equal(gemAvailability(greater,{progression,campaign:shopCampaign({zone:'town',routeIndex:11})}).available,false);
 for(const key of ['SupportAwakenedGreaterMultipleProjectiles','SupportGreaterChain','TornadoShotAltX']){
  const g=fullCatalog.find(item=>item.sourceKey===key);
  assert.equal(gemAvailability(g,{progression,campaign}).listed,false);
  assert.ok(!shopStock(fullCatalog,[],g.kind).includes(g));
  assert.throws(()=>purchaseGem({catalog:fullCatalog,ownedIds:[],gold:100,inTown:true,progression,campaign},g.id),/不由商店販售/);
 }
 const starter=gemById.get('split-arrow');
 assert.equal(selectDroppedGem({boss:true},[greater,starter],[],{campaign:shopCampaign({zone:'trial'}),progression:{level:2}},()=>0),starter);
 assert.equal(selectDroppedGem({boss:true},[starter],[starter.id],{campaign,progression},()=>0),null);
});
