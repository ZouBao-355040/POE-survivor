// Baseline leech defaults; special modifiers and patch parity require verification.
export class LeechPool {
 constructor(){this.instances=[];}
 add(damage,fraction,maximum,{instanceCap=.1,instanceRate=.02}={}){
 const amount=Math.min(Math.max(0,damage*fraction),maximum*instanceCap);
 if(amount>0&&instanceRate>0&&maximum>0)this.instances.push({remaining:amount,rate:maximum*instanceRate});
 }
 advance(dt,current,maximum,{totalRate=.2,recoveryMultiplier=1,retainAtFull=false}={}){
 if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid time');
 if(current>=maximum&&!retainAtFull){this.instances=[];return current;}
 let remaining=dt;
 while(remaining>1e-10&&this.instances.length){
 const step=Math.min(remaining,...this.instances.map(x=>x.remaining/x.rate));
 const rate=Math.min(maximum*totalRate,this.instances.reduce((s,x)=>s+x.rate,0))*recoveryMultiplier;
 current=Math.min(maximum,current+rate*step);
 for(const x of this.instances)x.remaining=Math.max(0,x.remaining-x.rate*step);
 this.instances=this.instances.filter(x=>x.remaining>1e-9);
 remaining-=step;
 if(current>=maximum&&!retainAtFull){this.instances=[];break;}
 }return current;
 }
}
export function regenerate(current,maximum,rate,dt){return Math.min(maximum,Math.max(0,current+rate*dt));}
export function rechargeShield(current,maximum,elapsedSinceInterrupt,dt,{delay=2,rate=.33}={}){
 const active=Math.max(0,Math.min(dt,elapsedSinceInterrupt-delay));
 return regenerate(current,maximum,maximum*rate,active);
}
export function instantRecovery(current,maximum,amount){return Math.min(maximum,current+Math.max(0,amount));}
