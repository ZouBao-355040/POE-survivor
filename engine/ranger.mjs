import {compileAttack} from './skill.mjs';
import {weaponStats} from './weapon.mjs';
import {crudeBow,burningArrow,basicBowAttack} from './starter-data.mjs';
import {Momentum,momentumSupport} from './momentum.mjs';
import {payManaCost} from './resources.mjs';
import {resolveAttackImpact} from './combat.mjs';
export function rangerHooks({modifiers,random=Math.random,weapon=weaponStats(crudeBow),active=burningArrow,supports=[momentumSupport],momentum=new Momentum(),inventory}){
 return {momentum,onFire(player,target,time){
 const linked=inventory?.current();let chosen=inventory?(linked?.active??basicBowAttack):active;
 let skill=compileAttack(chosen,weapon,inventory?(linked?.supports??[]):supports,modifiers,random);
 let payment=payManaCost(player,skill.cost,{eldritchBattery:!!player.rules?.eldritchBattery});
 if(!payment.paid){chosen=basicBowAttack;skill=compileAttack(basicBowAttack,weapon,[],modifiers,random);payment=payManaCost(player,skill.cost);}
 if(!payment.paid)return null;
 const d=Math.hypot(target.x-player.x,target.y-player.y);if(!d)return null;
 const speed=modifiers.calculate(chosen.projectileSpeed??32.6,'projectileSpeed',skill.context);
 const duration=chosen.projectileLifetime??1;
 const range=chosen.fixedProjectileRange??speed*duration;
 const inc=skill.linkedSupports.includes('momentum')?momentum.use(time):0;
 const count=Math.max(1,Math.floor(modifiers.calculate((chosen.projectileCount??1)+skill.additionalProjectiles,'projectileCount',skill.context)));
 const angle=Math.atan2(target.y-player.y,target.x-player.x),volley={hits:new Set()};
 const shot={player:payment.state,cooldown:1/(skill.attacksPerSecond+inc*skill.attackSpeedPerIncrease),projectile:{x:player.x,y:player.y,dx:(target.x-player.x)/d,dy:(target.y-player.y)/d,speed,pierce:skill.pierce,remainingRange:range,skill,attacker:{accuracy:player.accuracy},rolls:{critical:random(),confirmation:random(),block:random(),ignite:random()}}};
 return {...shot,projectiles:Array.from({length:count},(_,i)=>{const a=angle+(i-(count-1)/2)*.15;return {...shot.projectile,dx:Math.cos(a),dy:Math.sin(a),volley:chosen.allowShotgun?undefined:volley};})};
 },onImpact(target,p,time){const result=resolveAttackImpact({attacker:p.attacker,target,skill:p.skill,modifiers,rolls:p.rolls});return {...result.target,ignites:[...(target.ignites??[]),...(result.ignite?[{rate:result.ignite.rate,start:time,end:time+result.ignite.duration}]:[])]};}};
}
