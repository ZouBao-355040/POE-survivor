import {damageTypes,clamp} from './core.mjs';
export function applyDamage(state,damage,rules={}){
 if(rules.immuneChaos)damage={...damage,chaos:0};
 const next={...state};
 const total=damageTypes.reduce((n,t)=>n+Math.max(0,damage[t]??0),0);
 const chaos=Math.max(0,damage.chaos??0);
 const spend=(key,amount)=>{const used=Math.min(Math.max(0,next[key]??0),amount);next[key]=(next[key]??0)-used;return amount-used;};
 let remaining=total;
 if(!rules.eldritchBattery){
 const bypass=rules.chaosDoesNotBypass?0:chaos;
 remaining=bypass+spend('energyShield',total-bypass);
 }
 const redirected=remaining*clamp(rules.damageTakenFromManaBeforeLife??0,0,1);
 // EB protects mana; chaos bypasses that shield unless explicitly prevented.
 const chaosRemaining=Math.min(remaining,rules.chaosDoesNotBypass?0:chaos);
 const manaBypass=remaining>0?redirected*chaosRemaining/remaining:0;
 const manaDue=rules.eldritchBattery?manaBypass+spend('energyShield',redirected-manaBypass):redirected;
 const unpaid=spend('mana',manaDue);
 const overkill=spend('life',remaining-redirected+unpaid);
 return {state:next,dead:next.life<=0,overkill,rechargeInterrupted:rules.eldritchBattery?next.mana<state.mana||next.energyShield<(state.energyShield??0):next.life<state.life||next.energyShield<(state.energyShield??0)};
}
export function payManaCost(state,cost,{eldritchBattery=false}={}){
 if(!Number.isFinite(cost)||cost<0)throw new RangeError('Invalid cost');
 if(state.mana+(eldritchBattery?state.energyShield:0)<cost)return {paid:false,state};
 const next={...state};const es=eldritchBattery?Math.min(next.energyShield,cost):0;next.energyShield=(next.energyShield??0)-es;next.mana-=cost-es;return {paid:true,state:next};
}
export function paySkillCost(state,cost,lifeRatio=0){
 if(!Number.isFinite(cost)||cost<0)throw new RangeError('Invalid cost');
 if(state.rules?.bloodMagic)lifeRatio=1;
 const life=Math.min(cost,Math.floor(cost*lifeRatio));
 if(life>0&&life>=state.life)return {paid:false,state};
 const payment=payManaCost(state,cost-life,{eldritchBattery:!!state.rules?.eldritchBattery});
 if(!payment.paid||!life)return payment;
 return {paid:true,state:{...payment.state,life:state.life-life}};
}
export function recover(state,key,amount){if(!['life','mana','energyShield'].includes(key)||!Number.isFinite(amount)||amount<0)throw new Error('Invalid recovery');const max=state[{life:'maximumLife',mana:'maximumMana',energyShield:'maximumEnergyShield'}[key]];return {...state,[key]:Math.min(max-(key==='life'?(state.reservedLife??0):key==='mana'?(state.reservedMana??0):0),state[key]+amount)};}

export const mindOverMatterFraction=.4;
export const eldritchBatteryRechargeMultiplier=.5;
