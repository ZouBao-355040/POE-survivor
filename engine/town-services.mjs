import {randomCurrency,creditCurrency,currencyDrop} from './currency.mjs';
import {bowLayout} from './sockets.mjs?v=0.5.2';
import {createGemInstance} from './gem-inventory.mjs?v=0.5.4';

export const gearSlots=Object.freeze({weapon:'武器',body:'胸甲',helmet:'頭盔',gloves:'手套',boots:'鞋子'});
export const wagerPrice=6;
export const satchelLimit=18;
const gearNames={weapon:['銅紋武裝','海濱武裝','生鏽武裝'],body:['巡岸外衣','漂流鎧衣','獅眼護甲'],helmet:['皮革兜帽','鐵製頭盔','獅眼頭盔'],gloves:['皮革手套','鐵製手甲','獅眼手甲'],boots:['泥痕短靴','鹽漬皮靴','巡路長靴']};
export function newTownServices({starter=false}={}){
 const gear=starter?[
  {id:'starter-weapon',slot:'weapon',name:'粗製短弓',rarity:'普通',value:0,starter:true},
  {id:'starter-body',slot:'body',name:'漂流者外衣',rarity:'普通',value:0,starter:true}
 ]:[];
 return {nextItem:1,gear,equipped:Object.fromEntries(gear.map(g=>[g.slot,g.id])),storedGear:[],storedGems:new Map(),orbs:{},storedOrbs:{}};
}
export const equippedSocketLayout=town=>Object.fromEntries(Object.entries(bowLayout)
 .filter(([slot])=>town.gear.some(g=>g.id===town.equipped[slot]&&g.slot===slot)));
function sample(random){const n=random();if(!(n>=0&&n<1))throw new RangeError('無效擲骰');return n;}
function makeGear(town,slot,random,minRank=0){
 const rank=minRank+Math.floor(sample(random)*(3-minRank));
 const rarity=['普通','魔法','稀有'][rank];
 const name=gearNames[slot][Math.floor(sample(random)*3)];
 const value=slot==='weapon'?8+rank*5+Math.floor(sample(random)*4):slot==='body'?8+rank*5+Math.floor(sample(random)*5):5+rank*4+Math.floor(sample(random)*3);
 const item={id:'gear-'+town.nextItem,slot,name,rarity,value};
 return {item,town:{...town,nextItem:town.nextItem+1,gear:[...town.gear,item]}};
}
export function rollGear(town,gold,slot,random=Math.random){
 if(!Object.hasOwn(gearSlots,slot))throw new Error('未知部位');
 if(!Number.isSafeInteger(gold)||gold<wagerPrice)throw new Error('金幣不足');
 if(town.gear.length>=satchelLimit)throw new Error('裝備背包已滿');
 return {gold:gold-wagerPrice,...makeGear(town,slot,random)};
}
export function hillockLoot(town,random=Math.random){
 if(sample(random)<.25)return {gold:2+Math.floor(sample(random)*2),item:null,orb:null,town};
 const gold=6+Math.floor(sample(random)*4);
 const slot=['weapon','body','boots'][Math.floor(sample(random)*3)];
 const gear=makeGear(town,slot,random,1);
 const orb=randomCurrency(()=>sample(random));
 return {gold,item:gear.item,orb,town:{...gear.town,storedOrbs:creditCurrency(gear.town.storedOrbs,[orb])}};
}
export const emptyBattleLoot=()=>({gold:0,orbs:[],gems:[],hillock:false});

export function queueBattleLoot(loot,kill,{hillock=false,rollCurrency=true,gem=null,random=Math.random}={}){
 const orb=!hillock&&rollCurrency?currencyDrop(kill,random):null;
 return {gold:loot.gold+kill.gold,orbs:orb?[...loot.orbs,orb]:loot.orbs,gems:gem&&!loot.gems.some(g=>g.id===gem.id)?[...loot.gems,gem]:loot.gems,hillock:loot.hillock||hillock};
}

export function claimBattleLoot(town,gold,loot,random=Math.random){
 const hillock=loot.hillock?hillockLoot(town,random):null;
 const base=hillock?.town??town;
 const storedGems=new Map(base.storedGems);
 let claimedGems=0;
 for(const gem of loot.gems)if(!storedGems.has(gem.id)){storedGems.set(gem.id,createGemInstance(gem));claimedGems++;}
 return {town:{...base,storedGems,storedOrbs:creditCurrency(base.storedOrbs,loot.orbs)},gold:gold+loot.gold+(hillock?.gold??0),
  claimedGold:loot.gold+(hillock?.gold??0),claimedOrbs:loot.orbs.length+Number(!!hillock?.orb),claimedGems,hillock,pending:emptyBattleLoot()};
}

export function transferOrb(town,orb,toStash){
 const from=toStash?'orbs':'storedOrbs',to=toStash?'storedOrbs':'orbs';
 if(!(town[from][orb]>0))throw new Error('沒有這顆通貨');
 const left={...town[from],[orb]:town[from][orb]-1};
 if(!left[orb])delete left[orb];
 return {...town,[from]:left,[to]:{...town[to],[orb]:(town[to][orb]??0)+1}};
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
export function equippedStats(town){
 const value=slot=>town.gear.find(g=>g.id===town.equipped[slot])?.value??0;
 return {attack:(value('weapon')+value('gloves'))/100,life:value('body')+value('helmet'),speed:1+value('boots')/100};
}
export function itemAffix(item){
 if(item.starter)return '初始裝備';
 return ['weapon','gloves'].includes(item.slot)?'攻擊傷害提高 '+item.value+'%':['body','helmet'].includes(item.slot)?'最大生命 +'+item.value:'移動速度提高 '+item.value+'%';
}
