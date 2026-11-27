import {scale} from './core.mjs';
// Values use fractions for percentage modifiers. Conditions are explicit context keys.
export class ModifierStore {
  #sources = new Map();
  replace(source, modifiers) {
    if (!source || !Array.isArray(modifiers)) throw new TypeError('Invalid source');
    const validated = modifiers.map(m => {
      if (!m.stat || !['flat','increased','more','override'].includes(m.kind) || !Number.isFinite(m.value)) throw new TypeError('Invalid modifier');
      if(m.kind==='more' && m.value < -1) throw new RangeError('Invalid multiplier');
      return Object.freeze({...m, tags:Object.freeze([...(m.tags??[])]), conditions:Object.freeze({...m.conditions}), source});
    });
    this.#sources.set(source,validated);
  }
  remove(source){this.#sources.delete(source);}
  matching(stats, context={}) {
    const keys=new Set(Array.isArray(stats)?stats:[stats]);
    const tags=new Set(context.tags??[]);
    return [...this.#sources.values()].flat().filter(m=>keys.has(m.stat)&&m.tags.every(t=>tags.has(t))&&Object.entries(m.conditions).every(([k,v])=>context.conditions?.[k]===v));
  }
  breakdown(stats,context={}) {
    const mods=this.matching(stats,context);
    const sum=kind=>mods.filter(m=>m.kind===kind).reduce((n,m)=>n+m.value,0);
    const overrides=mods.filter(m=>m.kind==='override');
    if(new Set(overrides.map(m=>m.value)).size>1) throw new Error('Conflicting overrides require explicit rule');
    return {flat:sum('flat'),increased:sum('increased'),multipliers:mods.filter(m=>m.kind==='more').map(m=>1+m.value),override:overrides[0]?.value,mods};
  }
  calculate(base,stats,context={}) {
    const b=this.breakdown(stats,context);
    return b.override??scale(base,b.flat,b.increased,b.multipliers);
  }
}
