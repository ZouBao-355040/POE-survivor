import {compatible} from './skill.mjs';
export function rewardOptions({kind,catalog,board,ownedIds=[],random=Math.random}){
 if(!['active','support'].includes(kind))throw new Error('Invalid reward kind');
 const actives=Object.values(board.groups).flat().filter(g=>g?.kind==='active');
 const pool=[...new Map(catalog.filter(g=>g.kind===kind&&!ownedIds.includes(g.id)&&(kind==='active'||actives.some(a=>compatible(a,g)))).map(g=>[g.id,g])).values()];
 const result=[];while(pool.length&&result.length<3){const roll=random();if(!(roll>=0&&roll<1))throw new RangeError('Invalid random sample');result.push(pool.splice(Math.floor(roll*pool.length),1)[0]);}return result;
}
export function beginReward(state,kind,config){if(!(state.pendingChoices>0)||state.reward)throw new Error('No available reward');const options=rewardOptions({...config,kind});if(!options.length)throw new Error('No eligible gems');return {...state,reward:{kind,options}};}
export function chooseReward(state,id){const gem=state.reward?.options.find(g=>g.id===id);if(!gem||!(state.pendingChoices>0))throw new Error('Invalid reward');return {state:{...state,pendingChoices:state.pendingChoices-1,reward:null},gem};}
