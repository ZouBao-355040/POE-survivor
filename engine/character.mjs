import {ModifierStore} from './modifiers.mjs';
export const classAttributes=Object.freeze({Ranger:[14,32,14],Marauder:[32,14,14],Witch:[14,14,32],Duelist:[23,23,14],Templar:[23,14,23],Shadow:[14,23,23],Scion:[20,20,20]});
// Baseline PoE 1 assumptions; patch-specific rounding still requires verification.
export class Character {
 constructor(className='Ranger',level=1){if(!classAttributes[className])throw new RangeError('Unknown class');this.className=className;this.level=level;this.modifiers=new ModifierStore();}
 snapshot(context={}){
 if(!Number.isInteger(this.level)||this.level<1||this.level>100)throw new RangeError('Invalid level');
 const m=this.modifiers,c=(base,stat)=>m.calculate(base,stat,context);
 const [s,d,i]=classAttributes[this.className];
 const strength=Math.floor(c(s,'strength')),dexterity=Math.floor(c(d,'dexterity')),intelligence=Math.floor(c(i,'intelligence'));
 const derived=new ModifierStore();
 derived.replace('attributes',[
 {stat:'evasion',kind:'increased',value:Math.floor(dexterity/5)*.01},
 {stat:'energyShield',kind:'increased',value:Math.floor(intelligence/5)*.01}
 ]);
 const defence=(base,stat)=>{const b=m.breakdown(stat,context),a=derived.breakdown(stat);return b.override??Math.floor(Math.max(0,(base+b.flat)*(1+b.increased+a.increased)*b.multipliers.reduce((x,y)=>x*y,1)));};
 return {strength,dexterity,intelligence,maximumLife:Math.floor(c(38+12*this.level+Math.floor(strength/2),'maximumLife')),maximumMana:Math.floor(c(34+6*this.level+Math.floor(intelligence/2),'maximumMana')),accuracy:Math.floor(c(2*dexterity+2*this.level,'accuracy')),meleePhysicalIncrease:Math.floor(strength/5)*.01,evasion:defence(15,'evasion'),energyShield:defence(0,'energyShield'),armour:Math.floor(c(0,'armour'))};
 }
}
