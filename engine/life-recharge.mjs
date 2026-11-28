import {recover,recoveryLimit,canRecover} from './resources.mjs?v=0.5.18';

export function tickLifeRecharge(player,time,dt){
 if(!player.rules?.eternalYouth||!(player.life>0)||!canRecover(player,'life'))return player;
 const ceiling=recoveryLimit(player,'life');
 if(player.life>=ceiling)return player.lifeCharging?{...player,lifeCharging:false}:player;
 const end=time+dt, since=end-(player.lifeRechargeInterruptedAt??-Infinity);
 const span=Math.max(0,Math.min(dt,since-(player.esRechargeDelay??2)));
 const speed=(player.esRechargeRate??1/3)*player.maximumLife;
 if(!(span>0&&speed>0))return player;
 const next=recover(player,'life',span*speed);
 return {...next,lifeRechargeStarted:player.lifeCharging?player.lifeRechargeStarted:end-span,lifeCharging:next.life<ceiling};
}
export function interruptLifeRecharge(before,after,time){
 if(!before.rules?.eternalYouth||!(after.life<before.life))return after;
 if(before.rules?.wickedWard&&before.lifeCharging&&time-before.lifeRechargeStarted<4-1e-9)return after;
 return {...after,lifeRechargeInterruptedAt:time,lifeCharging:false};
}
