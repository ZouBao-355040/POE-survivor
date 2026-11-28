import {mitigateDot} from './dot.mjs';

// Applications expire independently. Do not discard a weaker one merely
// because it is currently out of the top one/eight: it may outlast the others.
export function integrateBleed(instances,start,end,movingUntil=start,defender={}){
 if(!instances.length||end<=start)return 0;
 const cuts=[...new Set([start,end,movingUntil,...instances.flatMap(i=>[i.start,i.end])])]
  .filter(t=>t>=start&&t<=end).sort((a,b)=>a-b);
 let damage=0;
 for(let n=0;n+1<cuts.length;n++){
  const t=cuts[n],span=cuts[n+1]-t;
  const active=instances.filter(i=>i.start<=t&&i.end>t);
  const limit=active.some(i=>i.crimson)?8:1;
  const rates=active.map(i=>i.rate*(i.crimson?1:t<movingUntil||i.aggravated?3:1)).sort((a,b)=>b-a);
  const rate=rates.slice(0,limit).reduce((a,b)=>a+b,0);
  damage+=mitigateDot({physical:rate},defender).physical*span;
 }
 return damage;
}
