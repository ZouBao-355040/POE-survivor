import {randomCurrency,creditCurrency,currencyDrop} from './currency.mjs?v=0.5.5';
import {rollGearAffixes} from './gear-crafting.mjs?v=0.5.5';
import {bowLayout} from './sockets.mjs?v=0.5.2';
import {createGemInstance} from './gem-inventory.mjs?v=0.5.4';

export const gearSlots=Object.freeze({weapon:'武器',body:'胸甲',helmet:'頭盔',gloves:'手套',boots:'鞋子'});
export const wagerPrice=6;
export const satchelLimit=18;
const gearNames={weapon:['銅紋武裝','海濱武裝','生鏽武裝'],body:['巡岸外衣','漂流鎧衣','獅眼護甲'],helmet:['皮革兜帽','鐵製頭盔','獅眼頭盔'],gloves:['皮革手套','鐵製手甲','獅眼手甲'],boots:['泥痕短靴','鹽漬皮靴','巡路長靴']};
// Independent base defences; the existing slot value and crafting affixes stay intact.
const defenceBases={
 body:[{evasion:16},{armour:24},{energyShield:12}],
 helmet:[{evasion:10},{armour:14},{energyShield:8}],
 gloves:[{evasion:7},{armour:10},{armour:6,energyShield:4}],
 boots:[{evasion:8},{energyShield:5},{armour:6,evasion:4}]
};
export const gearDefenceLabel=item=>Object.entries(item.baseDefence??{}).map(([key,value])=>
 ({armour:'護甲',evasion:'閃避值',energyShield:'能量護盾'}[key]??key)+' +'+value);
export function newTownServices({starter=false}={}){
 const gear=starter?[
  {id:'starter-weapon',slot:'weapon',name:'粗製短弓',rarity:'普通',value:0,starter:true},
  {id:'starter-body',slot:'body',name:'漂流者外衣',rarity:'普通',value:0,starter:true}
 ]:[];
 return {nextItem:1,gear,equipped:Object.fromEntries(gear.map(g=>[g.slot,g.id])),storedGear:[],storedGems:new Map(),storedOrbs:{}};
}
export const equippedSocketLayout=town=>Object.fromEntries(Object.entries(bowLayout)
 .filter(([slot])=>town.gear.some(g=>g.id===town.equipped[slot]&&g.slot===slot)));
function sample(random){const n=random();if(!(n>=0&&n<1))throw new RangeError('無效擲骰');return n;}
function gearBlueprint(slot,random,rank,itemLevel=3){
 const rarity=['普通','魔法','稀有'][rank];
 const baseIndex=Math.floor(sample(random)*3),name=gearNames[slot][baseIndex];
 const value=slot==='weapon'?8+rank*5+Math.floor(sample(random)*4):slot==='body'?8+rank*5+Math.floor(sample(random)*5):5+rank*4+Math.floor(sample(random)*3);
 const base=defenceBases[slot]?.[baseIndex];
 const baseDefence=base&&Object.fromEntries(Object.entries(base).map(([key,amount])=>[key,Math.round(amount*(1+Math.max(0,itemLevel-2)*.08))]));
 return rollGearAffixes({slot,name,rarity,value,itemLevel,...(baseDefence?{baseDefence}:{})},random);
}
function addGear(town,blueprint){
 const item={...blueprint,id:'gear-'+town.nextItem};
 return {item,town:{...town,nextItem:town.nextItem+1,gear:[...town.gear,item]}};
}
function makeGear(town,slot,random,minRank=0,itemLevel=3){
 const rank=minRank+Math.floor(sample(random)*(3-minRank));
 return addGear(town,gearBlueprint(slot,random,rank,itemLevel));
}
export const regularGearDropChance=.02;
export function trialGearDrop(kill,encounter,bossAlreadyRewarded=false,random=Math.random){
 if(bossAlreadyRewarded&&kill.boss)return null;
 if(!kill.boss&&sample(random)>=regularGearDropChance)return null;
 const draw=sample(random),mapRank=encounter.rank??0;
 const rarity=kill.boss?(encounter.stageId==='coast'?0:draw<.30?0:draw<.85?1:2):
  draw<.74?0:mapRank>=5&&draw>=.97?2:1;
 const slots=Object.keys(gearSlots),slot=slots[Math.floor(sample(random)*slots.length)];
 return {...gearBlueprint(slot,random,rarity,3+mapRank+Number(!!kill.boss)),dropArea:encounter.stageName,
  dropSource:kill.boss?(encounter.boss?.name??'區域頭目'):'普通怪'};
}
export function rollGear(town,gold,slot,random=Math.random,itemLevel=3){
 if(!Object.hasOwn(gearSlots,slot))throw new Error('未知部位');
 if(!Number.isSafeInteger(gold)||gold<wagerPrice)throw new Error('金幣不足');
 if(town.gear.length>=satchelLimit)throw new Error('裝備背包已滿');
 return {gold:gold-wagerPrice,...makeGear(town,slot,random,0,itemLevel)};
}
export function hillockLoot(town,random=Math.random){
 if(sample(random)<.25)return {gold:2+Math.floor(sample(random)*2),item:null,orb:null,town};
 const gold=6+Math.floor(sample(random)*4);
 const slot=['weapon','body','boots'][Math.floor(sample(random)*3)];
 const gear=makeGear(town,slot,random,1,2);
 const orb=randomCurrency(()=>sample(random));
 return {gold,item:gear.item,orb,town:{...gear.town,storedOrbs:creditCurrency(gear.town.storedOrbs,[orb])}};
}
export const emptyBattleLoot=()=>({gold:0,orbs:[],gems:[],gear:[],hillock:false});

export function queueBattleLoot(loot,kill,{hillock=false,rollCurrency=true,gem=null,gear=null,random=Math.random}={}){
 const orb=!hillock&&rollCurrency?currencyDrop(kill,random):null;
 return {gold:loot.gold+kill.gold,orbs:orb?[...loot.orbs,orb]:loot.orbs,gems:gem&&!loot.gems.some(g=>g.id===gem.id)?[...loot.gems,gem]:loot.gems,gear:gear?[...(loot.gear??[]),gear]:(loot.gear??[]),hillock:loot.hillock||hillock};
}

export function queueTrialLoot(state,kill,{gem=null,random=Math.random}={}){
 const bossGearRewards=state.bossGearRewards??{};
 const stage=state.encounter;
 const gear=trialGearDrop(kill,stage,Object.hasOwn(bossGearRewards,stage.stageId),random);
 return {...state,pendingLoot:queueBattleLoot(state.pendingLoot,kill,{gem,gear,random}),
  bossGearRewards:kill.boss&&gear?{...bossGearRewards,[stage.stageId]:true}:bossGearRewards};
}

export function claimBattleLoot(town,gold,loot,random=Math.random){
 const hillock=loot.hillock?hillockLoot(town,random):null;
 let base=hillock?.town??town;
 let claimedGear=Number(!!hillock?.item);
 // Battlefield items are never lost to a full bag; purchases and manual withdrawals still respect the soft limit.
 for(const blueprint of loot.gear??[]){base=addGear(base,blueprint).town;claimedGear++;}
 const storedGems=new Map(base.storedGems);
 let claimedGems=0;
 for(const gem of loot.gems)if(!storedGems.has(gem.id)){storedGems.set(gem.id,createGemInstance(gem));claimedGems++;}
 return {town:{...base,storedGems,storedOrbs:creditCurrency(base.storedOrbs,loot.orbs)},gold:gold+loot.gold+(hillock?.gold??0),
  claimedGold:loot.gold+(hillock?.gold??0),claimedOrbs:loot.orbs.length+Number(!!hillock?.orb),claimedGems,claimedGear,hillock,pending:emptyBattleLoot()};
}

export function equipGear(town,id){
 const item=town.gear.find(g=>g.id===id);
 if(!item)throw new Error('裝備不在背包');
 const equipped={...town.equipped};
 if(equipped[item.slot]===id)delete equipped[item.slot];else equipped[item.slot]=id;
 return {...town,equipped};
}
export function transferGear(town,id,toStash){
 const from=toStash?'gear':'storedGear',to=toStash?'storedGear':'gear';
 const item=town[from].find(i=>i.id===id);
 if(!item)throw new Error('找不到裝備');
 if(toStash&&town.equipped[item.slot]===id)throw new Error('請先卸下裝備');
 if(!toStash&&town.gear.length>=satchelLimit)throw new Error('裝備背包已滿');
 return {...town,[from]:town[from].filter(i=>i.id!==id),[to]:[...town[to],item]};
}
export function transferGem(town,inventory,id,toStash){
 if(toStash){
  const gem=inventory.owned.get(id);
  if(!gem)throw new Error('找不到寶石');
  if(Object.values(inventory.board.groups).flat().some(g=>g?.id===id))throw new Error('請先卸下插槽中的寶石');
  inventory.owned.delete(id);town.storedGems.set(id,gem);
 }else{
  const gem=town.storedGems.get(id);
  if(!gem||inventory.owned.has(id))throw new Error('無法取出寶石');
  town.storedGems.delete(id);inventory.owned.set(id,gem);
 }
}
export function socketStoredGem(town,inventory,id,group,index){
 inventory.board.check(group,index);
 if(inventory.board.groups[group][index])throw new Error('請先選擇空插槽');
 transferGem(town,inventory,id,false);
 inventory.equip(id,group,index);
}
export function equippedStats(town){
 const equipped=Object.entries(town.equipped).map(([slot,id])=>town.gear.find(g=>g.id===id&&g.slot===slot)).filter(Boolean);
 const value=slot=>equipped.find(g=>g.slot===slot)?.value??0;
 const local=key=>equipped.reduce((n,item)=>n+(item.baseDefence?.[key]??0),0);
 const mods={};
 for(const item of equipped)for(const affix of item.affixes??[])mods[affix.key]=(mods[affix.key]??0)+affix.value;
 return {attack:(value('weapon')+value('gloves')+(mods.attack??0))/100,
  life:value('body')+value('helmet')+(mods.life??0),speed:1+(value('boots')+(mods.move??0))/100,
  mana:mods.mana??0,accuracy:mods.accuracy??0,evasion:local('evasion')+(mods.evasion??0),armour:local('armour'),energyShield:local('energyShield'),
  resistances:Object.fromEntries(['fire','cold','lightning'].map(key=>[key,(mods[key]??0)/100]))};
}
export function itemAffix(item){
 if(item.starter)return '初始裝備';
 return ['weapon','gloves'].includes(item.slot)?'攻擊傷害提高 '+item.value+'%':['body','helmet'].includes(item.slot)?'最大生命 +'+item.value:'移動速度提高 '+item.value+'%';
}
