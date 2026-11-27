import {clamp} from './core.mjs';
export const ailmentTypes=['bleed','poison','ignite','chill','freeze','shock','scorch','brittle','sap'];
// Baseline damage before ailment-specific modifiers and target mitigation.
export function damagingAilment(type,base,{durationMultiplier=1,damageMultiplier=1}={}){
 const rules={bleed:[.7,5],poison:[.3,2],ignite:[.9,4]};
 if(!rules[type])throw new Error('Invalid damaging ailment');
 const [rate,duration]=rules[type];
 const eligible=type==='bleed'?(base.physical??0):type==='poison'?(base.physical??0)+(base.chaos??0):(base.fire??0);
 return {type,dps:eligible*rate*damageMultiplier,duration:duration*durationMultiplier};
}
// Ordinary chill/shock baseline; alternate ailments and freeze formulas deferred.
export function elementalEffect(type,damage,threshold,multiplier=1){
 if(!['chill','shock'].includes(type)||threshold<=0)throw new Error('Invalid effect');
 const effect=.5*Math.pow(Math.max(0,damage)/threshold,.4)*multiplier;
 return effect<.05?0:clamp(effect,0,type==='chill'?.3:.5);
}
export class AilmentPool {
 constructor(){this.instances=[];}
 add(instance,time){if(!ailmentTypes.includes(instance.type)||!Number.isFinite(instance.duration)||instance.duration<=0||!Number.isFinite(time))throw new Error('Invalid ailment');this.instances.push({...instance,expires:time+instance.duration});}
 active(time){this.instances=this.instances.filter(x=>x.expires>time);return this.instances;}
 damageRates(time,{moving=false,bleedLimit=1,igniteLimit=1,movingBleedMultiplier=3}={}){
 const active=this.active(time);
 const sum=(type,limit)=>active.filter(x=>x.type===type).map(x=>x.dps??0).sort((a,b)=>b-a).slice(0,limit).reduce((a,b)=>a+b,0);
 return {bleed:sum('bleed',bleedLimit)*(moving?movingBleedMultiplier:1),poison:sum('poison',Infinity),ignite:sum('ignite',igniteLimit)};
 }
 effect(type,time){return Math.max(0,...this.active(time).filter(x=>x.type===type).map(x=>x.effect??0));}
}

// Baseline alternate ailment coefficients; verify against target PoE patch.
export function alternateEffect(type,damage,threshold,multiplier=1){
 const rules={scorch:[.5,.3,.02],brittle:[.25,.06,.002],sap:[.5,.2,.02]};
 if(!rules[type]||threshold<=0)throw new Error('Invalid alternate ailment');
 const [coefficient,cap,min]=rules[type];
 const effect=coefficient*Math.pow(Math.max(0,damage)/threshold,.4)*multiplier;
 return effect<min?0:clamp(effect,0,cap);
}
export function freezeDuration(coldDamage,threshold,multiplier=1){
 if(threshold<=0)throw new Error('Invalid threshold');
 const duration=6*Math.min(1,Math.max(0,coldDamage)/threshold)*multiplier;
 return duration<.3?0:duration;
}
