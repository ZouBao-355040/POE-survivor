import {clamp,hitChance,entropyHit} from './core.mjs';
// Caller owns defender entropy and supplies independent random samples in [0,1).
// Critical confirmation is random, not a second entropy roll.
export function resolveHit({source,accuracy=0,evasion=0,entropy=0,criticalChance=0,criticalRoll,confirmationRoll,cannotEvade=false,cannotCrit=false}){
 if(!['attack','spell'].includes(source))throw new Error('Unsupported hit source');
 const chance=source==='spell'||cannotEvade?1:hitChance(accuracy,evasion);
 const first=source==='attack'&&!cannotEvade?entropyHit(entropy,chance):{hit:true,entropy};
 if(!first.hit)return {...first,chance,critical:false};
 const candidate=!cannotCrit&&criticalRoll<clamp(criticalChance,0,1);
 const critical=candidate&&(source==='spell'||cannotEvade||confirmationRoll<chance);
 return {...first,chance,critical};
}
