export function igniteContext(context={},source){
 const tags=(context.tags??[]).filter(t=>!['hit','projectile','attack','spell'].includes(t));
 if(source==='attack'||source==='spell')tags.push(source);
 return {...context,tags};
}
export function igniteFromPackets(packets,modifiers,context={},critical=false,multiplierOverride){
 const isMinion=context.tags?.includes('minion');
 let rate=0;
 for(const p of packets.filter(p=>p.type==='fire')){
 const keys=[...new Set(['damage','damageOverTime','elementalDamage','burningDamage','igniteDamage',...p.history.map(t=>t+'Damage')])];
 const b=modifiers.breakdown(keys,context);
 const d=modifiers.breakdown(isMinion?['dotMultiplier']:['dotMultiplier','fireDotMultiplier'],context);
 rate+=p.amount*.9*Math.max(0,1+b.increased)*b.multipliers.reduce((x,y)=>x*y,1)*Math.max(0,multiplierOverride??(1+d.flat+(critical?.5:0)));
 }
 const duration=isMinion?1:Math.max(0,modifiers.calculate(1,'igniteDuration',context));
 const faster=isMinion?1:Math.max(.01,1+modifiers.calculate(0,'igniteFaster',context));
 return {rate:rate*faster,duration:4*duration/faster};
}
export function igniteIntervals(instances,start,end){
 const cuts=[start,end,...instances.flatMap(i=>[i.start,i.end]).filter(t=>t>start&&t<end)].sort((a,b)=>a-b);
 return cuts.slice(1).map((to,i)=>({start:cuts[i],end:to,rate:Math.max(0,...instances.filter(x=>x.start<=cuts[i]&&x.end>cuts[i]).map(x=>x.rate))}));
}
