import {stepWorld} from './engine/game-loop.mjs';
import {rangerHooks} from './engine/ranger.mjs';
import {ModifierStore} from './engine/modifiers.mjs';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),status=document.querySelector('#status'),reward=document.querySelector('#reward');
const modifiers=new ModifierStore(),enemyModifiers=new ModifierStore();
let hooks,state,dir={x:0,y:0},origin=null,last=performance.now(),acc=0;
function reset(){hooks=rangerHooks({modifiers});state={player:{x:0,y:0,speed:4,attackRange:10,life:57,maximumLife:57,mana:47,maximumMana:47,energyShield:0,accuracy:66,evasion:15,defence:{}},enemies:[],projectiles:[],progression:{level:1}};reward.hidden=true;}
reset();
const keys=new Set();addEventListener('keydown',e=>keys.add(e.key));addEventListener('keyup',e=>keys.delete(e.key));
canvas.onpointerdown=e=>{origin={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(origin)dir={x:(e.clientX-origin.x)/40,y:(e.clientY-origin.y)/40};};
canvas.onpointerup=canvas.onpointercancel=()=>{origin=null;dir={x:0,y:0};};
document.querySelector('#restart').onclick=reset;
document.querySelector('#resume').onclick=()=>{state.progression.pendingChoices--;reward.hidden=true;};
function frame(now){try{
acc+=Math.min(.1,(now-last)/1000);last=now;
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
reward.hidden=!(state.progression.pendingChoices>0)||state.dead;
requestAnimationFrame(frame);
}catch(e){status.textContent='引擎錯誤：'+e.message;console.error(e);}}
requestAnimationFrame(frame);
