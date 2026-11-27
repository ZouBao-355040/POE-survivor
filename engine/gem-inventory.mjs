import {SocketBoard} from './sockets.mjs';
import {chooseReward} from './rewards.mjs';
export class GemInventory{
 constructor(board=new SocketBoard()){this.board=board;this.owned=new Map();this.selected=null;for(const g of Object.values(board.groups).flat().filter(Boolean))this.owned.set(g.id,g);}
 acquire(gem){if(this.owned.has(gem.id))throw new Error('Gem already owned');const instance={...gem,instanceId:gem.id};this.owned.set(gem.id,instance);return instance;}
 claim(state,id){const result=chooseReward(state,id);this.acquire(result.gem);return result.state;}
 equip(id,group,index){const gem=this.owned.get(id);if(!gem)throw new Error('Gem not owned');this.board.check(group,index);for(const [from,slots] of Object.entries(this.board.groups)){const i=slots.findIndex(g=>g?.instanceId===gem.instanceId);if(i>=0){this.board.move(from,i,group,index);return;}}this.board.insert(group,index,gem);this.validateSelection();}
 unequip(group,index){this.board.remove(group,index);this.validateSelection();}
 validateSelection(){if(this.selected&&!Object.values(this.board.groups).flat().some(g=>g?.instanceId===this.selected))this.selected=null;}
 select(id){this.board.linked(id);this.selected=id;}
 current(){this.validateSelection();return this.selected?this.board.linked(this.selected):null;}
 ownedIds(){return [...this.owned.keys()];}
}
