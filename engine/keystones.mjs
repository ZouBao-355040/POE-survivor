import {recover} from './resources.mjs?v=0.5.18';

export function resourceKeystones(stats,keys=[]){
 const k=new Set(keys),s={...stats},rules={};
 if(k.has('bloodMagic')){s.maximumLife=Math.floor(s.maximumLife*1.1);s.maximumMana=0;rules.bloodMagic=true;}
 if(k.has('chaosInoculation')){s.preCILife=s.maximumLife;s.maximumLife=1;rules.immuneChaos=true;}
 if(k.has('theAgnostic')){s.maximumEnergyShield=0;rules.agnostic=true;}
 if(k.has('zealotsOath'))rules.lifeRegenToES=true;
 if(k.has('ghostDance'))rules.ghostDance=true;
 if(k.has('divineShield'))rules.divineShield=true;
 if(k.has('vaalPact'))rules.vaalPact=true;
 if(k.has('ghostReaver')){rules.lifeLeechToES=true;rules.esLeechCapMultiplier=2;rules.noESRecharge=true;}
 return {stats:s,rules};
}
export function skillResource(resource,rules={}){return resource==='mana'&&rules.bloodMagic?'life':resource;}
export function payLifeCost(state,cost){if(!Number.isFinite(cost)||cost<0)throw new RangeError('Invalid cost');return cost>=state.life&&cost>0?{paid:false,state}:{paid:true,state:{...state,life:state.life-cost}};}
export function agnosticStep(state,dt,recoveryRate=1){if(!Number.isFinite(dt)||dt<0||!Number.isFinite(recoveryRate)||recoveryRate<0)throw new RangeError('Invalid recovery');if(state.rules?.vaalPact)recoveryRate=0;if(state.life>=state.maximumLife)return state;const cap=state.maximumLife-(state.reservedLife??0);const budget=Math.min(state.mana,state.maximumMana*.2*dt);const spend=state.reservedLife>0||recoveryRate===0?budget:Math.min(budget,Math.max(0,cap-state.life)/recoveryRate);return {...state,mana:state.mana-spend,life:recoveryRate===0?state.life:Math.min(cap,state.life+spend*recoveryRate)};}

export function tickGhostShrouds(state,dt){
 if(!state.rules?.ghostDance||state.life<=0)return state;
 const clock=(state.ghostClock??0)+dt;
 const gain=Math.floor((clock+1e-9)/2);
 return {...state,ghostClock:Math.max(0,clock-2*gain),ghostShrouds:Math.min(3,(state.ghostShrouds??0)+gain)};
}
export function consumeGhostShroud(state,result){
 // Glancing Blows can deal damage on block but still doesn't trigger Ghost Dance.
 if(!state.rules?.ghostDance||!(state.ghostShrouds>0)||state.life<=0||!result.hit?.hit||result.mitigation?.blocked)return state;
 return recover({...state,ghostShrouds:state.ghostShrouds-1},'energyShield',Math.max(0,state.evasion??0)*.03);
}

export function recordDivineShieldHit(state,result,time){
 if(!state.rules?.divineShield||state.life<=0||!result.hit?.hit)return state;
 const prevented=result.mitigation?.physicalPrevented??0;
 if(!(prevented>0))return state;
 const hits=state.divineShieldHits??[],last=hits.at(-1);
 // Hits in the same simulation tick share one expiry. Keep the ledger bounded by the time window.
 const updated=last?.time===time?[...hits.slice(0,-1),{time,prevented:last.prevented+prevented}]:[...hits,{time,prevented}];
 return {...state,divineShieldHits:updated};
}

export function tickDivineShield(state,time,dt){
 if(!state.divineShieldHits?.length)return state;
 if(!state.rules?.divineShield||state.life<=0)return {...state,divineShieldHits:[]};
 const end=time+dt;
 let recovered=0;
 const active=[];
 for(const hit of state.divineShieldHits){
  const expiry=hit.time+4;
  const duration=Math.max(0,Math.min(expiry,end)-Math.max(time,hit.time));
  recovered+=hit.prevented*.03*duration;
  if(expiry>end)active.push(hit);
 }
 const next={...state,divineShieldHits:active};
 return recovered>0?recover(next,'energyShield',recovered):next;
}
