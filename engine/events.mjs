export class CombatEvents {
 #time=0; #paused=false; #last=new Map(); #listeners=new Map();
 get time(){return this.#time;}
 pause(value=true){this.#paused=Boolean(value);}
 advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid time');if(!this.#paused)this.#time+=seconds;}
 emit(type,actor,payload={}){
 if(this.#paused)throw new Error('Simulation paused');
 const event=Object.freeze({...payload,type,actor,time:this.#time});
 if(!this.#last.has(actor))this.#last.set(actor,new Map());
 this.#last.get(actor).set(type,this.#time);
 for(const fn of [...(this.#listeners.get(type)??[])])fn(event);
 return event;
 }
 on(type,fn){if(!this.#listeners.has(type))this.#listeners.set(type,new Set());const set=this.#listeners.get(type);set.add(fn);return ()=>set.delete(fn);}
 recently(actor,type,seconds=4){const t=this.#last.get(actor)?.get(type);return t!==undefined&&this.#time-t<seconds;}
 conditions(actor,state){
 const ratio=state.maximumLife>0?state.life/state.maximumLife:0;
 return {fullLife:ratio>=1,lowLife:ratio<=.5,moving:!!state.moving,stationary:!state.moving,hitRecently:this.recently(actor,'hit'),killedRecently:this.recently(actor,'kill'),critRecently:this.recently(actor,'criticalHit'),beenHitRecently:this.recently(actor,'receivedHit')};
 }
}
