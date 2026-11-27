import {clamp} from './core.mjs';
const defaults={bleed:['physical'],poison:['physical','chaos'],ignite:['fire'],chill:['cold'],freeze:['cold'],shock:['lightning'],scorch:['fire'],brittle:['cold'],sap:['lightning']};
export function ailmentTrigger({type,damage,source,critical=false,chance=0,roll=1,avoidRoll=1,avoidance=0,immune=false,disabled=false,eligibleTypes,alternateEnabled=false,criticalGuarantee,minimumEffectMet=true}){
 if(!defaults[type])throw new Error('Unknown ailment');
 const eligibleDamage=(eligibleTypes??defaults[type]).reduce((n,t)=>n+Math.max(0,damage[t]??0),0);
 if(immune||disabled||!minimumEffectMet||eligibleDamage<=0)return {applied:false,eligibleDamage};
 if(type==='bleed'&&source!=='attack')return {applied:false,eligibleDamage};
 if(['scorch','brittle','sap'].includes(type)&&!alternateEnabled)return {applied:false,eligibleDamage};
 const guaranteed=type==='chill'||(critical&&(criticalGuarantee??['ignite','freeze','shock'].includes(type)));
 const applied=(guaranteed||roll<clamp(chance,0,1))&&avoidRoll>=clamp(avoidance,0,1)&&avoidance<1;
 return {applied,eligibleDamage};
}
