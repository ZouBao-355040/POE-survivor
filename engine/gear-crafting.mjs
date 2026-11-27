import {currencies,currencyBalance,debitCurrency} from './currency.mjs?v=0.5.5';

const commonPrefixes=['life','mana','attack'];
const commonSuffixes=['accuracy','fire','cold','lightning','evasion'];
const pools=Object.freeze({
 weapon:{prefix:[...commonPrefixes],suffix:commonSuffixes},
 body:{prefix:['life','mana','evasion'],suffix:['fire','cold','lightning','accuracy']},
 helmet:{prefix:['life','mana','evasion'],suffix:['fire','cold','lightning','accuracy']},
 gloves:{prefix:[...commonPrefixes],suffix:commonSuffixes},
 boots:{prefix:['life','mana','move'],suffix:commonSuffixes}
});
const spec=Object.freeze({
 life:[3,8,'最大生命 +',''],mana:[2,6,'最大魔力 +',''],attack:[3,8,'攻擊傷害提高 ','%'],
 move:[2,4,'移動速度提高 ','%'],accuracy:[8,18,'命中值 +',''],evasion:[5,11,'閃避值 +',''],
 fire:[5,10,'火焰抗性 +','%'],cold:[5,10,'冰冷抗性 +','%'],lightning:[5,10,'閃電抗性 +','%']
});
export const affixText=affix=>{const [,,before,after]=spec[affix.key];return before+affix.value+after;};

export function affixCatalog(slot){
 const pool=pools[slot];
 if(!pool)return [];
 return ['prefix','suffix'].flatMap(side=>pool[side].map(key=>({
  side,key,text:affixText({key,value:spec[key][0]+'～'+spec[key][1]})})));
}
function sample(random){
 const value=random();
 if(!(value>=0&&value<1))throw new RangeError('無效擲骰');
 return value;
}
const affixCap=rarity=>rarity==='稀有'?3:1;
function candidates(item,rarity){
 const have=item.affixes??[];
 return affixCatalog(item.slot).filter(entry=>!have.some(f=>f.key===entry.key)&&
  have.filter(f=>f.side===entry.side).length<affixCap(rarity));
}
function addAffix(item,random){
 const entries=candidates(item,item.rarity);
 if(!entries.length)throw new Error('沒有可新增的詞綴');
 const {side,key}=entries[Math.floor(sample(random)*entries.length)], [min,max]=spec[key];
 return {...item,affixes:[...(item.affixes??[]),{side,key,value:min+Math.floor(sample(random)*(max-min+1))}]};
}
export function rollGearAffixes(item,random=Math.random){
 let next={...item,affixes:[]};
 const count=item.rarity==='普通'?0:item.rarity==='魔法'?1+Math.floor(sample(random)*2):3+Math.floor(sample(random)*2);
 for(let i=0;i<count;i++)next=addAffix(next,random);
 return next;
}

const basic=Object.freeze({
 '蛻變石':{from:'普通',to:'魔法',adds:false,description:'將普通裝備升為魔法，隨機產生 1～2 條詞綴。'},
 '改造石':{from:'魔法',to:'魔法',adds:false,description:'重擲魔法裝備的所有詞綴，原詞綴會被替換。'},
 '增幅石':{from:'魔法',to:'魔法',adds:true,description:'保留現有詞綴，新增一條前綴或後綴。'},
 '點金石':{from:'普通',to:'稀有',adds:false,description:'將普通裝備升為稀有，隨機產生 3～4 條詞綴。'},
 '富豪石':{from:'魔法',to:'稀有',adds:true,description:'將魔法裝備升為稀有，保留原詞綴並新增一條。'}
});
// Later categories can use family and tier entries without altering the layout.
export const craftCategories=Object.freeze([
 {id:'basic',name:'一般通貨',entries:currencies.map(id=>({id,name:id,...basic[id]}))},
 {id:'influence',name:'勢力通貨',entries:[]},{id:'harvest',name:'花園工藝',entries:[]},
 {id:'bench',name:'一般工藝',entries:[]},{id:'fossil',name:'化石通貨',entries:[]},
 {id:'essence',name:'精髓',entries:[]}
]);

export function craftAvailability(item,orb,wallet){
 const entry=Object.hasOwn(basic,orb)?basic[orb]:null;
 if(!entry)return {enabled:false,reason:'未知工藝'};
 const balance=currencyBalance(wallet,orb);
 const reason=!item?'先選擇一件裝備':!Object.hasOwn(pools,item.slot)?'此底材尚未開放打造':
  item.rarity!==entry.from?'只能用在'+entry.from+'裝備':
  entry.adds&&!candidates(item,entry.to).length?'詞綴已滿':balance<=0?'倉庫存量不足':'';
 return {enabled:!reason,reason,balance,description:entry.description};
}
export function craftGear(town,itemId,orb,random=Math.random){
 const item=town.gear.find(g=>g.id===itemId);
 const status=craftAvailability(item,orb,town.storedOrbs);
 if(!status.enabled)throw new Error(status.reason);
 const entry=basic[orb],withRarity={...item,rarity:entry.to};
 const crafted=entry.adds?addAffix(withRarity,random):rollGearAffixes(withRarity,random);
 return {item:crafted,town:{...town,gear:town.gear.map(g=>g.id===itemId?crafted:g),
  storedOrbs:debitCurrency(town.storedOrbs,orb)}};
}
