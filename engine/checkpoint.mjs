import {actOne} from './act-one.mjs';
import {currencies} from './currency.mjs';
import {GemInventory,createGemInstance} from './gem-inventory.mjs?v=0.5.14';
import {gemById} from './projectile-catalog.mjs?v=0.5.10';
import {gemLevelCap,gemXpRequired} from './gem-growth.mjs';
import {allocate,nodes} from './passive-tree.mjs?v=0.5.24';
import {gearSlots,equippedSocketLayout} from './town-services.mjs?v=0.5.21';
import {affixCatalog} from './gear-crafting.mjs?v=0.5.10';

export const checkpointKey='poe-survivor-town';
const schema=1;
const own=Object.hasOwn;
const record=a=>a!==null&&typeof a==='object'&&!Array.isArray(a);
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const only=(a,b)=>{if(!a)throw new Error(b??'Invalid checkpoint');};
const semver=v=>typeof v==='string'&&/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(v)?v.split('.').map(Number):null;
export function versionCompare(a,b){
 const aa=semver(a),bb=semver(b);
 if(!aa||!bb)throw new Error('Invalid version');
 return Math.sign(aa[0]-bb[0]||aa[1]-bb[1]||aa[2]-bb[2]);
}
const savedGear=g=>({
 id:g.id,slot:g.slot,name:g.name,rarity:g.rarity,value:g.value,
 ...(g.starter?{starter:true}:{itemLevel:g.itemLevel}),
 dropArea:g.dropArea,dropSource:g.dropSource,baseDefence:g.baseDefence,
 affixes:g.affixes?.map(a=>({key:a.key,side:a.side,value:a.value,tier:a.tier}))
});
const savedGem=g=>({id:g.id,level:g.level,experience:g.experience});
export function encodeCheckpoint({state,town,inventory,choices},build){
 only(state.zone==='town','Not a town checkpoint');
 const p=state.progression;
 return JSON.stringify({schema,build,routeIndex:state.routeIndex??0,gold:state.gold,kills:state.kills??0,
  killLoot:actOne.filter(a=>own(state.bossGearRewards??{},a.id)).map(a=>a.id),
  progression:{level:p.level??1,experience:p.experience??0,passivePoints:p.passivePoints??0,pendingChoices:p.pendingChoices??0,
   characterClass:p.characterClass??'Ranger',talents:p.talents??[],masteries:p.masteries??{}},
  choices:choices??null,
  town:{gear:town.gear.map(savedGear),storedGear:town.storedGear.map(savedGear),equipped:town.equipped,nextItem:town.nextItem,
   orbs:Object.fromEntries(currencies.map(c=>[c,String(own(town.storedOrbs,c)?town.storedOrbs[c]:0)])),
   gems:[...town.storedGems.values()].map(savedGem)},
  inventory:{gems:[...inventory.owned.values()].map(savedGem),
   sockets:Object.fromEntries(Object.entries(inventory.board.groups).map(([slot,gems])=>[slot,gems.map(g=>g?.id??null)])),
   auto:[...inventory.automatic],manual:inventory.manual,selected:inventory.selected}});
}
export function decodeCheckpoint(raw,runningBuild){
 if(raw==null)return {status:'empty'};
 try{
  const s=JSON.parse(raw);
  only(record(s));
  if(s.schema!==schema||versionCompare(s.build,runningBuild)>0)return {status:'incompatible'};
  only(integer(s.routeIndex,0,actOne.length)&&integer(s.gold)&&integer(s.kills)&&Array.isArray(s.killLoot));
  only(s.killLoot.every(id=>actOne.some(a=>a.id===id)));
  const p=s.progression;
  only(record(p)&&p.characterClass==='Ranger'&&integer(p.level,1,1000)&&integer(p.experience)&&integer(p.passivePoints,0,p.level-1)
   &&integer(p.pendingChoices,0,p.level-1)&&Array.isArray(p.talents)&&record(p.masteries));
  let progression={level:p.level,experience:p.experience,passivePoints:p.passivePoints,pendingChoices:p.pendingChoices,characterClass:'Ranger'};
  for(const id of p.talents){
   only(typeof id==='string'&&/^\d+$/.test(id));
   const n=nodes.get(Number(id));
   only(n&&((n.kind==='mastery')===own(p.masteries,id)));
   progression=allocate(progression,id,p.masteries[id]);
  }
  only(Object.keys(progression.masteries??{}).length===Object.keys(p.masteries).length);
  only(s.choices===null||p.pendingChoices>0&&Array.isArray(s.choices)&&new Set(s.choices).size===3&&s.choices.length===3&&s.choices.every(c=>currencies.includes(c)));
  const t=s.town;
  only(record(t)&&record(t.equipped)&&record(t.orbs)&&integer(t.nextItem,1)&&Array.isArray(t.gear)&&Array.isArray(t.storedGear));
  const ids=new Set();
  const gear=(g)=>{
   only(record(g)&&own(gearSlots,g.slot)&&typeof g.id==='string'&&!ids.has(g.id)&&typeof g.name==='string'&&g.name.length<=80
    &&['普通','魔法','稀有'].includes(g.rarity)&&integer(g.value,0,10000));
   if(g.starter)only(g.id==='starter-'+g.slot&&['weapon','body'].includes(g.slot));
   else only(/^gear-[1-9]\d*$/.test(g.id)&&Number(g.id.slice(5))<t.nextItem&&integer(g.itemLevel,1,1000));
   ids.add(g.id);
   const item={id:g.id,slot:g.slot,name:g.name,rarity:g.rarity,value:g.value};
   if(g.starter)item.starter=true;else item.itemLevel=g.itemLevel;
   for(const prop of ['dropArea','dropSource'])if(typeof g[prop]==='string'&&g[prop].length<=80)item[prop]=g[prop];
   if(g.baseDefence!==undefined){
    only(record(g.baseDefence)&&Object.entries(g.baseDefence).every(([k,v])=>['armour','evasion','energyShield'].includes(k)&&integer(v,0,10000)));
    item.baseDefence={...g.baseDefence};
   }
   if(g.affixes!==undefined){
    const allowed=affixCatalog(g.slot,g.itemLevel);
    only(Array.isArray(g.affixes)&&g.affixes.length<=6);
    item.affixes=g.affixes.map(a=>{
     only(record(a)&&integer(a.value,0,1000)&&allowed.some(x=>x.side===a.side&&x.key===a.key&&x.tiers.some(v=>v.tier===a.tier)));
     return {key:a.key,side:a.side,value:a.value,tier:a.tier};
    });
   }
   return item;
  };
  const wallet={};
  for(const c of currencies){only(typeof t.orbs[c]==='string'&&/^\d{1,252}$/.test(t.orbs[c]));const n=BigInt(t.orbs[c]);if(n)wallet[c]=n>BigInt(Number.MAX_SAFE_INTEGER)?n:Number(n);}
  const town={gear:t.gear.map(gear),storedGear:t.storedGear.map(gear),equipped:{},nextItem:t.nextItem,storedOrbs:wallet,storedGems:new Map()};
  for(const [slot,id] of Object.entries(t.equipped)){
   only(own(gearSlots,slot)&&town.gear.some(g=>g.slot===slot&&g.id===id));town.equipped[slot]=id;
  }
  const i=s.inventory,inventory=new GemInventory(),seen=new Set();
  only(record(i)&&record(i.sockets)&&Array.isArray(i.gems)&&Array.isArray(t.gems)&&Array.isArray(i.auto));
  const gem=g=>{
   only(record(g)&&gemById.has(g.id)&&!seen.has(g.id)&&integer(g.level,1,gemLevelCap)
    &&integer(g.experience,0,g.level===gemLevelCap?0:gemXpRequired(g.level)-1));
   seen.add(g.id);return {...createGemInstance(gemById.get(g.id)),level:g.level,experience:g.experience};
  };
  for(const g of i.gems)inventory.owned.set(g.id,gem(g));
  for(const g of t.gems)town.storedGems.set(g.id,gem(g));
  const layout=equippedSocketLayout(town);
  only(Object.keys(i.sockets).length===Object.keys(layout).length);
  inventory.setLayout(layout);
  for(const [slot,gems] of Object.entries(i.sockets)){
   only(own(layout,slot)&&Array.isArray(gems)&&gems.length===layout[slot]);
   for(const [index,id] of gems.entries())if(id!==null){only(!Object.values(inventory.board.groups).flat().some(g=>g?.id===id));inventory.equip(id,slot,index);}
  }
  only(new Set(i.auto).size===i.auto.length&&!i.auto.includes(i.manual));
  for(const id of i.auto)inventory.setMode(id,'auto');
  if(i.manual!==null)inventory.setMode(i.manual,'manual');
  if(i.selected!==null)inventory.select(i.selected);else inventory.selected=null;
  return {status:'ready',raw,town,inventory,choices:s.choices,routeIndex:s.routeIndex,gold:s.gold,kills:s.kills,
   bossGearRewards:Object.fromEntries(s.killLoot.map(id=>[id,true])),progression};
 }catch{return {status:'invalid'};}
}

export function checkpointStore(storage,build){
 let ownRaw=null,blocked=false;
 return {
  load(){try{ownRaw=storage.getItem(checkpointKey);const decoded=decodeCheckpoint(ownRaw,build);
   blocked=decoded.status==='invalid'||decoded.status==='incompatible';return decoded;
  }catch{blocked=true;return {status:'unavailable'};}},
  save(value){try{
   if(blocked||storage.getItem(checkpointKey)!==ownRaw)return false;
   const raw=encodeCheckpoint(value,build);
   if(raw!==ownRaw){storage.setItem(checkpointKey,raw);ownRaw=raw;}return true;
  }catch{return false;}},
  clear(){try{
   if(blocked||storage.getItem(checkpointKey)!==ownRaw)return false;
   storage.removeItem(checkpointKey);ownRaw=null;return true;
  }catch{return false;}}
 };
}
