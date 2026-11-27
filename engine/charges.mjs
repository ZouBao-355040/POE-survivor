export const chargeTypes=['frenzy','endurance','power'];
export class Charges {
 constructor(){this.state=Object.fromEntries(chargeTypes.map(t=>[t,{count:0,expires:0}]));}
 update(type,time,{maximum=3,minimum=0}={}){
 if(!chargeTypes.includes(type)||!Number.isFinite(time)||!Number.isInteger(maximum)||!Number.isInteger(minimum)||minimum<0||maximum<minimum)throw new RangeError('Invalid charge state');
 const s=this.state[type];s.count=Math.min(maximum,Math.max(minimum,time>=s.expires?minimum:s.count));return s.count;
 }
 gain(type,time,amount=1,{maximum=3,minimum=0,duration=10}={}){
 if(!Number.isInteger(amount)||amount<0||!Number.isFinite(duration)||duration<0)throw new RangeError('Invalid gain');
 const count=this.update(type,time,{maximum,minimum});const s=this.state[type];s.count=Math.min(maximum,count+amount);if(amount>0)s.expires=time+duration;return s.count;
 }
 consume(type,time,amount=1,limits={}){
 if(!Number.isInteger(amount)||amount<0)throw new RangeError('Invalid consumption');
 const count=this.update(type,time,limits);if(count-(limits.minimum??0)<amount)return false;this.state[type].count-=amount;return true;
 }
 snapshot(time,limits={}){return Object.fromEntries(chargeTypes.map(t=>[t,this.update(t,time,limits[t])]));}
}
export function chargeEffects({frenzy=0,endurance=0,power=0}={}){
 return {increasedAttackSpeed:.04*frenzy,increasedCastSpeed:.04*frenzy,moreDamage:1+.04*frenzy,additionalPhysicalReduction:.04*endurance,additionalElementalReduction:.04*endurance,increasedCriticalChance:.5*power};
}
