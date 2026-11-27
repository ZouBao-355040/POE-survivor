export class BuffPool {
 constructor(){this.entries=new Map();}
 apply({id,source,duration=Infinity,modifiers=[],strength=1,policy='strongest'},time){
 if(!id||!source||!Number.isFinite(time)||!(duration>0)||!Number.isFinite(strength)||!['strongest','stack','refresh'].includes(policy))throw new Error('Invalid buff');
 const key=JSON.stringify([id,source]);const previous=this.entries.get(key);
 if(previous&&previous.expires>time&&previous.policy!==policy)throw new Error('Conflicting policy');
 this.entries.set(key,{id,source,modifiers,strength,policy,expires:time+duration});
 }
 remove(id,source){this.entries.delete(JSON.stringify([id,source]));}
 active(time){
 const groups=new Map();
 for(const [key,e] of this.entries){if(e.expires<=time){this.entries.delete(key);continue;}const g=groups.get(e.id)??[];g.push(e);groups.set(e.id,g);}
 return [...groups.values()].flatMap(g=>{if(g.some(e=>e.policy!==g[0].policy))throw new Error('Conflicting buff policies');return g[0].policy==='stack'?g:[g.reduce((a,b)=>b.strength>a.strength?b:a)];});
 }
 sync(store,time){
 store.replace('system:buffs',this.active(time).flatMap(e=>e.modifiers));
 }
}
export const onslaughtModifiers=[{stat:'attackSpeed',kind:'increased',value:.2},{stat:'castSpeed',kind:'increased',value:.2},{stat:'movementSpeed',kind:'increased',value:.2}];
