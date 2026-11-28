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
 const shield=eldritchBattery?Math.max(0,state.energyShield??0):0;
 const mana=Math.max(0,state.mana??0);
 if(mana+shield<cost)return {paid:false,state};
 const next={...state};const es=Math.min(shield,cost);next.energyShield=(next.energyShield??0)-es;next.mana=mana-(cost-es);return {paid:true,state:next};
}
export function paySkillCost(state,cost,lifeRatio=0){
 const bloodMagic=state.rules?.bloodMagic;
 let life,mana;
 if(cost&&typeof cost==='object'){
  life=bloodMagic?cost.bloodMagicLife:cost.life;
  mana=bloodMagic?0:cost.mana;
 }else{
  if(!Number.isFinite(cost)||cost<0)throw new RangeError('Invalid cost');
  life=bloodMagic?cost:Math.min(cost,Math.floor(cost*clamp(lifeRatio,0,1)));
  mana=cost-life;
 }
 if(!Number.isFinite(life)||life<0||!Number.isFinite(mana)||mana<0)throw new RangeError('Invalid cost');
 if(life>0&&life>=state.life)return {paid:false,state};
 const payment=payManaCost(state,mana,{eldritchBattery:!!state.rules?.eldritchBattery});
 if(!payment.paid||!life)return payment;
 return {paid:true,state:{...payment.state,life:state.life-life}};
}
export const canRecover=(state,key)=>key!=='life'||!state.rules?.vaalPact;
const maximumKeys={life:'maximumLife',mana:'maximumMana',energyShield:'maximumEnergyShield'};
export function recoveryLimit(state,key){
 const reserved=key==='life'?'reservedLife':key==='mana'?'reservedMana':'reservedEnergyShield';
 const maximum=Math.max(0,(state[maximumKeys[key]]??0)-(state[reserved]??0));
 if(key!=='energyShield')return maximum;
 const evasion=state.rules?.ghostDance?Math.max(0,state.evasion??0):Infinity;
 const armour=state.rules?.divineShield?Math.max(0,state.defence?.armour??0):Infinity;
 return Math.min(maximum,evasion,armour);
}
export function recover(state,key,amount){
 if(!Object.hasOwn(maximumKeys,key)||!Number.isFinite(amount)||amount<0)throw new Error('Invalid recovery');
 if(!canRecover(state,key))return state;
 const current=state[key]??0,limit=recoveryLimit(state,key);
 // A lowered recovery limit stops new recovery, not shield already gained.
 return current>=limit?state:{...state,[key]:Math.min(limit,current+amount)};
}

export const mindOverMatterFraction=.4;
export const eldritchBatteryRechargeMultiplier=.5;
