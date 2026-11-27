export function grantExperience(state,amount,required){
 if(!Number.isFinite(amount)||amount<0)throw new RangeError('Invalid experience');
 let {level=1,experience=0,passivePoints=0,pendingChoices=0}=state;
 experience+=amount;
 while(true){const cost=required(level);if(!Number.isFinite(cost)||cost<=0)throw new RangeError('Invalid level threshold');if(experience<cost)break;experience-=cost;level++;passivePoints++;pendingChoices++;}
 return {...state,level,experience,passivePoints,pendingChoices};
}
export function resolveLevelChoice(state){if(!(state.pendingChoices>0))throw new Error('No pending choice');return {...state,pendingChoices:state.pendingChoices-1};}
