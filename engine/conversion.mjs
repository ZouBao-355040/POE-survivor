import {damageTypes,emptyDamage} from './core.mjs';
// Each rule: {from,to,fraction,kind:'convert'|'extra',priority:'skill'|'other'}.
// Fractions are nonnegative. Skill conversion takes precedence.
export function convertDamage(base,rules=[]){
 for(const r of rules){if(!damageTypes.includes(r.from)||!damageTypes.includes(r.to)||damageTypes.indexOf(r.from)>=damageTypes.indexOf(r.to)||!Number.isFinite(r.fraction)||r.fraction<0||!['convert','extra'].includes(r.kind))throw new Error('Invalid conversion rule');}
 let packets=damageTypes.filter(t=>base[t]>0).map(t=>({type:t,amount:base[t],history:[t]}));
 for(const type of damageTypes){
 const relevant=rules.filter(r=>r.from===type);
 const skill=relevant.filter(r=>r.kind==='convert'&&r.priority==='skill'),other=relevant.filter(r=>r.kind==='convert'&&r.priority!=='skill');
 const sum=rs=>rs.reduce((n,r)=>n+r.fraction,0);
 const sf=sum(skill),of=sum(other),ss=sf>1?1/sf:1,os=of>0?Math.min(1,Math.max(0,1-sf*ss)/of):1;
 const next=[];
 for(const p of packets){if(p.type!==type){next.push(p);continue;}
 let remaining=1;
 for(const r of relevant){const f=r.fraction*(r.kind==='extra'?1:r.priority==='skill'?ss:os);if(r.kind==='convert')remaining-=f;if(f>0)next.push({type:r.to,amount:p.amount*f,history:[...p.history,r.to]});}
 if(remaining>1e-12)next.push({...p,amount:p.amount*remaining});
 }packets=next;
 }return packets;
}
export function aggregateDamage(packets){const result=emptyDamage();for(const p of packets)result[p.type]+=p.amount;return result;}
export function prepareBaseDamage(base,modifiers,context={},effectiveness=1){
 const out=emptyDamage();
 for(const t of damageTypes)out[t]=Math.max(0,(base[t]??0)+modifiers.breakdown(t+'Damage',context).flat*effectiveness);
 return out;
}
export function scalePackets(packets,modifiers,context={}){
 return packets.map(p=>{
 const keys=['damage',...p.history.map(t=>t+'Damage')];
 if(p.history.some(t=>['fire','cold','lightning'].includes(t)))keys.push('elementalDamage');
 const b=modifiers.breakdown(keys,context);
 if(b.override!==undefined)throw new Error('Damage override requires explicit calculation rule');
 return {...p,amount:Math.max(0,p.amount*(1+b.increased)*b.multipliers.reduce((a,b)=>a*b,1))};
 });
}
