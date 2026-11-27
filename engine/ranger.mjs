import {compileAttack} from './skill.mjs';
import {weaponStats} from './weapon.mjs';
import {crudeBow,burningArrow,basicBowAttack} from './starter-data.mjs';
import {Momentum,momentumSupport} from './momentum.mjs';
import {payManaCost} from './resources.mjs';
import {resolveAttackImpact} from './combat.mjs';
export function rangerHooks({modifiers,random=Math.random,weapon=weaponStats(crudeBow),active=burningArrow,supports=[momentumSupport],momentum=new Momentum(),range=30}){
 return {momentum,onFire(player,target,time){
 let skill=compileAttack(active,weapon,supports,modifiers,random);
 let payment=payManaCost(player,skill.cost,{eldritchBattery:!!player.rules?.eldritchBattery});
 if(!payment.paid){skill=compileAttack(basicBowAttack,weapon,[],modifiers,random);payment=payManaCost(player,skill.cost);}
 if(!payment.paid)return null;
 const d=Math.hypot(target.x-player.x,target.y-player.y);if(!d)return null;
 const inc=skill.linkedSupports.includes('momentum')?momentum.use(time):0;
 return {player:payment.state,cooldown:1/(skill.attacksPerSecond+inc*skill.attackSpeedPerIncrease),projectile:{x:player.x,y:player.y,dx:(target.x-player.x)/d,dy:(target.y-player.y)/d,speed:active.projectileSpeed??32.6,remainingRange:range,skill,attacker:{accuracy:player.accuracy},rolls:{critical:random(),confirmation:random(),block:random(),ignite:random()}}};
 },onImpact(target,p,time){const result=resolveAttackImpact({attacker:p.attacker,target,skill:p.skill,modifiers,rolls:p.rolls});return {...result.target,ignites:[...(target.ignites??[]),...(result.ignite?[{rate:result.ignite.rate,start:time,end:time+result.ignite.duration}]:[])]};}};
}
