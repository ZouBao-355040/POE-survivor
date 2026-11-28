import {attack} from './combat.mjs?v=0.5.21';
import {igniteIntervals} from './ignite.mjs';
import {mitigateDot} from './dot.mjs?v=0.5.21';
import {applyDamage} from './resources.mjs?v=0.5.18';
export function advanceCombat(state,dt,{skill,basicAttack,modifiers,manaRegen=0,rolls,context={},momentum,moving=false}){
 if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid elapsed time');
 let {attacker,target}=state;
 let cooldown=state.cooldown??0,remaining=dt;
 const events=[];
 if(moving)momentum?.move();
 let time=state.time??0,ignites=[...(state.ignites??[])];
 const recover=t=>{for(const i of igniteIntervals(ignites,time,time+t)){const rates=mitigateDot({fire:i.rate},target.defence);const damage=Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,v*(i.end-i.start)]));target=applyDamage(target,damage,target.rules).state;if(target.life<=0)break;}time+=t;ignites=ignites.filter(i=>i.end>time);attacker={...attacker,mana:Math.min(attacker.maximumMana-(attacker.reservedMana??0),attacker.mana+manaRegen*t)};};
 while(remaining>0&&target.life>0&&attacker.life>0){
 if(cooldown>=remaining){recover(remaining);cooldown-=remaining;remaining=0;break;}
 recover(cooldown);remaining-=cooldown;if(target.life<=0)break;
 let selected=typeof skill==='function'?skill():skill;
 let result=attack({attacker,target,skill:selected,modifiers,rolls:rolls(),context});
 if(!result.performed){selected=typeof basicAttack==='function'?basicAttack():basicAttack;result=attack({attacker,target,skill:selected,modifiers,rolls:rolls(),context});}
 if(!result.performed)throw new Error('Basic attack must be affordable');
 if(!(selected.attacksPerSecond>0&&Number.isFinite(selected.attacksPerSecond)))throw new Error('Invalid attack rate');
 attacker=result.attacker;target=result.target;
 if(result.ignite)ignites.push({rate:result.ignite.rate,start:time,end:time+result.ignite.duration});
 const momentumIncrease=!moving&&momentum&&selected.linkedSupports?.includes('momentum')?momentum.use(time):0;
 cooldown=1/(selected.attacksPerSecond+momentumIncrease*(selected.attackSpeedPerIncrease??selected.attacksPerSecond));
 events.push({skill:selected.id,hit:result.hit,dead:result.dead??false});
 }
 return {...state,attacker,target,cooldown,events,time,ignites};
}
