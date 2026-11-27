import {SocketBoard} from './sockets.mjs?v=0.5.4';
import {effectiveSupports} from './skill.mjs?v=0.5.14';
import {gemProgress,withGemLevel} from './gem-growth.mjs';
import {chooseReward} from './rewards.mjs';
export const createGemInstance=gem=>({...gem,instanceId:gem.id,level:gem.level??1,experience:0});
export class GemInventory{
 constructor(board=new SocketBoard()){this.board=board;this.owned=new Map();this.selected=null;this.automatic=new Set();this.manual=null;for(const g of Object.values(board.groups).flat().filter(Boolean))this.owned.set(g.id,g);}
 acquire(gem){if(this.owned.has(gem.id))throw new Error('Gem already owned');const instance=createGemInstance(gem);this.owned.set(gem.id,instance);return instance;}
 claim(state,id){const result=chooseReward(state,id);this.acquire(result.gem);return result.state;}
 equip(id,group,index){const gem=this.owned.get(id);if(!gem)throw new Error('Gem not owned');this.board.check(group,index);for(const [from,slots] of Object.entries(this.board.groups)){const i=slots.findIndex(g=>g?.instanceId===gem.instanceId);if(i>=0){this.board.move(from,i,group,index);return;}}this.board.insert(group,index,gem);this.validateSelection();}
 unequip(group,index){this.board.remove(group,index);this.validateSelection();}
 validateSelection(){
  const socketed=new Set(Object.values(this.board.groups).flat().filter(g=>g?.kind==='active').map(g=>g.id));
  for(const id of this.automatic)if(!socketed.has(id))this.automatic.delete(id);
  if(this.manual&&!socketed.has(this.manual))this.manual=null;
  if(!socketed.has(this.selected))this.selected=[...this.automatic].at(-1)??this.manual??null;
 }
 select(id){this.board.linked(id);this.selected=id;}
 mode(id){return id===this.manual?'manual':this.automatic.has(id)?'auto':'off';}
 setMode(id,mode){
  this.board.linked(id);
  if(!['auto','manual','off'].includes(mode))throw new Error('Invalid cast mode');
  if(this.manual===id)this.manual=null;
  this.automatic.delete(id);
  if(mode==='manual'){
   if(this.manual)this.automatic.add(this.manual);
   this.manual=id;
  }else if(mode==='auto')this.automatic.add(id);
  if(mode!=='off')this.selected=id;
  else if(this.selected===id)this.selected=[...this.automatic].at(-1)??this.manual??null;
 }
 linked(id){const {active,supports}=this.board.linked(id);return {active:withGemLevel(active),supports:supports.map(withGemLevel)};}
 current(){this.validateSelection();return this.selected?this.linked(this.selected):null;}
 castPlan(){this.validateSelection();return {auto:[...this.automatic].map(id=>this.linked(id)),manual:this.manual?this.linked(this.manual):null};}
 grantExperience(amount,characterLevel){
  this.validateSelection();
  const ids=this.automatic.size||this.manual?[...this.automatic,...(this.manual?[this.manual]:[])]:this.selected?[this.selected]:[];
  const eligible=new Map();
  for(const id of ids){
   const {active,supports}=this.board.linked(id);
   for(const gem of [active,...effectiveSupports(active,supports)])eligible.set(gem.id,gem);
  }
  const ups=[];
  for(const g of eligible.values()){
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
