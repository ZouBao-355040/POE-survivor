import {resolveCharacterClass} from './character.mjs?v=0.5.10';
import {rows,starts} from './passive-tree-data.mjs?v=0.5.10';
import {compilePassives,keystones} from './passive-effects.mjs?v=0.5.30';
export {starts};
export const sourceUrl='https://github.com/grindinggear/skilltree-export/blob/3.30.0/data.json';
export const classNames=Object.freeze({Ranger:'遊俠',Marauder:'野蠻人',Witch:'女巫',Duelist:'決鬥者',Templar:'聖堂武僧',Shadow:'暗影刺客',Scion:'貴族'});
const categories={Life:'生命',Mana:'魔力',Leech:'偷取',Projectile:'投射物',Bow:'弓',Attack:'攻擊',Caster:'施法',Evasion:'閃避',
 Critical:'暴擊',Armour:'護甲','Energy Shield':'能量護盾','Spell Suppression':'法術壓抑',Fire:'火焰',Cold:'冰冷',Lightning:'閃電',
 Elemental:'元素',Chaos:'混沌',Poison:'中毒','Damage Over Time':'持續傷害',Totem:'圖騰',Minion:'召喚物',Flask:'藥劑',Shield:'盾牌',Trap:'陷阱',Mine:'地雷'};
const known={50338:'彈道學',54142:'靈巧',45035:'投射物傷害與命中',39821:'閃避與生命',2094:'閃避與生命',50826:'魔力與法術格擋',18174:'神幻壁壘',5632:'流血機率與暴擊率',23199:'流血傷害與機率',28498:'流血機率',17833:'流血持續傷害加成',12664:'流血傷害加快',21634:'魔力藥劑回復與充能',42041:'生命藥劑回復與充能',50690:'藥劑定時充能',41137:'生命藥劑擊中充能',16236:'中毒機率與傷害',31359:'致命毒素',26365:'攻擊點燃機率',36736:'燃燒傷害與攻速',15290:'瞭望塔'};
const masteryClasses=new Map();
export const nodes=new Map(rows.map(([id,original,kind,x,y,group,neighbors,lines,options])=>{
 const key=keystones[id];
 const compiled=compilePassives(lines);
 const mastery=original.replace(/ Mastery$/,'');
 const name=key?.[1]??classNames[original]??known[id]??(kind==='mastery'&&categories[mastery]?categories[mastery]+'專精':kind==='small'&&compiled.available?compiled.effects.map(s=>s.replace(/ (?:\+|提高 |降低 )\d.*$/,'')).slice(0,2).join('／'):original);
 const effects=options.map(([effectId,raw])=>{
  if(!masteryClasses.has(effectId))masteryClasses.set(effectId,compilePassives(raw));
  return {id:effectId,...masteryClasses.get(effectId)};
 });
 return [id,{id,name,original,kind,x,y,group,neighbors,key:key?.[0],...compiled,effects:key?.[2]??compiled.effects,
  implemented:kind==='keystone'?!!key:kind==='mastery'?effects.some(e=>e.available):compiled.available,options:effects}];
}));
export const classStart=p=>starts[resolveCharacterClass(p)];
export function points(p){
 const earned=Number.isSafeInteger(p?.passivePoints)?Math.max(0,p.passivePoints):0;
 const spent=new Set((p?.talents??[]).map(Number).filter(id=>nodes.has(id)&&nodes.get(id).kind!=='start')).size;
 return {earned,spent,remaining:Math.max(0,earned-spent)};
}
export function treeStatus(progression){
 const start=classStart(progression), picked=new Set((progression?.talents??[]).map(Number));
 const used=new Set(Object.values(progression?.masteries??{}).map(Number));
 const remaining=points(progression).remaining;
 function availability(id,optionId){
  const n=nodes.get(Number(id));
  if(!n)return {state:'locked',reason:'找不到天賦'};
  if(n.id===start)return {state:'start',reason:'角色起點，不消耗點數'};
  if(picked.has(n.id))return {state:'allocated',reason:'已配置'};
  if(n.kind==='start')return {state:'locked',reason:'其他職業的起點'};
  if(n.kind==='jewel')return {state:'unimplemented',reason:'珠寶插槽尚未接入，不消耗點數'};
  if(n.kind==='mastery'){
   if(!n.implemented)return {state:'unimplemented',reason:'此專精的效果尚未接入'};
   const effect=n.options.find(e=>e.id===Number(optionId));
   if(optionId!=null&&!effect?.available)return {state:'unimplemented',reason:'此專精效果尚未接入'};
   if(effect&&used.has(effect.id))return {state:'locked',reason:'同一專精效果只能配置一次'};
   if(!n.options.some(o=>o.available&&!used.has(o.id)))return {state:'locked',reason:'可用效果已在其他專精配置'};
   if(!n.neighbors.some(link=>picked.has(link)&&nodes.get(link)?.kind==='notable'&&nodes.get(link).group===n.group))
    return {state:'locked',reason:'請先配置此群的重要天賦'};
  }else{
   if(!n.implemented)return {state:'unimplemented',reason:'此節點尚未完整接入，不消耗點數'};
   if(!n.neighbors.some(link=>link===start||(picked.has(link)&&nodes.get(link)?.kind!=='mastery')))
    return {state:'locked',reason:'需要連接已配置天賦'};
  }
  return remaining>0?{state:'available',reason:'可配置 · 消耗 1 點'}:{state:'locked',reason:'沒有可用天賦點'};
 }
 return {start,picked,used,availability};
}
export function allocate(progression,id,optionId){
 id=Number(id);
 const {availability}=treeStatus(progression);
 const verdict=availability(id,optionId);
 if(verdict.state!=='available')throw new Error(verdict.reason);
 if(nodes.get(id).kind==='mastery'&&optionId==null)throw new Error('請選擇一個專精效果');
 const next={...progression,talents:[...(progression.talents??[]).map(String),String(id)]};
 if(nodes.get(id).kind==='mastery')next.masteries={...progression.masteries,[id]:Number(optionId)};
 return next;
}
export function selectedPassives(progression){
 const keys=new Set(),mods=[],effects=new Set();
 let lifeMasteries=0;
 for(const id of new Set((progression?.talents??[]).map(Number))){
  const n=nodes.get(id);
  if(!n?.implemented)continue;
  if(n.key)keys.add(n.key);
  else if(n.kind==='mastery'){
   const option=n.options.find(o=>o.id===Number(progression.masteries?.[id])&&o.available&&!effects.has(o.id));
   if(option){effects.add(option.id);mods.push(...option.mods);if(n.original==='Life Mastery')lifeMasteries++;}
  }else mods.push(...n.mods);
 }
 return {keys,mods,lifeMasteries};
}
export function tracePath(progression,end,{preview=false}={}){
 const {start,picked}=treeStatus(progression),q=[start,...[...picked].filter(id=>nodes.has(id)&&nodes.get(id).kind!=='mastery')];
 const previous=new Map(q.map(id=>[id,null]));
 const ok=n=>n.kind!=='start'&&(preview||n.implemented);
 for(let i=0;i<q.length;i++){
  const id=q[i],n=nodes.get(id);
  if(id===end){const path=[];for(let k=id;k!==null;k=previous.get(k))path.unshift(k);return path;}
  if(n.kind==='mastery')continue;
  for(const next of n.neighbors){const dest=nodes.get(next);
   if(previous.has(next)||!ok(dest)||(dest.kind==='mastery'&&(next!==end||n.kind!=='notable'||n.group!==dest.group)))continue;
   previous.set(next,id);q.push(next);
  }
 }
 return [];
}
