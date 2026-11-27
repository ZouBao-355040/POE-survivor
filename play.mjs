import {campaignCharacter,newCampaignProgression} from './engine/character.mjs?v=0.5.10';
import {starterFlasks,flaskBases} from './engine/flasks.mjs?v=0.5.12';
import {stepWorld} from './engine/game-loop.mjs?v=0.5.13';
import {rangerHooks,trainingWeaponFor} from './engine/ranger.mjs?v=0.5.13';
import {ModifierStore} from './engine/modifiers.mjs';
import {GemInventory} from './engine/gem-inventory.mjs?v=0.5.10';
import {gemPrice,purchaseGem,shopStock,shopCampaign,gemAvailability,selectDroppedGem} from './engine/gem-shop.mjs?v=0.5.10';
import {catalog,gemById,researchIndex} from './engine/projectile-catalog.mjs?v=0.5.10';
import {gemLevelCap,gemXpRequired} from './engine/gem-growth.mjs';
import {compatible,effectiveSupports} from './engine/skill.mjs';
import {grantExperience} from './engine/progression.mjs';
import {actOne,advanceRoute,trialStage} from './engine/act-one.mjs';
import {places,gate,hillockId,canEnterTown,openingBeach,retryBeach,stepBeach,beginTrial,stepTrial} from './engine/campaign.mjs?v=0.5.13';
import {gearSlots,wagerPrice,satchelLimit,newTownServices,rollGear,emptyBattleLoot,queueBattleLoot,queueTrialLoot,claimBattleLoot,equipGear,transferGear,transferGem,socketStoredGem,equippedSocketLayout,itemAffix} from './engine/town-services.mjs?v=0.5.10';
import {claimLevelCurrency,rollCurrencyChoices,currencies,currencyBalance} from './engine/currency.mjs?v=0.5.10';
import {applyLoadout} from './engine/player-loadout.mjs?v=0.5.13';
import {allocate as allocateTalent,points as talentPoints} from './engine/passive-tree.mjs?v=0.5.13';
import {renderTalentTree} from './talent-ui.mjs?v=0.5.13';
import {craftCategories,craftAvailability,craftGear,affixCatalog,affixText} from './engine/gear-crafting.mjs?v=0.5.10';

const $=s=>document.querySelector(s);
const panel=$('#gem-panel'),toggle=$('#gems'),canvas=$('canvas'),ctx=canvas.getContext('2d'),status=$('#status'),reward=$('#reward');
const town=$('#town'),townDialog=$('#town-dialog'),guideChoice=$('#guide-choice'),gameMenu=$('#game-menu');
const modifiers=new ModifierStore(),enemyModifiers=new ModifierStore();
const names={Bow:'弓',Wand:'法杖',Claw:'爪',Shield:'盾牌','One Hand Sword':'單手劍','One Hand Axe':'單手斧',Unarmed:'空手'};
const socketNames={weapon:'武器',body:'胸甲',helmet:'頭盔',gloves:'手套',boots:'鞋子'};
const gemName=id=>gemById.get(id)?.name??'普通攻擊';
const enabled=()=>state.zone!=='town'&&state.encounter?.phase!=='cleared'&&!panel.open&&!townDialog.open&&!guideChoice.open&&!gameMenu.open&&!state.dead&&!(state.progression.pendingChoices>0);
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
let inventory,hooks,state,townItems,activeCurrencyChoices=null,guide=false,picked=null,tab='owned',search='',filter='all';
let shopTab='active',shopSearch='',shopCompatible=true,shopShowLocked=false;
let dir={x:0,y:0},facing={x:1,y:0},manualQueued=false,origin=null,last=performance.now(),acc=0,toastUntil=0;
const keys=new Set();
function clearInput(){manualQueued=false;keys.clear();origin=null;dir={x:0,y:0};}
function notify(message){$('#toast').textContent=message;toastUntil=(state.time??0)+3;}
const xpCost=l=>24+l*13;
const ownedOrStored=()=>[...inventory.ownedIds(),...townItems.storedGems.keys()];
function reset(askGuide=true){
 inventory=new GemInventory();
 for(const id of campaignCharacter.starterGems)inventory.acquire(gemById.get(id));
 townItems=newTownServices({starter:true});craftSelection={item:null,category:'basic',entry:null,family:null};inventory.setLayout(equippedSocketLayout(townItems));modifiers.remove('town-gear');modifiers.remove('talents');guide=false;
 picked=null;tab='owned';if(panel.open)panel.close();
 if(townDialog.open)townDialog.close();if(guideChoice.open)guideChoice.close();if(gameMenu.open)gameMenu.close();
 clearInput();facing={x:1,y:0};acc=0;shopTab='active';shopSearch='';shopCompatible=true;hooks=rangerHooks({modifiers,inventory});
 state={zone:'beach',gateOpen:false,routeIndex:0,chapterComplete:false,player:{x:0,y:0,speed:4,attackRange:12,life:70,maximumLife:70,mana:58,maximumMana:58,energyShield:0,accuracy:90,evasion:15,defence:{}},
  enemies:openingBeach(),projectiles:[],flasks:starterFlasks(),gold:0,goldDrops:[],pendingLoot:emptyBattleLoot(),time:0,progression:newCampaignProgression(),kills:0};
 $('#toast').textContent='';reward.hidden=true;town.inert=false;activeCurrencyChoices=null;
 if(askGuide){$('#campaign-character').textContent=campaignCharacter.name;guideChoice.showModal();}
}
function startGuide(want){
 updateEquipment({refill:true});guideChoice.close();guide=want;tab='owned';picked=null;clearInput();
 if(want)openGems();
}
$('#start-guide').onclick=()=>startGuide(true);
$('#skip-guide').onclick=()=>startGuide(false);
guideChoice.addEventListener('cancel',e=>{e.preventDefault();startGuide(false);});
function enterTown(){
 if(state.zone==='beach'){
  if(!canEnterTown(state))return;
  state.progression=grantExperience(state.progression,state.beachXP??0,xpCost);
  state={...state,zone:'town',enemies:[],projectiles:[],fields:[],goldDrops:[],time:0,
    cooldown:0,skillCooldowns:{},nextSpawn:0,flasks:starterFlasks(),player:{...state.player,activeLeech:undefined,recoupEffects:undefined,ghostClock:0,ghostShrouds:0,life:state.player.maximumLife,mana:state.player.maximumMana,energyShield:state.player.maximumEnergyShield??0,shieldInterruptedAt:0,shieldCharging:false,x:0,y:0}};
 }else if(state.zone==='trial'&&(state.dead||state.encounter?.phase==='cleared')){
  const route=advanceRoute(state);
  state={...route,zone:'town',dead:false,encounter:null,enemies:[],projectiles:[],fields:[],enemyCasts:[],time:0,
    flasks:starterFlasks(),player:{...state.player,activeLeech:undefined,recoupEffects:undefined,ghostClock:0,ghostShrouds:0,life:state.player.maximumLife,mana:state.player.maximumMana,energyShield:state.player.maximumEnergyShield??0,shieldInterruptedAt:0,shieldCharging:false,x:0,y:0}};
 }else return;
 const claimed=claimBattleLoot(townItems,state.gold,state.pendingLoot);
 townItems=claimed.town;state.gold=claimed.gold;state.pendingLoot=claimed.pending;
 if(claimed.hillock){
  const loot=claimed.hillock;
  state.openingLoot='西拉克戰利品：'+loot.gold+' 金幣'+(loot.item?'、'+loot.item.name+'、'+loot.orb:'');
 }
 state.lootReceipt=claimed.claimedGold||claimed.claimedOrbs||claimed.claimedGems||claimed.claimedGear?'回城已收取：'+claimed.claimedGold+' 金幣、'+claimed.claimedOrbs+' 顆通貨、'+claimed.claimedGems+' 顆寶石'+(claimed.claimedGear?'、'+claimed.claimedGear+' 件裝備':''):'';
 acc=0;clearInput();$('#toast').textContent='';
}
function startStage(route){
 const next=trialStage(route.routeIndex??0);
 if(!next)return;
 if(townDialog.open)townDialog.close();
 state=beginTrial(route,next);state.player={...state.player,shieldInterruptedAt:0,shieldCharging:false};acc=0;clearInput();$('#toast').textContent='';
}
function leaveTown(){if(state.zone==='town'&&!state.progression.pendingChoices)startStage(state);}
function nextZone(){if(state.progression.pendingChoices)return;const route=advanceRoute(state);if(route!==state)startStage(route);}
function updateEquipment({refill=state.zone==='town'}={}){
 inventory.setLayout(equippedSocketLayout(townItems));
 state.player=applyLoadout(state.player,townItems,state.progression,modifiers,{refill});
}
$('#town-entry').onclick=enterTown;
$('#beach-retry').onclick=()=>{
 const next=retryBeach(state);
 if(next===state)return;
 state=next;hooks=rangerHooks({modifiers,inventory});acc=0;clearInput();
 notify('戰利品已保留。抵達獅眼守望後會自動入帳。');
};
$('#return-town').onclick=enterTown;
$('#leave-town').onclick=leaveTown;
$('#next-zone').onclick=nextZone;
function closeGems(){guide=false;if(panel.open)panel.close();state={...state,paused:false};acc=0;clearInput();toggle.focus();}
function openGems(){state={...state,paused:true};acc=0;clearInput();renderGems();panel.showModal();}
toggle.onclick=openGems;
panel.addEventListener('cancel',e=>{e.preventDefault();closeGems();});
function renderGems(){
 panel.replaceChildren();
 const top=div('','panel-top');const title=heading(state.zone==='town'?'寶石背包':'寶石背包 · 戰鬥已暫停');title.id='gem-title';
 top.append(title,button(guide?'退出教學':'關閉',closeGems));panel.append(top);
 const tabs=div('','toolbar');
 for(const [k,n] of [['owned','插槽與寶石'],['library','PoE 寶石圖鑑'],['practice','技能試射']])tabs.append(button(n,()=>{tab=k;search='';filter='all';renderGems();},{selected:tab===k}));
 if(!guide)panel.append(tabs);
 if(tab!=='owned'){renderLibrary();return;}
 panel.append(div('先點持有寶石，再點同組插槽。點已插上的主動寶石，可開關自動施放；也可指定一顆只用手動鍵。輔助只作用於同組相容技能。','muted'));
 const current=inventory.current(),chosen=current?.active;
 const equippedStarter=Object.values(inventory.board.groups).flat().some(g=>g?.id==='burning-arrow');
 const task=chosen?'done':equippedStarter?'select':picked==='burning-arrow'?'socket':'pick';
 if(guide){
  const instructions={pick:'步驟 1／3：在持有寶石點「燃燒箭矢」。',socket:'步驟 2／3：點武器下方空插槽「○」，把寶石插進去。',select:'步驟 3／3：點插槽裡的「燃燒箭矢」，開啟自動施放。',done:'完成！有怪進射程就會自動施放。缺魔時會暫時用普攻。'};
  const tip=div(instructions[task],'guide-tip');tip.setAttribute('role','status');panel.append(tip);
  if(task==='done')panel.append(button('完成教學，開始戰鬥',closeGems));
 }
 const row=div('','gem-row');
 row.append(heading('目前技能：'+(chosen?chosen.name+' · 等級 '+chosen.level:'普通攻擊'),'h3'));
 if(chosen){
  const applicable=effectiveSupports(chosen,current.supports);
  row.append(div((chosen.tags.includes('spell')?'法術 · 施放速度':'訓練武器：'+(names[trainingWeaponFor(chosen)]??'弓')+' · 攻擊速度')+' · 生效輔助：'+(applicable.map(s=>s.name).join('、')||'無'),'muted'));
 }
 if(!guide){
  const auto=[...inventory.automatic].map(id=>inventory.owned.get(id)?.name).filter(Boolean);
  row.append(div('自動：'+(auto.join('、')||'無')+' ／ 手動：'+(inventory.owned.get(inventory.manual)?.name??'無'),'muted'));
 }
 panel.append(row,heading('持有寶石','h3'));
 const gems=div('','button-row');for(const [id,g] of inventory.owned){
  const tile=card(g,()=>{picked=picked===id?null:id;renderGems();},picked===id);
  if(guide&&task==='pick'&&id==='burning-arrow')tile.classList.add('guide-target');
  gems.append(tile);
 }
 panel.append(gems);
 if(state.zone==='town'&&townItems.storedGems.size){
  const stored=div('','button-row');
  for(const [id,g] of townItems.storedGems)
   stored.append(card({...g,name:'倉庫：'+g.name},()=>{picked=picked===id?null:id;renderGems();},picked===id));
  panel.append(heading('倉庫寶石 · 可直接插入空槽','h3'),stored);
 }
 panel.append(heading('裝備插槽','h3'));
 if(!state.practice)panel.append(div('只顯示已穿戴裝備的插槽。卸下裝備時，該部位的寶石會回到持有寶石。','muted'));
 for(const [group,slots] of Object.entries(inventory.board.groups)){
  const wrapper=div('','gem-row'),row=div('','button-row');wrapper.append(heading(socketNames[group],'h3'));
  slots.forEach((g,i)=>{
   const slot=button(g?g.name+' '+g.level:'○',()=>{
    if(picked){
     if(!inventory.owned.has(picked)&&state.zone==='town'){
      if(g)return;
      socketStoredGem(townItems,inventory,picked,group,i);
     }else inventory.equip(picked,group,i);
     picked=null;
    }
    else if(g?.kind==='active')inventory.setMode(g.id,inventory.mode(g.id)==='auto'&&!guide?'off':'auto');
    else if(g)inventory.unequip(group,i);
    renderGems();
   },{selected:g?.kind==='active'&&inventory.mode(g.id)!=='off',title:g?.description??socketNames[group]+'第 '+(i+1)+' 格',className:'socket'});
   if(guide&&((task==='socket'&&group==='weapon'&&!g&&i===slots.indexOf(null))||(task==='select'&&g?.id==='burning-arrow')))slot.classList.add('guide-target');
   row.append(slot);
  });
  wrapper.append(row);panel.append(wrapper);
 }
 const tools=div('','skill-modes');
 for(const g of Object.values(inventory.board.groups).flat().filter(g=>g?.kind==='active')){
  const mode=inventory.mode(g.id),item=div('','gem-mode');
  item.append(div(g.name+' · '+({auto:'自動',manual:'手動限定',off:'停用'}[mode]),'muted'));
  if(!guide){
   if(mode!=='auto')item.append(button('自動 '+g.name,()=>{inventory.setMode(g.id,'auto');renderGems();}));
   if(mode!=='manual')item.append(button('手動 '+g.name,()=>{inventory.setMode(g.id,'manual');renderGems();}));
   if(mode!=='off')item.append(button('停用 '+g.name,()=>{inventory.setMode(g.id,'off');renderGems();}));
  }
  item.append(button('卸下 '+g.name,()=>{for(const [group,slots] of Object.entries(inventory.board.groups)){const i=slots.findIndex(x=>x?.id===g.id);if(i>=0){inventory.unequip(group,i);break;}}renderGems();}));
  tools.append(item);
 }
 if(tools.children.length)panel.append(tools);
}
function practice(id){
 const active=gemById.get(id);if(active.kind!=='active')return;
 closeGems();reset(false);
 inventory=new GemInventory();inventory.acquire(active);inventory.equip(active.id,'weapon',0);inventory.setMode(active.id,'auto');hooks=rangerHooks({modifiers,inventory});
 state.practice=true;state.zone='practice';
 for(const candidate of catalog.filter(s=>s.kind==='support'&&compatible(active,s)))inventory.acquire(candidate);
 state.enemies=[{id:'dummy-1',x:6,y:0,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0},
 {id:'dummy-2',x:8,y:1.75,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0},
 {id:'dummy-3',x:8,y:-1.75,life:2000,maximumLife:2000,evasion:0,defence:{},radius:.4,speed:0}];
 notify('試射場：'+active.name+'。重開可回到絕望岩灘。');
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
function renderLevelReward(){
 reward.replaceChildren();
 const choices=rollCurrencyChoices();
 activeCurrencyChoices=choices;
 const level=state.progression.level-state.progression.pendingChoices+1;
 reward.append(heading('等級 '+level+' · 通貨三選一'),div('選一顆通貨，直接存入倉庫。','muted'));
 const options=div('','currency-choices');
 for(const orb of choices)options.append(button(orb+' ×1',()=>{
  if(activeCurrencyChoices!==choices||!state.progression.pendingChoices||state.dead)return;
  const result=claimLevelCurrency(state.progression,townItems.storedOrbs,choices,orb);
  state.progression=result.progression;
  townItems={...townItems,storedOrbs:result.wallet};
  notify('已取得 '+orb);
  if(state.progression.pendingChoices>0)renderLevelReward();
  else {activeCurrencyChoices=null;reward.hidden=true;town.inert=false;}
 }));
 reward.append(options);
}
function renderShop(){
 const surface=townDialog;surface.classList.remove('craft-dialog');
 surface.replaceChildren();
 const top=div('','shop-top');
 top.append(heading('獅眼守望 · 寶石商'));
 const wallet=div('持有金幣：'+state.gold,'shop-wallet');wallet.id='shop-wallet';
 top.append(wallet);
 top.append(div('普通寶石隨主線與角色等級開放。覺醒、變異等特殊寶石不販售。','muted'));
 const tools=div('','toolbar');
 const chosen=inventory.current()?.active;
 const filter=button(shopCompatible?'只看目前技能相容':'顯示全部輔助',()=>{
  shopCompatible=!shopCompatible;filter.textContent=shopCompatible?'只看目前技能相容':'顯示全部輔助';filter.setAttribute('aria-pressed',shopCompatible);refresh();
 },{selected:shopCompatible});
 const activeBtn=button('主動技能',()=>changeTab('active'),{selected:shopTab==='active'});
 const supportBtn=button('輔助寶石',()=>changeTab('support'),{selected:shopTab==='support'});
 const locked=button('顯示未解鎖',()=>{
  shopShowLocked=!shopShowLocked;locked.textContent=shopShowLocked?'隱藏未解鎖':'顯示未解鎖';
  locked.setAttribute('aria-pressed',shopShowLocked);refresh();
 },{selected:shopShowLocked});
 locked.textContent=shopShowLocked?'隱藏未解鎖':'顯示未解鎖';
 const input=document.createElement('input');input.type='search';input.placeholder='搜尋寶石';input.setAttribute('aria-label','搜尋商店寶石');input.value=shopSearch;
 const results=div('','library-list shop-list');
 const count=div('','muted');
 const done=button('關閉',()=>townDialog.close());
 function changeTab(kind){
  shopTab=kind;shopSearch='';input.value='';
  activeBtn.setAttribute('aria-pressed',kind==='active');supportBtn.setAttribute('aria-pressed',kind==='support');
  filter.hidden=kind!=='support'||!chosen;refresh();
 }
 function refresh(){
  const active=shopTab==='support'&&shopCompatible?chosen:null;
  const q=shopSearch.trim().toLowerCase();
  const context={progression:state.progression,campaign:shopCampaign(state)};
  const stock=shopStock(catalog,ownedOrStored(),shopTab,active).map(g=>({g,status:gemAvailability(g,context)}))
   .filter(({g,status})=>status.listed&&(!q||g.name.toLowerCase().includes(q)||g.id.includes(q.replaceAll(' ','-'))));
  const offers=stock.filter(({status})=>status.available||shopShowLocked||q)
   .sort((a,b)=>Number(b.status.available)-Number(a.status.available)||a.status.requiredLevel-b.status.requiredLevel);
  count.textContent=offers.length?offers.filter(({status})=>status.available).length+' 顆已解鎖':'沒有符合條件的普通寶石。';
  results.replaceChildren();
  for(const {g,status} of offers){
   const cost=gemPrice(g);
   const item=card({...g,name:g.name+' · '+cost+' 金幣'},()=>{
    const bought=purchaseGem({progression:state.progression,campaign:shopCampaign(state),gold:state.gold,
      catalog,ownedIds:ownedOrStored(),inTown:state.zone==='town'},g.id);
    inventory.acquire(bought.gem);
    state.gold=bought.gold;
    wallet.textContent='持有金幣：'+state.gold;
    notify('已購買 '+g.name+'，可在寶石背包插上並選為目前技能。');
    refresh();
   },false,true);
   if(!status.available)item.append(div('未解鎖：'+status.reason,'shop-lock'));
   else if(state.gold<cost)item.append(div('金幣不足','shop-lock'));
   item.classList.add('shop-item');item.disabled=!status.available||state.gold<cost;results.append(item);
  }
 }
 input.addEventListener('input',()=>{shopSearch=input.value;refresh();});
 filter.hidden=shopTab!=='support'||!chosen;
 tools.append(activeBtn,supportBtn,filter,locked,input);
 top.append(tools,count);
 surface.append(top,results,done);
 refresh();
}
function townPage(title){
 townDialog.classList.remove('craft-dialog','talent-dialog');townDialog.replaceChildren();
 const top=div('','panel-top');
 top.append(heading(title),button('關閉',()=>townDialog.close()));
 townDialog.append(top,div('持有金幣：'+state.gold,'shop-wallet'));
}
function gearIcon(g){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.classList.add('gear-icon');svg.setAttribute('aria-hidden','true');svg.dataset.rarity=g.rarity;
 const use=document.createElementNS(svg.namespaceURI,'use');
 use.setAttribute('href','./assets/gear-icons.svg?v=0.5.10#'+g.slot);svg.append(use);return svg;
}
function gearLabel(g,{detail=false}={}){
 const card=div('','gear-label'),caption=div('','gear-copy');
 const title=document.createElement('strong');title.textContent=g.name;
 caption.append(title,div(gearSlots[g.slot]+' · '+g.rarity+(townItems.equipped[g.slot]===g.id?' · 穿戴中':''),'muted'));
 if(detail&&g.dropArea)caption.append(div('掉落：'+g.dropArea+' · '+g.dropSource,'muted'));
 if(detail)caption.append(div(itemAffix(g)+(g.affixes?.length?' · '+g.affixes.map(affixText).join('、'):''),'muted'));
 card.append(gearIcon(g),caption);return card;
}
function renderEquipment(){
 townPage('裝備總覽');
 const equipped=Object.entries(gearSlots).map(([slot,label])=>[slot,label,townItems.gear.find(g=>g.id===townItems.equipped[slot])]);
 const grid=div('','equipment-grid');
 for(const [,label,item] of equipped)grid.append(item?gearLabel(item,{detail:true}):div(label+' · 未穿戴','muted gear-empty'));
 townDialog.append(heading('已穿戴','h3'),grid,heading('裝備背包','h3'));
 for(const item of townItems.gear)renderGearRow(item,renderEquipment);
 if(state.zone!=='town')townDialog.append(div('回城後可更換與打造裝備。','muted'));
}
function renderGearRow(g,refresh){
 const equipped=townItems.equipped[g.slot]===g.id;
 const row=div('','town-item');row.append(gearLabel(g,{detail:true}));
 if(state.zone==='town')row.append(button(equipped?'卸下 '+g.name:'穿戴 '+g.name,
  ()=>{townItems=equipGear(townItems,g.id);updateEquipment();refresh();},{selected:equipped}));
 townDialog.append(row);
}
function renderGambler(){
 townPage('獅眼守望 · 裝備賭商');
 townDialog.append(div('選部位，用 '+wagerPrice+' 金幣換隨機裝備，買到就能看到詞綴。不用鑑定。','muted'));
 const rolls=div('','button-row');
 for(const [slot,label] of Object.entries(gearSlots)){
  const entry=button('賭'+label+' · '+wagerPrice+' 金幣',()=>{
   if(state.zone!=='town')return;
   const result=rollGear(townItems,state.gold,slot,Math.random,3+Math.min(actOne.length-1,state.routeIndex??0));state.gold=result.gold;townItems=result.town;
   renderGambler();
  });
  entry.disabled=state.gold<wagerPrice||townItems.gear.length>=satchelLimit;
  rolls.append(entry);
 }
 townDialog.append(rolls,heading('裝備背包','h3'));
 if(townItems.gear.length>=satchelLimit)townDialog.append(div('背包已滿，整理後才能再向賭商購買。掉落戰利品仍會保留。','muted'));
 if(townItems.gear.length===0)townDialog.append(div('目前沒有裝備。','muted'));
 for(const g of townItems.gear)renderGearRow(g,renderGambler);
}
function renderStash(){
 townPage('獅眼守望 · 倉庫');
 townDialog.append(div('存取本局的裝備與寶石。需先卸下穿戴中的裝備或插槽中的寶石。','muted'));
 const row=(label,action,disabled=false)=>{
  const r=div('','town-item'),b=button(action.label,action.run);b.disabled=disabled;r.append(typeof label==='string'?div(label):label,b);townDialog.append(r);
 };
 const vault=div('','currency-vault');vault.setAttribute('aria-label','通貨倉庫');
 for(const orb of currencies){
  const cell=div('','currency-cell');
  cell.append(div(orb),div('×'+currencyBalance(townItems.storedOrbs,orb),'currency-count'));vault.append(cell);
 }
 townDialog.append(heading('通貨倉庫','h3'),vault,div('通貨固定格累計；打造時直接從倉庫扣除。','muted'),heading('背包','h3'));
 for(const g of townItems.gear)row(gearLabel(g),{label:'存入 '+g.name,run:()=>{townItems=transferGear(townItems,g.id,true);renderStash();}},townItems.equipped[g.slot]===g.id);
 const socketed=new Set(Object.values(inventory.board.groups).flat().map(g=>g?.id));
 for(const g of inventory.owned.values())row(g.name+' · 等級 '+g.level,{label:'存入 '+g.name,run:()=>{transferGem(townItems,inventory,g.id,true);picked=null;renderStash();}},socketed.has(g.id));
 townDialog.append(heading('已存放','h3'));
 if(!townItems.storedGear.length&&!townItems.storedGems.size)townDialog.append(div('倉庫目前是空的。','muted'));
 for(const g of townItems.storedGear)row(gearLabel(g),{label:'取出 '+g.name,run:()=>{townItems=transferGear(townItems,g.id,false);renderStash();}},townItems.gear.length>=satchelLimit);
 for(const g of townItems.storedGems.values())row(g.name+' · 等級 '+g.level,{label:'取出 '+g.name,run:()=>{transferGem(townItems,inventory,g.id,false);renderStash();}});
}
let craftSelection={item:null,category:'basic',entry:null,family:null};
function renderCraft({message='',focus}={}){
 const oldRail=townDialog.querySelector('.craft-rail')?.scrollTop??0;
 const oldTabs=townDialog.querySelector('.craft-tabs')?.scrollLeft??0;
 townPage('獅眼守望 · 裝備打造');
 townDialog.classList.add('craft-dialog');
 const categories=craftCategories.filter(group=>group.entries.length);
 const category=categories.find(group=>group.id===craftSelection.category)??categories[0];
 const item=townItems.gear.find(g=>g.id===craftSelection.item)??townItems.gear[0];
 craftSelection.item=item?.id??null;
 const picker=document.createElement('select');picker.id='craft-target';picker.setAttribute('aria-label','選擇裝備');
 if(!item)picker.append(new Option('背包沒有可打造的裝備',''));
 for(const piece of townItems.gear)picker.append(new Option(piece.name+' · '+piece.rarity+(townItems.equipped[piece.slot]===piece.id?' · 穿戴中':''),piece.id));
 picker.value=item?.id??'';picker.disabled=!item;
 picker.onchange=()=>{craftSelection.item=picker.value;renderCraft({focus:'craft-target'});};
 const tabs=div('','craft-tabs');tabs.setAttribute('aria-label','打造分類');
 for(const group of categories){
  const tab=button(group.name,()=>{
   if(category.id!==group.id)craftSelection={...craftSelection,category:group.id,entry:null,family:null};
   renderCraft({focus:'craft-tab-'+group.id});
  },{selected:category.id===group.id});tab.id='craft-tab-'+group.id;tabs.append(tab);
 }
 const split=div('','craft-body'),rail=div('','craft-rail'),sheet=div('','craft-item');
 rail.setAttribute('aria-label','通貨與工藝');sheet.setAttribute('aria-label','裝備目前狀態');
 const entries=category.entries,families=new Map();
 const addEntry=(entry,container)=>{
  const selected=craftSelection.entry===entry.id;
  const pick=button(entry.name,()=>{craftSelection.entry=entry.id;renderCraft({focus:'craft-entry-'+entries.findIndex(e=>e.id===entry.id)});},{selected});
  pick.id='craft-entry-'+entries.findIndex(e=>e.id===entry.id);
  pick.append(div('倉庫 '+currencyBalance(townItems.storedOrbs,entry.id),'currency-count'));container.append(pick);
 };
 for(const entry of entries){
  if(entry.family){if(!families.has(entry.family))families.set(entry.family,[]);families.get(entry.family).push(entry);}
  else addEntry(entry,rail);
 }
 for(const [family,tiers] of families){
  const expanded=family===craftSelection.family;
  const toggle=button(family,()=>{craftSelection.family=expanded?null:family;renderCraft();});
  toggle.setAttribute('aria-expanded',String(expanded));rail.append(toggle);
  if(expanded)for(const tier of tiers)addEntry({...tier,name:tier.tier?'T'+tier.tier:tier.name},rail);
 }
 if(item){
  sheet.append(gearLabel(item),div('物品等級 '+(item.itemLevel??1),'muted'),heading('底材屬性','h3'),div(itemAffix(item),'muted'));
  for(const [side,label] of [['prefix','前綴'],['suffix','後綴']]){
   const lines=(item.affixes??[]).filter(a=>a.side===side);
   const cap=item.rarity==='稀有'?3:item.rarity==='魔法'?1:0;
   sheet.append(heading(label+' '+lines.length+'／'+cap,'h3'));
   if(!lines.length)sheet.append(div('無','muted'));
   for(const line of lines)sheet.append(div('T'+(line.tier??3)+' · '+affixText(line),'craft-affix'));
  }
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='可能出現的詞綴';details.append(summary);
  for(const [side,label] of [['prefix','前綴'],['suffix','後綴']]){
   details.append(heading(label,'h3'));
   for(const line of affixCatalog(item.slot,item.itemLevel).filter(a=>a.side===side))
    for(const tier of line.tiers)details.append(div('T'+tier.tier+' · '+tier.text,'muted'));
  }
  sheet.append(details);
 }else sheet.append(div('先在背包準備一件裝備。','muted'));
 split.append(rail,sheet);
 const footer=div('','craft-footer'),selected=entries.find(entry=>entry.id===craftSelection.entry);
 const verdict=selected?craftAvailability(item,selected.id,townItems.storedOrbs):null;
 const note=div(message||(verdict?.reason??'')||(selected?'消耗 1 顆 '+selected.name:'先選擇左欄的通貨。'),'muted');
 note.setAttribute('role','status');
 const apply=button(selected?'打造 · '+selected.name+' ×1':'打造',()=>{
  if(state.zone!=='town')return;
  const result=craftGear(townItems,item.id,selected.id);
  townItems=result.town;updateEquipment();
  renderCraft({message:'已使用 1 顆 '+selected.name+'。',focus:'craft-apply'});
 });
 apply.id='craft-apply';apply.disabled=!verdict?.enabled;
 if(verdict?.description)footer.append(div(verdict.description));
 footer.append(note,apply);
 townDialog.append(picker,tabs,split,footer);
 rail.scrollTop=oldRail;tabs.scrollLeft=oldTabs;
 if(focus)document.getElementById(focus)?.focus({preventScroll:true});
}
function renderTalents(){
 townPage('主天賦樹');
 townDialog.classList.add('talent-dialog');
 const tree=div('','talent-tree');
 townDialog.append(tree);
 renderTalentTree(tree,{progression:state.progression,onAllocate:(id,option)=>{
  if(state.practice)return;
  state.progression=allocateTalent(state.progression,id,option);
  updateEquipment();return state.progression;
 }});
 if(state.practice)townDialog.append(div('技能試射不會保留或使用主線天賦點。','muted'));
}
function openService(render){
 if(state.zone!=='town'||state.progression.pendingChoices)return;
 clearInput();render();townDialog.showModal();
}
$('#gem-merchant').onclick=()=>openService(renderShop);
$('#gear-merchant').onclick=()=>openService(renderGambler);
$('#stash-keeper').onclick=()=>openService(renderStash);
$('#forge-open').onclick=()=>openService(()=>renderCraft());
function openCharacterPanel(draw){
 if(townDialog.open||guideChoice.open||panel.open||gameMenu.open||state.progression.pendingChoices)return;
 clearInput();acc=0;draw();townDialog.showModal();
}
$('#gear-open').onclick=()=>openCharacterPanel(renderEquipment);
$('#talent-open').onclick=()=>openCharacterPanel(renderTalents);
townDialog.addEventListener('close',()=>{townDialog.classList.remove('craft-dialog','talent-dialog');clearInput();acc=0;});
reset();
const menuStart=$('#menu-start'),restart=$('#restart'),confirmRestart=$('#confirm-restart');
function restartPhase(confirming){
 restart.hidden=confirming;confirmRestart.hidden=!confirming;
 $('#restart-warning').hidden=!confirming;
}
$('#menu-open').onclick=()=>{clearInput();acc=0;restartPhase(false);gameMenu.showModal();};
function closeMenu(){gameMenu.close();clearInput();acc=0;$('#menu-open').focus();}
menuStart.onclick=closeMenu;
restart.onclick=()=>{restartPhase(true);confirmRestart.focus();};
confirmRestart.onclick=()=>reset();
gameMenu.addEventListener('cancel',e=>{e.preventDefault();closeMenu();});
addEventListener('keydown',e=>{
 if(!enabled())return;
 if(e.code==='Space'&&inventory.manual){e.preventDefault();if(!e.repeat)manualQueued=true;return;}
 if(e.key.toLowerCase()==='i'){openGems();return;}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
 keys.add(e.key.toLowerCase());
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',clearInput);
const manualButton=$('#manual-skill');
manualButton.onclick=()=>{if(enabled()&&inventory.manual)manualQueued=true;};
canvas.onpointerdown=e=>{if(!enabled()||origin)return;origin={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(origin?.id===e.pointerId)dir={x:(e.clientX-origin.x)/40,y:(e.clientY-origin.y)/40};};
canvas.onlostpointercapture=canvas.onpointerup=canvas.onpointercancel=e=>{if(origin?.id===e.pointerId){origin=null;dir={x:0,y:0};}};
function simulate(){
 const direction=origin?dir:{x:Number(keys.has('arrowright')||keys.has('d'))-Number(keys.has('arrowleft')||keys.has('a')),
  y:Number(keys.has('arrowdown')||keys.has('s'))-Number(keys.has('arrowup')||keys.has('w'))};
 const magnitude=Math.hypot(direction.x,direction.y);
 if(magnitude)facing={x:direction.x/magnitude,y:direction.y/magnitude};
 const manualRequest=manualQueued?facing:null;manualQueued=false;
 const castPlan=inventory.castPlan();
 const step=state.zone==='beach'?stepBeach:state.zone==='trial'?stepTrial:stepWorld;
 state=step(state,.02,{...hooks,direction,castPlan,manualRequest,manaRegen:((state.practice?22:2.85)+(state.player.manaRegenFlat??0))*(state.player.manaRegenMultiplier??1),enemyModifiers,experienceRequired:state.practice?null:xpCost,deferLoot:true});
 if(manualRequest&&!state.events?.some(e=>e.type==='fire'&&e.manual))notify('手動技能未施放：確認魔力與冷卻。');
 for(const ev of state.events??[]){
  if(ev.type==='boss-arrives')notify(ev.reason==='clear'?'普通怪已清空，'+ev.name+' 提前登場！':'時間到，'+ev.name+' 已登場！');
  if(ev.type==='trial-cleared')notify(state.encounter.stageName+'通關。');
  if(ev.type==='boss-phase')notify(ev.name+'進入第二階段！');
  if(ev.type==='glyphs-needed')notify('獸巢還有雕紋。走近未拾取的雕紋即可收集。');
  if(ev.type==='glyph')notify('已找到 '+ev.count+'/3 個雕紋。');
  if(ev.type==='kill'){
   state.kills++;
   const ups=inventory.grantExperience(ev.experience,state.progression.level);
   if(ups.length)notify(ups.map(g=>g.name+' 升到 '+g.level+' 級').join('、'));
   if(state.zone==='beach'||state.zone==='trial'){
    const gem=state.zone==='trial'?selectDroppedGem(ev,catalog,
     [...ownedOrStored(),...state.pendingLoot.gems.map(g=>g.id)],
     {progression:state.progression,campaign:shopCampaign(state)}):null;
    if(state.zone==='trial')state=queueTrialLoot(state,ev,{gem});
    else state.pendingLoot=queueBattleLoot(state.pendingLoot,ev,{hillock:ev.target===hillockId,rollCurrency:false});
   }
   if(ev.target===hillockId&&!state.dead)notify('西拉克已擊敗。往右走到城門，回城會自動收取戰利品。');
  }
 }
 if(!enabled())clearInput();
}
function render(){
 const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,devicePixelRatio||1),cw=Math.round(w*dpr),ch=Math.round(h*dpr);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 ctx.setTransform(dpr,0,0,dpr,0,0);
 const p=state.player,scale=Math.min(w,h)/23;
 const trial=state.zone==='trial'?state.encounter:null;
 ctx.fillStyle=state.zone==='beach'?'#302a25':state.zone==='town'?'#181c23':({mud:'#22281e',cave:'#151c29',ridge:'#282729',prison:'#242128'}[trial?.theme]??'#171c20');ctx.fillRect(0,0,w,h);
 const point=o=>[w/2+(o.x-p.x)*scale,h/2+(o.y-p.y)*scale];
 function dot(o,r,c){const [x,y]=point(o);ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r*scale,0,Math.PI*2);ctx.fill();}
 if(state.zone==='beach'){
  const [,shore]=point({x:0,y:5.1});
  ctx.fillStyle='#182b37';ctx.fillRect(0,Math.max(0,shore),w,h);
  ctx.strokeStyle='#53747a';ctx.beginPath();ctx.moveTo(0,shore);ctx.lineTo(w,shore);ctx.stroke();
  const [gx,gy]=point(gate);
  ctx.fillStyle=state.gateOpen?'#659478':'#936c54';ctx.fillRect(gx-4,gy-scale*4,8,scale*8);
  ctx.fillStyle='#f8dca3';ctx.font='bold 13px sans-serif';ctx.textAlign='center';
  ctx.fillText(state.gateOpen?'獅眼守望 →':'城門',gx,gy-scale*4-7);ctx.textAlign='start';
 }
 for(const glyph of trial?.glyphs??[]){
  if(glyph.taken)continue;
  dot(glyph,.32,'#efd184');const [gx,gy]=point(glyph);
  ctx.fillStyle='#f7e5ac';ctx.font='bold 12px sans-serif';ctx.fillText('雕紋',gx-12,gy-12);
 }
 ctx.strokeStyle=state.zone==='beach'?'#443a30':'#263036';ctx.lineWidth=1;
 ctx.beginPath();
 for(let x=(-p.x*scale+w/2)%(scale*2);x<w;x+=scale*2){ctx.moveTo(x,0);ctx.lineTo(x,h);}
 for(let y=(-p.y*scale+h/2)%(scale*2);y<h;y+=scale*2){ctx.moveTo(0,y);ctx.lineTo(w,y);}
 ctx.stroke();
 for(const f of state.fields??[]){
  const [x,y]=point(f);
  if(f.tornadoImpact){
   const t=Math.max(0,Math.min(1,(state.time-f.start)/f.duration));
   ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle='#c8e5dc';ctx.lineWidth=2;
   for(let i=0;i<3;i++){
    const phase=i*Math.PI*2/3+t*4;
    ctx.beginPath();ctx.arc(x,y,scale*(.25+t*.65),phase,phase+1.20);ctx.stroke();
   }
   ctx.restore();continue;
  }
  if(f.beamTo){const [bx,by]=point(f.beamTo);ctx.strokeStyle='#d8c9ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.stroke();continue;}ctx.globalAlpha=f.visual?.34:.23;ctx.fillStyle=f.color??'#b7d879';ctx.beginPath();ctx.arc(x,y,(f.radius??1)*scale,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 }
 for(const cast of state.enemyCasts??[]){
  const [x,y]=point(cast),r=cast.radius*scale;
  const progress=Math.max(0,1-(cast.impactAt-state.time)/cast.windup);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=(cast.element==='cold'?'rgba(113,161,240,':'rgba(234,76,27,')+(0.12+progress*.22)+')';ctx.fill();
  ctx.strokeStyle=cast.element==='cold'?'#9cdcff':'#f79255';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,r*progress,0,Math.PI*2);ctx.stroke();
 }
 for(const e of state.enemies){dot(e,e.radius??.35,e.boss?'#c67c4e':e.frozenUntil>state.time?'#b2e9ff':e.ignites?.length?'#e88939':e.dots?.length?'#aecc71':e.family==='fire-eater'?'#efab69':e.family==='crab'?'#87a6ad':'#ad5d63');const [x,y]=point(e);ctx.fillStyle='#d98187';ctx.fillRect(x-8,y-10,16*Math.max(0,e.life/e.maximumLife),3);
  if(e.boss){ctx.fillStyle='#ffd1a4';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(e.name,x,y-17);ctx.textAlign='start';}
 }
 for(const a of state.projectiles){
  if(a.delay>0)continue;
  const [x,y]=point(a);if(a.noCollision&&a.pulseEvery){ctx.globalAlpha=.17;dot(a,.9,a.color);ctx.globalAlpha=1;dot(a,.25,a.color);continue;}
  if(a.tornadoStage==='payload'){
   const t=1-Math.min(1,a.remainingRange/Math.max(.001,a.flight));
   const lift=Math.sin(Math.PI*t)*scale*1.75;
   const landing={x:a.x+a.dx*a.remainingRange,y:a.y+a.dy*a.remainingRange};
   const [lx,ly]=point(landing);
   ctx.save();ctx.globalAlpha=.55;ctx.strokeStyle='#c8e5dc';ctx.lineWidth=1.4;
   ctx.beginPath();ctx.ellipse(lx,ly,scale*.34,scale*.19,0,0,Math.PI*2);ctx.stroke();
   ctx.globalAlpha=1;ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(x,y-lift);
   ctx.lineTo(x-a.dx*scale*.48,y-lift-a.dy*scale*.48+(2*t-1)*scale*-.44);ctx.stroke();ctx.restore();continue;
  }
  const secondary=a.tornadoStage==='secondary',primary=a.tornadoStage==='primary';
  const trail=primary?1.00:secondary?Math.min(.76,a.age*a.speed):.65;
  ctx.save();
  if(secondary)ctx.globalAlpha=.22+.78*Math.min(1,a.remainingRange/(a.speed*.15));
  ctx.strokeStyle=secondary?'#c8e5dc':a.color??'#ffd18a';
  ctx.lineWidth=a.returning?1.4:primary?3:secondary?1.7:2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-a.dx*scale*trail,y-a.dy*scale*trail);ctx.stroke();
  ctx.restore();
  if(a.skill.source==='spell')dot(a,.15,a.color);
 }
 dot(p,.43,p.life<=0?'#685761':'#9ac7a2');
 let phase=0;
 for(const [k,n] of Object.entries(hooks.charges.snapshot(state.time))){for(let i=0;i<n;i++){const a=state.time*1.9+(phase++)*1.9;dot({x:p.x+.91*Math.cos(a),y:p.y+.91*Math.sin(a)},.12,{power:'#a5bdff',frenzy:'#80db8c',endurance:'#e88985'}[k]);}}
 $('#life').value=p.life/p.maximumLife;$('#life-num').textContent=Math.ceil(p.life)+'/'+p.maximumLife;
 $('#mana').value=p.maximumMana?p.mana/p.maximumMana:0;$('#mana-num').textContent=p.maximumMana?Math.floor(p.mana)+'/'+p.maximumMana:'血魔法';
 const shield=$('#es-meter');shield.hidden=!(p.maximumEnergyShield>0||p.rules?.ghostDance);
 shield.textContent=shield.hidden?'':'護盾 '+Math.ceil(p.energyShield??0)+'/'+(p.maximumEnergyShield??0)+(p.rules?.ghostDance?' · 鬼影 '+(p.ghostShrouds??0)+'/3':'');
 for(const [key,base] of Object.entries(flaskBases)){
  const f=state.flasks[key],tag=$('#flask-'+key);
  const blocked=key==='life'&&p.rules?.vaalPact;
  tag.dataset.active=String(!blocked&&f.remaining>0);
  tag.dataset.ready=String(!blocked&&f.charges===base.capacity);
  tag.title=blocked?'瓦爾冥約：無法用生命藥劑回復':base.name+' · 充能滿時使用';
  tag.textContent=(key==='life'?'紅水':'藍水')+' '+f.charges+'/'+base.capacity+(blocked?' · 停用':f.remaining>0?' · 回復中':'');
 }
 const n=Math.floor(state.time??0);
 const remaining=talentPoints(state.progression).remaining;
 $('#talent-open').textContent=remaining?'天賦 '+remaining:'天賦';
 status.textContent=(trial?.stageName??places[state.zone])+' · 等級 '+state.progression.level+' · '+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')+' · 擊殺 '+state.kills+(state.dead?' · 已死亡':'');
 $('#gold-hud').textContent='金幣 '+state.gold;
 const pending=state.pendingLoot;
 $('#field-loot').hidden=!pending.gold&&!pending.orbs.length&&!pending.gems.length&&!pending.gear.length&&!pending.hillock;
 $('#field-loot').textContent='待回城：'+pending.gold+' 金幣 · '+pending.orbs.length+' 通貨 · '+pending.gems.length+' 寶石'+(pending.gear.length?' · '+pending.gear.length+' 裝備':'')+(pending.hillock?' · 西拉克戰利品':'');
 const manual=inventory.manual,manualGem=inventory.owned.get(manual);
 const wait=state.skillCooldowns?.[manual]??0;
 manualButton.hidden=!manualGem||state.dead||state.zone==='town'||state.encounter?.phase==='cleared';
 manualButton.disabled=!enabled()||wait>0;
 if(manualGem)manualButton.textContent=manualGem.name+(wait>0?' · '+wait.toFixed(1)+' 秒':' · 空白鍵');
 const activeNames=[...inventory.automatic].map(id=>inventory.owned.get(id)?.name).filter(Boolean);
 const attackName=activeNames.length?activeNames[0]+(activeNames.length>1?' ＋'+(activeNames.length-1):''):
  manualGem?manualGem.name+'（手動）':'普通攻擊';
 $('#hint').textContent=state.zone==='beach'?attackName+(state.gateOpen?' · 往右走到城門':' · 往右，擊敗西拉克'):
   state.zone==='town'?'安全區 · 可整理裝備':attackName+' · 拖曳或 WASD 移動';
 town.hidden=state.zone!=='town';
 if(state.zone==='town'){
  $('#opening-loot').textContent=state.openingLoot??'';
  $('#town-loot').textContent=state.lootReceipt??'';
  const next=trialStage(state.routeIndex??0);
  $('#leave-town').hidden=!next;
  if(next)$('#leave-town').textContent='前往'+next.name;
  $('#chapter-status').textContent=state.chapterComplete?'第一章已完成，第二章尚未開放。':'第一章主線：'+(state.routeIndex??0)+'/'+actOne.length+' 張地圖已完成';
 }
 $('#town-entry').hidden=!canEnterTown(state);
 $('#beach-retry').hidden=state.zone!=='beach'||!state.dead;
 const boss=state.enemies.find(e=>e.boss&&e.life>0),bar=$('#boss-hud'),meter=$('#boss-meter');
 bar.hidden=!boss||state.dead||trial?.phase==='cleared';
 if(!bar.hidden){
  meter.max=boss.maximumLife;meter.value=boss.life;
  $('#boss-label').textContent=boss.name+(boss.enraged?' · 第二階段':'');
  $('#boss-hp').textContent=Math.ceil(boss.life)+' / '+boss.maximumLife;
 }
 const hud=$('#zone-objective');
 hud.hidden=!trial;
 if(trial){
  if(trial.phase==='waves'){
   const secs=Math.max(0,Math.ceil(trial.duration-state.time-1e-9));
   const remaining=trial.total-trial.generated+state.enemies.filter(e=>!e.boss).length;
   hud.textContent=(trial.boss?'尾王倒數 ':'區域倒數 ')+Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0')+' · 普通怪剩 '+remaining+'/'+trial.total+' · 在場 '+state.enemies.length+'/'+trial.maxActive;
  }else if(trial.phase==='boss'){
   hud.textContent=(trial.bossReason==='clear'?'清怪提前出王':'倒數到時出王')+' · '+trial.boss.name;
  }else if(trial.phase==='glyphs')hud.textContent='收集剩餘雕紋';
  else hud.textContent=trial.stageName+'通關'+(trialStage((state.routeIndex??0)+1)?'':' · 第一章完成');
  if(trial.glyphs.length&&trial.phase!=='cleared')hud.textContent+=' · 雕紋 '+trial.glyphs.filter(g=>g.taken).length+'/3';
 }
 const next=trialStage((state.routeIndex??0)+1);
 const onward=$('#next-zone');onward.hidden=!trial||state.dead||trial.phase!=='cleared'||!next;
 if(!onward.hidden)onward.textContent='前往'+next.name;
 const back=$('#return-town');back.hidden=!trial||(!state.dead&&trial.phase!=='cleared');
 if(!back.hidden)back.textContent=state.dead?'返回獅眼守望 · 重試':'返回獅眼守望';
 if(state.time>=toastUntil)$('#toast').textContent='';
 const showReward=(state.zone==='trial'||state.zone==='town')&&state.progression.pendingChoices>0&&!state.dead;
 if(showReward&&reward.hidden)renderLevelReward();
 reward.hidden=!showReward;town.inert=showReward;
 if(!showReward)activeCurrencyChoices=null;
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
