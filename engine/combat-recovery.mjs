import {recover} from './resources.mjs?v=0.5.14';

export const combatRecoveryResources=Object.freeze({Life:'life',Mana:'mana','Energy Shield':'energyShield'});
const poolMax={life:'maximumLife',mana:'maximumMana',energyShield:'maximumEnergyShield'};
export const damageProxy=shot=>shot.leechProxy??(['totem','trap','mine'].includes(shot.skill?.deploy)?shot.skill.deploy:undefined);

export function recoverOnAttackHit(player,shot){
 if(!(player.life>0)||(shot.skill.source??'attack')!=='attack'||damageProxy(shot)||!player.combatRecovery)return;
 for(const [key,values] of Object.entries(player.combatRecovery)){
  if(values.attackHit>0)player[key]=recover(player,key,values.attackHit)[key];
 }
}

export function recoverOnKill(player){
 if(!(player.life>0)||!player.combatRecovery)return player;
 for(const [key,values] of Object.entries(player.combatRecovery)){
  const amount=values.killFlat+(player[poolMax[key]]??0)*values.killFraction;
  if(amount>0)player=recover(player,key,amount);
 }
 return player;
}

export function queueHitRecoup(before,after){
 if(!(after.life>0)||!after.combatRecovery)return after;
 const damage=Object.keys(poolMax).reduce((sum,key)=>sum+Math.max(0,(before[key]??0)-(after[key]??0)),0);
 if(!damage)return after;
 const additions=[];
 for(const [key,values] of Object.entries(after.combatRecovery)){
  if(!(values.recoup>0))continue;
  const duration=values.recoupDuration??4;
  additions.push({key,duration,rate:damage*values.recoup/duration});
 }
 return additions.length?{...after,recoupEffects:[...(after.recoupEffects??[]),...additions]}:after;
}

export function tickHitRecoup(player,dt){
 if(!player.recoupEffects?.length)return player;
 const effects=[],amounts={};
 for(const {key,duration,rate} of player.recoupEffects)if(player.life>0){
  const span=Math.min(dt,duration);
  amounts[key]=(amounts[key]??0)+span*rate;
  if(duration-span>1e-9)effects.push({key,duration:duration-span,rate});
 }
 for(const [key,amount] of Object.entries(amounts))if(amount>0)player=recover(player,key,amount);
 return {...player,recoupEffects:effects};
}
