import {attack} from './combat.mjs';
export function advanceCombat(state,dt,{skill,basicAttack,modifiers,manaRegen=0,rolls,context={}}){
 if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid elapsed time');
 let {attacker,target}=state;
 let cooldown=state.cooldown??0,remaining=dt;
 const events=[];
 const recover=t=>{attacker={...attacker,mana:Math.min(attacker.maximumMana-(attacker.reservedMana??0),attacker.mana+manaRegen*t)};};
 while(remaining>0&&target.life>0&&attacker.life>0){
 if(cooldown>=remaining){recover(remaining);cooldown-=remaining;remaining=0;break;}
 recover(cooldown);remaining-=cooldown;
 let selected=skill;
 let result=attack({attacker,target,skill:selected,modifiers,rolls:rolls(),context});
 if(!result.performed){selected=basicAttack;result=attack({attacker,target,skill:selected,modifiers,rolls:rolls(),context});}
 if(!result.performed)throw new Error('Basic attack must be affordable');
 if(!(selected.attacksPerSecond>0&&Number.isFinite(selected.attacksPerSecond)))throw new Error('Invalid attack rate');
 attacker=result.attacker;target=result.target;
 cooldown=1/selected.attacksPerSecond;
 events.push({skill:selected.id,hit:result.hit,dead:result.dead??false});
 }
 return {...state,attacker,target,cooldown,events};
}
