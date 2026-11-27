import {clamp} from './core.mjs';

// Costs are whole points. Supports establish the base; efficiency is a divisor, not reduced cost.
export function skillCosts(active,supportMultiplier,modifiers,context){
 const baseMana=Math.floor((active.cost??0)*supportMultiplier+1e-9);
 const baseLife=Math.floor((active.baseLifeCost??0)*supportMultiplier+1e-9);
 const split=clamp(modifiers.calculate(0,'lifeCostRatio',context),0,1);
 const part=(base,resource)=>{
  const typed=modifiers.breakdown(resource+'Cost',context);
  const generic=modifiers.breakdown('skillCost',context);
  if(typed.override!==undefined)return Math.max(0,Math.round(typed.override));
  const efficiency=modifiers.calculate(0,['costEfficiency',resource+'Efficiency'],context);
  const stage=(value,factor)=>Math.max(0,factor<1?Math.ceil(value*factor-1e-9):Math.floor(value*factor+1e-9));
  let adjusted=stage(base,1+typed.increased+generic.increased);
  adjusted=stage(adjusted,typed.multipliers.reduce((a,b)=>a*b,1));
  adjusted=stage(adjusted,generic.multipliers.reduce((a,b)=>a*b,1));
  return Math.max(0,Math.round(adjusted/Math.max(.01,1+efficiency))+typed.flat+generic.flat);
 };
 const mana=Math.floor(part(baseMana,'mana')*(1-split)+1e-9);
 const life=part(baseLife+Math.round(baseMana*split),'life');
 const bloodMagicLife=part(baseLife+baseMana,'life');
 return {mana,life,bloodMagicLife};
}
