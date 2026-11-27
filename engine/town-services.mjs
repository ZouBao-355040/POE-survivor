export const gearSlots=Object.freeze({weapon:'武器',body:'胸甲',boots:'鞋子'});
export const wagerPrice=6;
export const satchelLimit=18;
const gearNames={weapon:['銅紋武裝','海濱武裝','生鏽武裝'],body:['巡岸外衣','漂流鎧衣','獅眼護甲'],boots:['泥痕短靴','鹽漬皮靴','巡路長靴']};
export function newTownServices(){return {nextItem:1,gear:[],equipped:{},storedGear:[],storedGems:new Map(),orbs:{},storedOrbs:{}};}
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
const orbTypes=['蛻變石','增幅石','改造石','點金石'];
export function hillockLoot(town,random=Math.random){
 if(sample(random)<.25)return {gold:2+Math.floor(sample(random)*2),item:null,orb:null,town};
 const gold=6+Math.floor(sample(random)*4);
 const slot=Object.keys(gearSlots)[Math.floor(sample(random)*3)];
 const gear=makeGear(town,slot,random,1);
 const orb=orbTypes[Math.floor(sample(random)*orbTypes.length)];
 return {gold,item:gear.item,orb,town:{...gear.town,orbs:{...gear.town.orbs,[orb]:(gear.town.orbs[orb]??0)+1}}};
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
 return {attack:value('weapon')/100,life:value('body'),speed:1+value('boots')/100};
}
export function itemAffix(item){
 return item.slot==='weapon'?'攻擊傷害提高 '+item.value+'%':item.slot==='body'?'最大生命 +'+item.value:'移動速度提高 '+item.value+'%';
}
