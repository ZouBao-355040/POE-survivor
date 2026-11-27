import {stepWorld} from './engine/game-loop.mjs';
import {rangerHooks} from './engine/ranger.mjs';
import {ModifierStore} from './engine/modifiers.mjs';
import {GemInventory} from './engine/gem-inventory.mjs';
import {burningArrow} from './engine/starter-data.mjs';
import {momentumSupport} from './engine/momentum.mjs';
import {beginReward,rewardOptions} from './engine/rewards.mjs';
const gemNames={'split-arrow':'分裂箭矢','lesser-multiple-projectiles':'低階多重投射輔助','greater-multiple-projectiles':'高階多重投射輔助','pierce':'穿透輔助','faster-projectiles':'快速投射輔助','burning-arrow':'燃燒箭矢','momentum':'動量輔助','faster-attacks':'快速攻擊輔助','added-cold-damage':'附加冰冷傷害輔助','added-lightning-damage':'附加閃電傷害輔助','basic-bow-attack':'普通攻擊'};
const gemName=id=>gemNames[id]??id;
let inventory;
const catalog=[{id:'split-arrow',kind:'active',level:1,tags:['attack','projectile','bow'],cost:6,weaponDamageMultiplier:1.1,effectiveness:1.1,attackSpeedMultiplier:1,projectileCount:5,projectileSpeed:32.6},{id:'lesser-multiple-projectiles',kind:'support',requiresAll:['projectile'],additionalProjectiles:2,damageMultiplier:.85,costMultiplier:1.3},{id:'greater-multiple-projectiles',kind:'support',requiresAll:['projectile'],additionalProjectiles:4,damageMultiplier:.65,costMultiplier:1.5},{id:'pierce',kind:'support',requiresAll:['projectile'],pierce:2,costMultiplier:1.1},{id:'faster-projectiles',kind:'support',requiresAll:['projectile'],increasedProjectileSpeed:.5,costMultiplier:1.1},burningArrow,momentumSupport,{id:'added-cold-damage',kind:'support',requiresAll:['attack'],addedDamage:{cold:[4,6]},costMultiplier:1.2},{id:'added-lightning-damage',kind:'support',requiresAll:['attack'],addedDamage:{lightning:[1,8]},costMultiplier:1.2},{id:'faster-attacks',kind:'support',requiresAll:['attack'],increasedAttackSpeed:.20,costMultiplier:1.10}];
const panel=document.createElement('section');panel.style.cssText='position:fixed;inset:12% 5%;overflow:auto;background:#20272d;padding:16px;border:1px solid #99845e;z-index:5';panel.hidden=true;document.body.append(panel);
const toggle=document.createElement('button');toggle.textContent='寶石';document.querySelector('header').append(toggle);toggle.onclick=()=>{panel.hidden=!panel.hidden;renderGems();};
let picked=null;
function renderGems(){panel.replaceChildren();const close=document.createElement('button');close.textContent='關閉';close.onclick=()=>panel.hidden=true;panel.append(close);const title=document.createElement('p');title.textContent='選取持有寶石，再點擊插槽裝備。';panel.append(title);
for(const [id,g] of inventory.owned){const b=document.createElement('button');b.textContent=(picked===id?'✓ ':'')+gemName(id);b.onclick=()=>{picked=id;renderGems();};panel.append(b);}
for(const [group,slots] of Object.entries(inventory.board.groups)){const row=document.createElement('p');row.textContent=({weapon:'武器',body:'胸甲',helmet:'頭盔',gloves:'手套',boots:'鞋子'})[group]+' ';slots.forEach((g,i)=>{const b=document.createElement('button');b.textContent=g?gemName(g.id):'○';b.onclick=()=>{if(picked){inventory.equip(picked,group,i);picked=null;}else if(g)inventory.unequip(group,i);renderGems();};row.append(b);});panel.append(row);}
const select=document.createElement('p');select.textContent='目前技能：'+(inventory.selected?gemName(inventory.selected):'普通攻擊')+' ';for(const g of Object.values(inventory.board.groups).flat().filter(g=>g?.kind==='active')){const b=document.createElement('button');b.textContent=gemName(g.id);b.onclick=()=>{inventory.select(g.instanceId);renderGems();};select.append(b);}panel.append(select);}
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),status=document.querySelector('#status'),reward=document.querySelector('#reward');
const modifiers=new ModifierStore(),enemyModifiers=new ModifierStore();
let hooks,state,dir={x:0,y:0},origin=null,last=performance.now(),acc=0;
function reset(){inventory=new GemInventory();inventory.acquire(burningArrow);inventory.acquire(momentumSupport);inventory.equip(burningArrow.id,'weapon',0);inventory.equip(momentumSupport.id,'weapon',1);inventory.select(burningArrow.id);picked=null;panel.hidden=true;hooks=rangerHooks({modifiers,inventory});state={player:{x:0,y:0,speed:4,attackRange:10,life:57,maximumLife:57,mana:47,maximumMana:47,energyShield:0,accuracy:66,evasion:15,defence:{}},enemies:[],projectiles:[],progression:{level:1}};reward.hidden=true;}
reset();
const keys=new Set();addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));
canvas.onpointerdown=e=>{origin={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(origin)dir={x:(e.clientX-origin.x)/40,y:(e.clientY-origin.y)/40};};
canvas.onpointerup=canvas.onpointercancel=()=>{origin=null;dir={x:0,y:0};};
document.querySelector('#restart').onclick=reset;
function renderReward(){const p=state.progression;reward.replaceChildren();const h=document.createElement('h2');h.textContent='升級 · 獲得天賦點';reward.append(h);function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;reward.append(b);}
if(p.reward){for(const g of p.reward.options)button(gemName(g.id),()=>{state.progression=inventory.claim(p,g.id);renderReward();});return;}
let available=0;for(const kind of ['active','support']){const config={catalog,board:inventory.board,ownedIds:inventory.ownedIds()};if(rewardOptions({...config,kind}).length){available++;button(kind==='active'?'主動技能':'輔助技能',()=>{state.progression=beginReward(p,kind,config);renderReward();});}}
if(!available){const msg=document.createElement('p');msg.textContent='目前測試寶石池已全部取得。';reward.append(msg);button('繼續戰鬥',()=>{state.progression={...p,pendingChoices:p.pendingChoices-1};renderReward();});}}

function frame(now){try{
if(panel.hidden){acc+=Math.min(.1,(now-last)/1000);}else{acc=0;origin=null;dir={x:0,y:0};}last=now;
while(acc>=.02){const direction=origin?dir:{x:Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a')),y:Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'))};state=stepWorld(state,.02,{...hooks,direction,manaRegen:.846,enemyModifiers,spawnInterval:1.5,spawnRadius:12,experienceRequired:l=>l*30,enemyStats:{life:35,maximumLife:35,mana:0,energyShield:0,evasion:10,accuracy:50,defence:{},speed:2,attackRange:.7,experienceReward:10,attack:{baseDamage:{physical:5},attacksPerSecond:1,criticalChance:0}}});acc-=.02;}
const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
const p=state.player,scale=Math.min(w,h)/23;
ctx.fillStyle='#171c20';ctx.fillRect(0,0,w,h);
function point(o){return [w/2+(o.x-p.x)*scale,h/2+(o.y-p.y)*scale];}
function dot(o,r,c){const [x,y]=point(o);ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r*scale,0,Math.PI*2);ctx.fill();}
ctx.strokeStyle='#263036';for(let x=(-p.x*scale+w/2)%(scale*2);x<w;x+=scale*2){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=(-p.y*scale+h/2)%(scale*2);y<h;y+=scale*2){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
for(const e of state.enemies){dot(e,.35,e.ignites?.length?'#e88939':'#a94e4e');const [x,y]=point(e);ctx.fillStyle='#923d3d';ctx.fillRect(x-8,y-10,16*Math.max(0,e.life/e.maximumLife),3);}
for(const a of state.projectiles){const [x,y]=point(a);ctx.strokeStyle='#ffd18a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-a.dx*scale*.6,y-a.dy*scale*.6);ctx.stroke();}dot(p,.42,'#9ac7a2');
document.querySelector('#life').value=p.life/p.maximumLife;document.querySelector('#mana').value=p.mana/p.maximumMana;
status.textContent='Lv. '+state.progression.level+' · '+Math.floor(state.time??0)+'s · 天賦點 '+(state.progression.passivePoints??0)+(state.dead?' · 已死亡':'');
const showReward=state.progression.pendingChoices>0&&!state.dead;if(showReward&&reward.hidden)renderReward();reward.hidden=!showReward;
requestAnimationFrame(frame);
}catch(e){status.textContent='引擎錯誤：'+e.message;console.error(e);}}
requestAnimationFrame(frame);
