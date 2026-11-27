// Preliminary reservation accounting; exact per-skill rounding requires parity checks.
export function reservationCost(maximum,{fraction=0,flat=0,efficiency=0,multiplier=1}={}){
 if(![maximum,fraction,flat,efficiency,multiplier].every(Number.isFinite)||maximum<0||fraction<0||flat<0||efficiency<=-1||multiplier<0)throw new RangeError('Invalid reservation');
 return Math.ceil((maximum*fraction+flat)*multiplier/(1+efficiency));
}
export function reserve(state,entries){
 const reserved={life:0,mana:0};
 for(const e of entries){if(!['life','mana'].includes(e.resource))throw new Error('Invalid resource');const max=state[e.resource==='life'?'maximumLife':'maximumMana'];reserved[e.resource]+=reservationCost(max,e);}
 if(reserved.life>=state.maximumLife||reserved.mana>state.maximumMana)return {accepted:false,state};
 return {accepted:true,state:{...state,reservedLife:reserved.life,reservedMana:reserved.mana,life:Math.min(state.life,state.maximumLife-reserved.life),mana:Math.min(state.mana,state.maximumMana-reserved.mana)}};
}
export function eventRecovery(state,modifiers,event,context={}){
 if(!['hit','kill'].includes(event))throw new Error('Invalid recovery event');
 const next={...state};
 for(const [key,max,reserved] of [['life','maximumLife','reservedLife'],['mana','maximumMana','reservedMana'],['energyShield','maximumEnergyShield',null]]){
 const amount=modifiers.calculate(0,key+(event==='hit'?'OnHit':'OnKill'),context);
 next[key]=Math.min(state[max]-(reserved?state[reserved]??0:0),state[key]+amount);
 }return next;
}
