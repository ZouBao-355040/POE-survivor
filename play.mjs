import {stepWorld} from './engine/game-loop.mjs';
import {rangerHooks,trainingWeaponFor} from './engine/ranger.mjs';
import {ModifierStore} from './engine/modifiers.mjs';
import {GemInventory} from './engine/gem-inventory.mjs';
import {beginReward,rewardOptions} from './engine/rewards.mjs';
import {catalog,gemById,researchIndex} from './engine/projectile-catalog.mjs';
import {gemLevelCap,gemXpRequired} from './engine/gem-growth.mjs';
import {compatible} from './engine/skill.mjs';
import {resolveLevelChoice} from './engine/progression.mjs';

const $=s=>document.querySelector(s);
const panel=$('#gem-panel'),toggle=$('#gems'),canvas=$('canvas'),ctx=canvas.getContext('2d'),status=$('#status'),reward=$('#reward');
const modifiers=new ModifierStore(),enemyModifiers=new ModifierStore();
const names={Bow:'弓',Wand:'法杖',Claw:'爪',Shield:'盾牌','One Hand Sword':'單手劍','One Hand Axe':'單手斧',Unarmed:'空手'};
const socketNames={weapon:'武器',body:'胸甲',helmet:'頭盔',gloves:'手套',boots:'鞋子'};
const gemName=id=>gemById.get(id)?.name??'普通攻擊';
const enabled=()=>!panel.open&&!state.dead&&!(state.progression.pendingChoices>0);
const div=(txt,cls)=>{const n=document.createElement('div');n.textContent=txt;if(cls)n.className=cls;return n;};
const button=(txt,fn,options={})=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.onclick=fn;
 if(options.selected!==undefined)b.setAttribute('aria-pressed',options.selected);
 if(options.title)b.title=options.title;
 if(options.className)b.className=options.className;
 return b;};
const heading=(txt,h='h2')=>{const node=document.createElement(h);node.textContent=txt;return node;};
function card(g,fn,selected=false,training=false){
 const b=button(g.name+(training?'':' · 等級 '+(g.level??1)),fn,{selected,className:'gem-card'});
 if(g.description){const details=document.createElement('small');details.textContent=g.description;b.append(details);}
 if(!training&&g.experience!==undefined){const xp=document.createElement('small');xp.textContent=(g.level??1)>=gemLevelCap?'已達最高等級':'經驗 '+g.experience+'/'+gemXpRequired(g.level??1);b.append(xp);}
 return b;
}
let inventory,hooks,state,picked=null,tab='owned',search='',filter='all';
let dir={x:0,y:0},origin=null,last=performance.now(),acc=0,toastUntil=0;
const keys=new Set();
function clearInput(){keys.clear();origin=null;dir={x:0,y:0};}
function notify(message){$('#toast').textContent=message;toastUntil=(state.time??0)+3;}
function reset(){
 inventory=new GemInventory();
 for(const [id,i] of [['burning-arrow',0],['momentum',1]]){
  inventory.acquire(gemById.get(id)); inventory.equip(id,'weapon',i);
 }
 inventory.select('burning-arrow');picked=null;tab='owned';if(panel.open)panel.close();
 clearInput();acc=0;hooks=rangerHooks({modifiers,inventory});
 state={player:{x:0,y:0,speed:4,attackRange:12,life:70,maximumLife:70,mana:58,maximumMana:58,energyShield:0,accuracy:90,evasion:15,defence:{}},
  enemies:[],projectiles:[],time:0,progression:{level:1},kills:0};
 $('#toast').textContent='';reward.hidden=true;
}
function closeGems(){if(panel.open)panel.close();state={...state,paused:false};acc=0;clearInput();toggle.focus();}
function openGems(){state={...state,paused:true};acc=0;clearInput();renderGems();panel.showModal();}
toggle.onclick=openGems;
panel.addEventListener('cancel',e=>{e.preventDefault();closeGems();});
function renderGems(){
 panel.replaceChildren();
 const top=div('','panel-top');const title=heading('寶石背包 · 戰鬥已暫停');title.id='gem-title';
 top.append(title,button('關閉',closeGems));panel.append(top);
 const tabs=div('','toolbar');
 for(const [k,n] of [['owned','插槽與寶石'],['library','PoE 寶石圖鑑'],['practice','技能試射']])tabs.append(button(n,()=>{tab=k;search='';filter='all';renderGems();},{selected:tab===k}));
 panel.append(tabs);
 if(tab!=='owned'){renderLibrary();return;}
 panel.append(div('先點持有寶石，再點同組插槽。再點已插上的主動寶石可切換自動施放。只有相容的同組輔助會生效並獲得經驗。','muted'));
 const current=inventory.current(),chosen=current?.active;
 const row=div('','gem-row');
 row.append(heading('目前技能：'+(chosen?chosen.name+' · 等級 '+chosen.level:'普通攻擊'),'h3'));
 if(chosen){
  const applicable=current.supports.filter(s=>compatible(chosen,s));
  row.append(div((chosen.tags.includes('spell')?'法術 · 施放速度':'訓練武器：'+(names[trainingWeaponFor(chosen)]??'弓')+' · 攻擊速度')+' · 生效輔助：'+(applicable.map(s=>s.name).join('、')||'無'),'muted'));
 }
 panel.append(row,heading('持有寶石','h3'));
 const gems=div('','button-row');for(const [id,g] of inventory.owned)gems.append(card(g,()=>{picked=picked===id?null:id;renderGems();},picked===id));
 panel.append(gems,heading('裝備插槽','h3'));
 for(const [group,slots] of Object.entries(inventory.board.groups)){
  const wrapper=div('','gem-row'),row=div('','button-row');wrapper.append(heading(socketNames[group],'h3'));
  slots.forEach((g,i)=>{
   row.append(button(g?g.name+' '+g.level:'○',()=>{
    if(picked){inventory.equip(picked,group,i);picked=null;}
    else if(g?.kind==='active')inventory.select(g.id);
    else if(g)inventory.unequip(group,i);
    renderGems();
   },{selected:g?.id===inventory.selected,title:g?.description??socketNames[group]+'第 '+(i+1)+' 格',className:'socket'}));
  });
  wrapper.append(row);panel.append(wrapper);
 }
 const tools=div('','button-row');
 for(const g of Object.values(inventory.board.groups).flat().filter(g=>g?.kind==='active')){
  tools.append(button('卸下 '+g.name,()=>{for(const [group,slots] of Object.entries(inventory.board.groups)){const i=slots.findIndex(x=>x?.id===g.id);if(i>=0){inventory.unequip(group,i);break;}}renderGems();}));
 }
 if(tools.children.length)panel.append(tools);
}
function practice(id){
 const active=gemById.get(id);if(active.kind!=='active')return;
 closeGems();reset();
 inventory=new GemInventory();inventory.acquire(active);inventory.equip(active.id,'weapon',0);inventory.select(active.id);hooks=rangerHooks({modifiers,inventory});
 state.practice=true;
 for(const candidate of catalog.filter(s=>s.kind==='support'&&compatible(active,s)))inventory.acquire(candidate);
 state.enemies=[{id:'dummy-1',x:6,y:0,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0},
 {id:'dummy-2',x:8,y:1.75,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0},
 {id:'dummy-3',x:8,y:-1.75,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0}];
 notify('試射場：'+active.name+'。重開可回到生存模式。');
}
function renderLibrary(){
 const text=tab==='practice'?'用木樁試射任一已接入技能，並從背包搭配相容輔助。開始會結束這一局。':'收錄 PoE 1 3.30 投射物主動寶石及直接相關的輔助。這是倖存者版改編，並非原作逐項數值複製。';
 panel.append(div(text,'muted'));
 const toolbar=div('','toolbar'),input=document.createElement('input');input.type='search';input.placeholder='搜尋繁中或英文名稱';input.value=search;input.setAttribute('aria-label','搜尋寶石');
 toolbar.append(input);
 const result=div('','library-list'),summary=div('','muted');
 function refresh(){
  const q=search.trim().toLowerCase(),isPractice=tab==='practice';
  const list=researchIndex.filter(g=>(!isPractice||(g.playable&&!g.support))&&(filter==='all'||(filter==='active'&&!g.support)||(filter==='support'&&g.support)||(filter==='enabled'&&g.playable))&&(!q||[g.zh,g.en].some(n=>n.toLowerCase().includes(q))));
  summary.textContent=list.length+' 筆結果';
  result.replaceChildren();
  for(const rec of list){
   if(isPractice){const g=catalog.find(x=>x.sourceKey===rec.key);result.append(card(g,()=>practice(g.id),false,true));continue;}
   const item=div('','index-item'),title=document.createElement('a');title.href='https://poedb.tw/tw/'+rec.slug;title.target='_blank';title.rel='noopener noreferrer';title.textContent=rec.zh;
   const details=document.createElement('small');details.textContent=(rec.support?'輔助':'主動')+' · '+(rec.playable?'已接入':'僅圖鑑')+' · '+rec.en;item.append(title,details);result.append(item);
  }
 }
 if(tab==='library')for(const [k,n] of [['all','全部'],['active','主動'],['support','輔助'],['enabled','已接入']])toolbar.append(button(n,()=>{filter=k;for(const b of toolbar.querySelectorAll('button'))b.setAttribute('aria-pressed',b.textContent===n);refresh();},{selected:filter===k}));
 input.addEventListener('input',()=>{search=input.value;refresh();});panel.append(toolbar,summary,result);refresh();
}
function chooseReward(){const p=state.progression;reward.replaceChildren(heading('等級 '+p.level+' · 選擇寶石'));
 if(p.reward){for(const g of p.reward.options)reward.append(card(g,()=>{
  state.progression=inventory.claim(p,g.id);
  if(state.progression.pendingChoices>0)chooseReward();else reward.hidden=true;
  notify('已取得 '+g.name+'，可從寶石背包裝備。');
 },false,true));return;}
 const config={catalog,board:inventory.board,ownedIds:inventory.ownedIds()};
 for(const [kind,label] of [['active','主動寶石'],['support','相容輔助']])if(rewardOptions({...config,kind}).length)reward.append(button(label,()=>{state.progression=beginReward(p,kind,config);chooseReward();}));
 reward.append(button('略過，繼續戰鬥',()=>{state.progression=resolveLevelChoice(p);if(state.progression.pendingChoices>0)chooseReward();else reward.hidden=true;}));
}
reset();
$('#restart').onclick=reset;
addEventListener('keydown',e=>{
 if(!enabled())return;
 if(e.key.toLowerCase()==='i'){openGems();return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
 keys.add(e.key.toLowerCase());
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',clearInput);
canvas.onpointerdown=e=>{if(!enabled()||origin)return;origin={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(origin?.id===e.pointerId)dir={x:(e.clientX-origin.x)/40,y:(e.clientY-origin.y)/40};};
canvas.onlostpointercapture=canvas.onpointerup=canvas.onpointercancel=e=>{if(origin?.id===e.pointerId){origin=null;dir={x:0,y:0};}};
function simulate(){
 const direction=origin?dir:{x:Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a')),
  y:Number(keys.has('arrowdown')||keys.has('s'))-Number(keys.has('arrowup')||keys.has('w'))};
 const round=Math.floor((state.time??0)/24),hp=Math.round(24*Math.pow(1.18,round));
 state=stepWorld(state,.02,{...hooks,direction,manaRegen:state.practice?22:2.85,enemyModifiers,spawnInterval:Math.max(.43,1.18-round*.055),
  spawnRadius:12,experienceRequired:l=>24+l*13,enemyStats:state.practice?null:{life:hp,maximumLife:hp,evasion:10,accuracy:50,defence:{},speed:1.85+Math.min(1.8,round*.13),attackRange:.7,experienceReward:10+Math.floor(round/2),
   attack:{baseDamage:{physical:4+round},attacksPerSecond:1,criticalChance:0}}});
 for(const ev of state.events){
  if(ev.type==='kill'){
   state.kills++;
   const ups=inventory.grantExperience(ev.experience,state.progression.level);
   if(ups.length)notify(ups.map(g=>g.name+' 升到 '+g.level+' 級').join('、'));
  }
 }
 if(!enabled())clearInput();
}
function render(){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const p=state.player,scale=Math.min(w,h)/23;
 ctx.fillStyle='#171c20';ctx.fillRect(0,0,w,h);
 const point=o=>[w/2+(o.x-p.x)*scale,h/2+(o.y-p.y)*scale];
 function dot(o,r,c){const [x,y]=point(o);ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r*scale,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle='#263036';ctx.lineWidth=1;
 ctx.beginPath();
 for(let x=(-p.x*scale+w/2)%(scale*2);x<w;x+=scale*2){ctx.moveTo(x,0);ctx.lineTo(x,h);}
 for(let y=(-p.y*scale+h/2)%(scale*2);y<h;y+=scale*2){ctx.moveTo(0,y);ctx.lineTo(w,y);}
 ctx.stroke();
 for(const f of state.fields??[]){
  const [x,y]=point(f);if(f.beamTo){const [bx,by]=point(f.beamTo);ctx.strokeStyle='#d8c9ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.stroke();continue;}ctx.globalAlpha=f.visual?.34:.23;ctx.fillStyle=f.color??'#b7d879';ctx.beginPath();ctx.arc(x,y,(f.radius??1)*scale,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 }
 for(const e of state.enemies){dot(e,e.radius??.35,e.frozenUntil>state.time?'#b2e9ff':e.ignites?.length?'#e88939':e.dots?.length?'#aecc71':'#ad5d63');const [x,y]=point(e);ctx.fillStyle='#d98187';ctx.fillRect(x-8,y-10,16*Math.max(0,e.life/e.maximumLife),3);}
 for(const a of state.projectiles){
  if(a.delay>0)continue;
  const [x,y]=point(a);if(a.noCollision&&a.pulseEvery){ctx.globalAlpha=.17;dot(a,.9,a.color);ctx.globalAlpha=1;dot(a,.25,a.color);continue;}
  ctx.strokeStyle=a.color??'#ffd18a';ctx.lineWidth=a.returning?1.4:2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-a.dx*scale*.65,y-a.dy*scale*.65);ctx.stroke();
  if(a.skill.source==='spell')dot(a,.15,a.color);
 }
 dot(p,.43,p.life<=0?'#685761':'#9ac7a2');
 let phase=0;
 for(const [k,n] of Object.entries(hooks.charges.snapshot(state.time))){for(let i=0;i<n;i++){const a=state.time*1.9+(phase++)*1.9;dot({x:p.x+.91*Math.cos(a),y:p.y+.91*Math.sin(a)},.12,{power:'#a5bdff',frenzy:'#80db8c',endurance:'#e88985'}[k]);}}
 $('#life').value=p.life/p.maximumLife;$('#life-num').textContent=Math.ceil(p.life)+'/'+p.maximumLife;
 $('#mana').value=p.mana/p.maximumMana;$('#mana-num').textContent=Math.floor(p.mana)+'/'+p.maximumMana;
 const n=Math.floor(state.time??0);
 status.textContent=(state.practice?'試射場 · ':'')+'等級 '+state.progression.level+' · '+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')+' · 擊殺 '+state.kills+(state.dead?' · 已死亡':'');
 const selected=inventory.current()?.active;
 $('#hint').textContent=(selected?selected.name+' 等級 '+selected.level:'普通攻擊')+' · 拖曳或 WASD 移動';
 if(state.time>=toastUntil)$('#toast').textContent='';
 const showReward=state.progression.pendingChoices>0&&!state.dead;
 if(showReward&&reward.hidden)chooseReward();
 reward.hidden=!showReward;
}
function frame(now){
 try{
  if(enabled())acc+=Math.min(.1,Math.max(0,(now-last)/1000));else acc=0;
  last=now;
  while(acc>=.02&&enabled()){simulate();acc-=.02;}
  render();requestAnimationFrame(frame);
 }catch(e){status.textContent='引擎錯誤';console.error(e);}
}
requestAnimationFrame(frame);
