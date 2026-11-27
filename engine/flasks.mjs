import {canRecover} from './resources.mjs?v=0.5.11';

// PoE 1 starter bases. The full-charge enchant is granted to recovery flasks in this game.
export const flaskBases=Object.freeze({
 life:Object.freeze({name:'小型生命藥劑',capacity:21,cost:7,amount:70,duration:3}),
 mana:Object.freeze({name:'小型魔力藥劑',capacity:24,cost:6,amount:50,duration:3}),
});
const kinds=Object.keys(flaskBases);
const maximum=(player,key)=>key==='life'?player.maximumLife-(player.reservedLife??0):player.maximumMana-(player.reservedMana??0);
export function starterFlasks(){
 return Object.fromEntries(kinds.map(key=>[key,{charges:flaskBases[key].capacity,remaining:0}]));
}
export function advanceFlaskRecovery(player,flasks,dt){
 if(!flasks)return {player,flasks};
 const next={...player},updated={};
 for(const key of kinds){
  const flask=flasks[key],base=flaskBases[key],cap=maximum(player,key);
  if(!canRecover(player,key)){updated[key]={...flask,remaining:0};continue;}
  const span=Math.min(dt,flask.remaining);
  let remaining=flask.remaining;
  if(span>0&&Number.isFinite(cap)&&Number.isFinite(player[key])&&player.life>0){
   next[key]=Math.min(cap,next[key]+span*base.amount/base.duration);
   remaining=next[key]>=cap?0:Math.max(0,flask.remaining-span);
   if(remaining<1e-9)remaining=0;
  }
  updated[key]={...flask,remaining};
 }
 return {player:next,flasks:updated};
}
export function autoFlasks(player,flasks,gainedCharges=0){
 if(!flasks||player.life<=0)return {flasks,used:[]};
 const next={},used=[];
 for(const key of kinds){
  const flask=flasks[key],base=flaskBases[key];
  const charges=Math.min(base.capacity,flask.charges+gainedCharges);
  // A full corresponding resource refuses use without consuming charges.
  // A refused full flask stays armed; there is no percentage threshold.
  if(canRecover(player,key)&&charges===base.capacity&&player[key]<maximum(player,key)){
   next[key]={charges:charges-base.cost,remaining:base.duration};
   used.push(key);
  }else next[key]={...flask,charges};
 }
 return {flasks:next,used};
}
