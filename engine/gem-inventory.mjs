import {SocketBoard} from './sockets.mjs?v=0.5.2';
import {effectiveSupports} from './skill.mjs';
import {gemProgress,withGemLevel} from './gem-growth.mjs';
import {chooseReward} from './rewards.mjs';
export const createGemInstance=gem=>({...gem,instanceId:gem.id,level:gem.level??1,experience:0});
export class GemInventory{
 constructor(board=new SocketBoard()){this.board=board;this.owned=new Map();this.selected=null;for(const g of Object.values(board.groups).flat().filter(Boolean))this.owned.set(g.id,g);}
 acquire(gem){if(this.owned.has(gem.id))throw new Error('Gem already owned');const instance=createGemInstance(gem);this.owned.set(gem.id,instance);return instance;}
 claim(state,id){const result=chooseReward(state,id);this.acquire(result.gem);return result.state;}
 equip(id,group,index){const gem=this.owned.get(id);if(!gem)throw new Error('Gem not owned');this.board.check(group,index);for(const [from,slots] of Object.entries(this.board.groups)){const i=slots.findIndex(g=>g?.instanceId===gem.instanceId);if(i>=0){this.board.move(from,i,group,index);return;}}this.board.insert(group,index,gem);this.validateSelection();}
 unequip(group,index){this.board.remove(group,index);this.validateSelection();}
 validateSelection(){if(this.selected&&!Object.values(this.board.groups).flat().some(g=>g?.instanceId===this.selected))this.selected=null;}
 select(id){this.board.linked(id);this.selected=id;}
 current(){this.validateSelection();if(!this.selected)return null;const {active,supports}=this.board.linked(this.selected);return {active:withGemLevel(active),supports:supports.map(withGemLevel)};}
 grantExperience(amount,characterLevel){
  this.validateSelection();if(!this.selected)return [];
  const {active,supports}=this.board.linked(this.selected);
  const ups=[];
  for(const g of [active,...effectiveSupports(active,supports)]){
   const next=gemProgress(g,amount,characterLevel);
   this.owned.set(g.id,next);
   for(const slots of Object.values(this.board.groups)){const i=slots.indexOf(g);if(i>=0)slots[i]=next;}
   if(next.level>g.level)ups.push(next);
  }
  return ups;
 }
 setLayout(layout){this.board.setLayout(layout);this.validateSelection();}
 ownedIds(){return [...this.owned.keys()];}
}
