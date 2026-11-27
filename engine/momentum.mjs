// Level 1 Momentum Support, PoE Wiki and PoEDB.
export const momentumSupport={id:'momentum',kind:'support',requiresAll:['attack'],excludes:['triggered'],costMultiplier:1.1};
export class Momentum{
 constructor({perStack=.15,maxStacks=3,duration=1.5}={}){this.perStack=perStack;this.maxStacks=maxStacks;this.duration=duration;this.stacks=0;this.swiftnessUntil=0;this.swiftnessEffect=0;}
 move(){this.stacks=0;}
 use(time){const stacks=++this.stacks;const increasedAttackSpeed=stacks*this.perStack;if(stacks>=this.maxStacks){this.stacks=0;this.swiftnessUntil=time+this.duration;this.swiftnessEffect=stacks*.15;}return increasedAttackSpeed;}
 movementSpeed(time){return time<this.swiftnessUntil?this.swiftnessEffect:0;}
}
