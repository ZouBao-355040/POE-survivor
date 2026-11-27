export const bowLayout={weapon:6,body:6,helmet:4,gloves:4,boots:4};
export class SocketBoard{
 constructor(layout=bowLayout){this.groups={};this.setLayout(layout);}
 setLayout(layout){
  const next=Object.fromEntries(Object.entries(layout).map(([k,n])=>[k,Array.from({length:n},(_,i)=>this.groups[k]?.[i]??null)]));
  this.groups=next;
 }
 check(group,index){if(!this.groups[group]||!Number.isInteger(index)||index<0||index>=this.groups[group].length)throw new RangeError('Invalid socket');}
 insert(group,index,gem){this.check(group,index);if(!gem?.instanceId||!['active','support'].includes(gem.kind))throw new Error('Invalid gem');for(const slots of Object.values(this.groups))if(slots.some(g=>g?.instanceId===gem.instanceId))throw new Error('Gem already socketed');const old=this.groups[group][index];this.groups[group][index]=gem;return old;}
 remove(group,index){this.check(group,index);const old=this.groups[group][index];this.groups[group][index]=null;return old;}
 move(from,i,to,j){this.check(from,i);this.check(to,j);const a=this.groups[from][i];this.groups[from][i]=this.groups[to][j];this.groups[to][j]=a;}
 linked(instanceId){for(const slots of Object.values(this.groups)){const active=slots.find(g=>g?.instanceId===instanceId&&g.kind==='active');if(active)return {active,supports:slots.filter(g=>g?.kind==='support')};}throw new Error('Active gem not socketed');}
}
