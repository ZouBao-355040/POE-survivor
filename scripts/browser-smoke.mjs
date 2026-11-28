import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const launchOptions={headless:true};
if(process.env.CHROMIUM_EXECUTABLE)launchOptions.executablePath=process.env.CHROMIUM_EXECUTABLE;
if(process.env.BROWSER_PROXY)launchOptions.proxy={server:process.env.BROWSER_PROXY};
const browser=await chromium.launch(launchOptions);
const entry=process.env.GAME_URL??'http://127.0.0.1:8123/';
async function verify(viewport,mobile){
 const page=await browser.newPage({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const failures=[];
 page.on('pageerror',e=>failures.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))failures.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&/\.mjs(\?|$)|\.css(\?|$)/.test(r.url()))failures.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{
  Math.random=()=>.40;
  window.tornadoDraw={swirls:0,landingMarkers:0};
  for(const [method,stat] of [['arc','swirls'],['ellipse','landingMarkers']]){
   const original=CanvasRenderingContext2D.prototype[method];
   CanvasRenderingContext2D.prototype[method]=function(...args){
    if(this.strokeStyle==='#c8e5dc')window.tornadoDraw[stat]++;
    return original.apply(this,args);
   };
  }
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 const btn=(name,target=page)=>target.getByRole('button',{name,exact:typeof name==='string'});
 const text=s=>page.locator(s).innerText();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('絕望岩灘'));
 assert.match(await text('.brand'),/v0\.5\.16/);
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
 assert.equal(await page.locator('#guide-choice').getByRole('combobox').count(),0);
 assert.equal(await text('#campaign-character'),'遊俠');
 await btn('跳過教學').click();
 await page.clock.runFor(250);
 assert.match(await text('#hint'),/^普通攻擊/);
 assert.match(await text('#flask-mana'),/^藍水 24\/24$/);
 assert.equal(await btn('進入獅眼守望').isVisible(),false);
 assert.match(await text('#boss-label'),/西拉克/);
 assert.equal(await text('#boss-hp'),'88 / 88');
 assert.equal(await btn('重新開始').isVisible(),false);
 await btn('選單').click();
 await btn('重新開始').click();
 assert.ok(await btn('確認重開本局').isVisible());
 assert.match(await text('#status'),/^絕望岩灘/);
 await btn('回到遊戲').click();
 assert.equal(await btn('跳過教學').isVisible(),false);
 await btn('選單').click();
 await btn('重新開始').click();
 await btn('確認重開本局').click();
 assert.equal(await page.locator('#guide-choice').getByRole('combobox').count(),0);
 assert.equal(await text('#campaign-character'),'遊俠');
 await btn('要教學').click();
 const bag=page.locator('#gem-panel');
 assert.match(await bag.innerText(),/步驟 1／3/);
 assert.equal(await bag.getByRole('heading',{name:'武器',exact:true}).count(),1);
 assert.equal(await bag.getByRole('heading',{name:'胸甲',exact:true}).count(),1);
 for(const slot of ['鞋子','頭盔','手套'])assert.equal(await bag.getByRole('heading',{name:slot,exact:true}).count(),0);
 await btn(/^燃燒箭矢 · 等級 1/,bag).click();
 assert.match(await bag.innerText(),/步驟 2／3/);
 await btn('○',bag).first().click();
 assert.match(await bag.innerText(),/目前技能：普通攻擊/);
 assert.match(await bag.innerText(),/步驟 3／3/);
 await btn('燃燒箭矢 1',bag).click();
 assert.match(await bag.innerText(),/目前技能：燃燒箭矢/);
 await btn('完成教學，開始戰鬥',bag).click();
 await page.clock.runFor(1000);
 assert.ok(Number((await text('#flask-mana')).match(/藍水 (\d+)\/24/)?.[1])<24);
 await btn('寶石').click();
 const snapshot=()=>page.evaluate(()=>[
  document.querySelector('#status').textContent,document.querySelector('#life').value,
  document.querySelector('#mana').value,document.querySelector('#flask-life').textContent,
  document.querySelector('#flask-mana').textContent,document.querySelector('canvas').toDataURL()]);
 const paused=await snapshot();await page.clock.runFor(1300);
 assert.deepEqual(await snapshot(),paused,'world, flask and battlefield must freeze');
 await btn('關閉',bag).click();
 await page.keyboard.down('d');
 await page.clock.runFor(7900);
 await page.keyboard.up('d');
 for(let i=0;i<6&&!await btn('進入獅眼守望').isVisible();i++)await page.clock.runFor(1800);
 assert.ok(await btn('進入獅眼守望').isVisible(),await text('#status'));
 assert.match(await text('#gold-hud'),/^金幣 0$/);
 assert.match(await text('#field-loot'),/西拉克戰利品/);
 await btn('進入獅眼守望').click();
 await page.clock.runFor(200);
 assert.ok(await page.getByRole('heading',{name:'獅眼守望',exact:true}).isVisible());
 assert.match(await text('#opening-loot'),/西拉克戰利品：\d+ 金幣、[^、]+、/);
 assert.match(await text('#town-loot'),/回城已收取：\d+ 金幣、1 顆通貨、0 顆寶石、1 件裝備/);
 assert.equal(await page.locator('#field-loot').isVisible(),false);
 const reward=page.locator('#reward');
 assert.match(await reward.innerText(),/通貨三選一/);
 const choices=await reward.getByRole('button').allTextContents();
 assert.equal(new Set(choices).size,3);
 const rewardOrb='改造石';
 assert.ok(choices.includes(rewardOrb+' ×1'));
 await btn(rewardOrb+' ×1',reward).click();
 assert.equal(await reward.isVisible(),false);
 const inTown=await snapshot();await page.clock.runFor(1800);assert.deepEqual(await snapshot(),inTown);
 const services=page.locator('#town-dialog');
 await btn(/^天賦( \d+)?$/).click();
 assert.equal(await services.locator('[data-talent-id="50459"]').getAttribute('data-talent-state'),'start');
 assert.match(await services.locator('.talent-points').innerText(),/^遊俠/);
 const talent=services.locator('[data-talent-id="39821"]');
 assert.equal(await talent.getAttribute('data-talent-state'),'available');
 await talent.click();
 assert.match(await services.locator('.talent-details').innerText(),/最大生命 \+14/);
 await services.locator('[data-talent-allocate="39821"]').click();
 await page.clock.runFor(50);
 assert.equal(await talent.getAttribute('data-talent-state'),'allocated');
 assert.match(await text('#life-num'),/84\/84/);
 assert.match(await services.locator('.talent-points').innerText(),/剩餘 0 點/);
 assert.equal(await services.locator('[data-talent-id="2094"]').getAttribute('data-talent-state'),'locked');
 const talentSearch=services.getByRole('searchbox',{name:'搜尋天賦'});
 await talentSearch.fill('54447');
 const otherStart=services.locator('[data-talent-id="54447"]');
 assert.equal(await otherStart.getAttribute('data-talent-state'),'locked');
 await otherStart.click();
 assert.equal(await services.locator('[data-talent-allocate="54447"]').isEnabled(),false);
 await services.getByLabel('篩選天賦').selectOption('keystone');
 await talentSearch.fill('精準技巧');
 await services.locator('[data-talent-id="63620"]').click();
 assert.match(await services.locator('.talent-details').innerText(),/40% 更多攻擊傷害/);
 await services.getByLabel('篩選天賦').selectOption('mastery');
 await talentSearch.fill('5826');
 await services.locator('[data-talent-id="5826"]').click();
 assert.match(await services.locator('.talent-details').innerText(),/同群|重要天賦/);
 await btn('關閉',services).click();
 await btn('裝備').click();
 assert.equal(await services.locator('.equipment-grid .gear-icon').count(),2);
 const bow=services.locator('.equipment-grid .gear-icon use').first();
 assert.match(await bow.getAttribute('href'),/#weapon$/);
 await page.waitForFunction(()=>document.querySelector(".equipment-grid svg use")?.getBBox().width>0);
 await btn('關閉',services).click();
 await btn(/^裝備打造/).click();
 await services.getByRole('combobox',{name:'選擇裝備'}).selectOption('starter-body');
 assert.ok(await btn('一般通貨',services).isVisible());
 await btn(/^改造石.*倉庫/s,services).click();
 assert.ok(await btn('打造 · 改造石 ×1',services).isDisabled());
 assert.match(await services.locator('.craft-footer').innerText(),/只能用在魔法裝備/);
 await services.getByRole('combobox',{name:'選擇裝備'}).selectOption('gear-1');
 const apply=btn('打造 · 改造石 ×1',services);
 assert.equal(await apply.isEnabled(),true);
 const icon=services.locator('.craft-item .gear-icon use');
 assert.match(await icon.getAttribute('href'),/#body$/);
 const beforeIcon=await icon.getAttribute('href');
 const target=services.getByRole('combobox',{name:'選擇裝備'});
 assert.equal(await target.inputValue(),'gear-1');
 assert.match(await services.locator('.craft-item').innerText(),/魔法/);
 await apply.click();
 assert.match(await services.locator('.craft-item').innerText(),/魔法/);
 assert.ok(await services.locator('.craft-item .craft-affix').count()>=1);
 assert.equal(await target.inputValue(),'gear-1');
 assert.equal(await icon.getAttribute('href'),beforeIcon);
 assert.match(await btn(/^改造石.*倉庫/s,services).innerText(),/倉庫 1/);
 assert.ok(await apply.isEnabled());
 await apply.click();
 assert.equal(await target.inputValue(),'gear-1');
 assert.match(await btn(/^改造石.*倉庫/s,services).innerText(),/倉庫 0/);
 assert.ok(await apply.isDisabled());
 const bounds=await services.locator('.craft-footer').boundingBox(),dialogBounds=await services.boundingBox();
 assert.ok(bounds.y+bounds.height<=dialogBounds.y+dialogBounds.height+.5,'craft action stays in view');
 await btn('關閉',services).click();
 await btn(/^裝備賭商/).click();
 assert.ok(await services.getByRole('heading',{name:'裝備背包'}).isVisible());
 await btn('賭鞋子 · 6 金幣',services).click();
 const equip=btn(/^穿戴 .*靴/,services);
 assert.ok(await equip.isVisible());
 await equip.click();
 await btn('關閉',services).click();
 await btn('寶石').click();
 const bootRow=bag.locator('.gem-row').filter({has:page.getByRole('heading',{name:'鞋子',exact:true})});
 assert.equal(await btn('○',bootRow).count(),4);
 await btn(/^動量輔助 · 等級 1/,bag).click();
 await btn('○',bootRow).first().click();
 assert.equal(await btn(/^動量輔助 1$/,bootRow).count(),1);
 await btn('關閉',bag).click();
 await btn(/^裝備賭商/).click();
 await btn(/^卸下 .*靴/,services).click();
 await btn('關閉',services).click();
 await btn('寶石').click();
 assert.equal(await bootRow.count(),0);
 assert.equal(await btn(/^動量輔助 · 等級 1/,bag).count(),1);
 await btn('關閉',bag).click();
 await btn(/^裝備賭商/).click();
 await btn('關閉',services).click();
 await btn(/^倉庫保管員/).click();
 const deposit=btn(/^存入 .*靴/,services);assert.ok(await deposit.isVisible());
 await deposit.click();
 await btn(/^取出 .*靴/,services).click();
 assert.equal(await services.locator('.currency-vault .currency-cell').count(),5);
 assert.match(await services.locator('.currency-cell').filter({hasText:rewardOrb}).innerText(),/×0/);
 assert.equal(await btn('取出 '+rewardOrb,services).count(),0);
 assert.equal(await btn('存入 '+rewardOrb,services).count(),0);
 await btn(/^存入 動量/,services).click();
 await btn('關閉',services).click();
 await btn('寶石').click();
 const stored=btn(/^倉庫：動量輔助/,bag);
 assert.ok(await stored.isVisible());
 await stored.click();
 await btn('○',bag).first().click();
 assert.equal(await stored.count(),0);
 assert.equal(await btn(/^動量輔助 1$/,bag).count(),1);
 await btn('關閉',bag).click();
 await btn(/^寶石商/).click();
 const search=services.getByRole('searchbox',{name:'搜尋商店寶石'});
 await search.fill('龍捲射擊');
 const tornado=btn(/^龍捲射擊 · 3 金幣/,services);
 assert.equal(await tornado.isDisabled(),true);
 assert.match(await tornado.innerText(),/抵達第三章.*角色等級 28/s);
 assert.equal(await btn(/^龍捲射擊．雲爆/,services).count(),0);
 await btn('輔助寶石',services).click();
 await search.fill('覺醒');
 assert.equal(await services.locator('.shop-item').count(),0);
 await btn('主動技能',services).click();
 await search.fill('裂化箭矢');
 const before=Number((await text('#shop-wallet')).split('：')[1]);
 assert.ok(before>=3);
 await btn(/^裂化箭矢 · 3 金幣/,services).click();
 assert.equal(await text('#shop-wallet'),'持有金幣：'+(before-3));
 await btn('關閉',services).click();
 await btn('前往暮光海灘').click();
 await page.clock.runFor(300);
 assert.match(await text('#status'),/^暮光海灘/);
 assert.ok((await text('#zone-objective')).includes('在場 12/12'));
 if(!mobile&&process.env.VERIFY_ROUTE==='1'){
  let sawBoss=false;
  const keys=['d','d','s','s','a','a','w','w'];
  for(let turn=0;turn<300;turn++){
   if(await btn('前往炙熱鹽沼').isVisible())break;
   if((await text('#status')).includes('已死亡'))throw new Error('Browser walkthrough died at '+await text('#status'));
   if(await reward.isVisible()){
    const orb=btn('點金石 ×1',reward);
    if(process.env.VERIFY_LOOT_RETURN==='1'&&await orb.isVisible())await orb.click();else await reward.getByRole('button').first().click();
   }
   if(await page.locator('#boss-hud').isVisible()){
    assert.match(await text('#boss-label'),/怒炎之使/);
    assert.match(await text('#boss-hp'),/700$/);
    sawBoss=true;
   }
   const key=keys[turn%keys.length];
   await page.keyboard.down(key);await page.clock.runFor(680);await page.keyboard.up(key);
  }
  assert.ok(sawBoss,'portrait HUD must render during the real boss fight');
  while(await reward.isVisible())await reward.getByRole('button').first().click();
  const walletBefore=await text('#gold-hud');
  assert.match(await text('#field-loot'),/[1-9]\d* 裝備/);
  if(process.env.VERIFY_LOOT_RETURN==='1'){
   await btn('返回獅眼守望').click();
   await page.clock.runFor(160);
   assert.match(await text('#town-loot'),/[1-9]\d* 件裝備/);
   assert.ok(Number((await text('#gold-hud')).split(' ')[1])>Number(walletBefore.split(' ')[1]));
   assert.equal(await page.locator('#field-loot').isVisible(),false);
   await btn('裝備').click();
   assert.match(await services.innerText(),/掉落：暮光海灘 · 怒炎之使/);
   await btn('關閉',services).click();
   await btn(/^裝備打造/).click();
   await services.getByRole('combobox',{name:'選擇裝備'}).selectOption('gear-3');
   assert.match(await services.locator('.craft-item').innerText(),/普通.*物品等級 4/s);
   await btn(/^點金石.*倉庫/s,services).click();
   await btn('打造 · 點金石 ×1',services).click();
   assert.match(await services.locator('.craft-item').innerText(),/稀有/);
   await btn('關閉',services).click();
   console.log('暮光海灘實戰掉裝：只在回城後入包，且可使用升級拿到的點金石加工。');
  }
  await btn('前往炙熱鹽沼').click();
  if(process.env.VERIFY_LOOT_RETURN!=='1'){
   assert.equal(await text('#gold-hud'),walletBefore);
   assert.match(await text('#field-loot'),/[1-9]\d* 金幣/);
  }
  await page.clock.runFor(200);
  assert.match(await text('#status'),/^炙熱鹽沼/);
  assert.match(await text('#zone-objective'),/雕紋 0\/3/);
  console.log('實戰瀏覽器流程：看得到怒炎之使血條，擊殺後進入炙熱鹽沼。');
 }
 await btn('寶石').click();
 assert.ok(await btn(/^裂化箭矢 · 等級 1/,bag).isVisible());
 await btn('PoE 寶石圖鑑',bag).click();
 await bag.getByRole('searchbox').fill('Fireball of Radiation');
 assert.equal(await bag.locator('.index-item').count(),1);
 await btn('技能試射',bag).click();
 await bag.getByRole('searchbox').fill('Split Arrow');
 await btn(/^裂化箭矢 以較寬/,bag).click();
 await page.clock.runFor(450);
 assert.match(await text('#status'),/試射場/);
 await btn('寶石').click();
 await btn(/^高階多重投射輔助 · 等級 1/,bag).click();
 await btn('○',bag).first().click();
 assert.match(await bag.innerText(),/生效輔助：高階多重投射輔助/);
 await btn(/^覺醒．高階多重投射輔助 · 等級 1/,bag).click();
 await btn('○',bag).first().click();
 assert.match(await bag.getByText(/生效輔助：/).innerText(),/覺醒．高階多重投射輔助$/);
 await btn('關閉',bag).click();
 if(mobile){
  const cdp=await page.context().newCDPSession(page);
  const canvas=page.locator('canvas'),rect=await canvas.boundingBox();
  const x=Math.round(rect.width/2),y=Math.round(rect.height*.55),prev=await canvas.evaluate(n=>n.toDataURL());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y}]});
  await page.clock.runFor(300);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await canvas.evaluate(n=>n.toDataURL()),prev);
 }
 await btn('寶石').click();
 await btn('手動 裂化箭矢',bag).click();
 assert.match(await bag.innerText(),/裂化箭矢 · 手動限定/);
 await btn('關閉',bag).click();
 const manual=page.locator('#manual-skill');
 assert.match(await manual.innerText(),/裂化箭矢/);
 await page.clock.runFor(1650);
 assert.equal(await manual.isEnabled(),true);
 const beforeManual=Number(await page.locator('#mana').getAttribute('value'));
 if(mobile)await manual.tap();else await page.keyboard.press('Space');
 await page.clock.runFor(40);
 assert.equal(await manual.isDisabled(),true);
 assert.ok(Number(await page.locator('#mana').getAttribute('value'))<beforeManual);
 for(const [name,button,payload] of [
  ['Tornado Shot',/^龍捲射擊 每支主箭/,false],
  ['Cloudburst',/^龍捲射擊．雲爆 單支載箭/,true]
 ]){
  await btn('寶石').click();
  await btn('技能試射',bag).click();
  await bag.getByRole('searchbox').fill(name);
  await page.evaluate(()=>{window.tornadoDraw={swirls:0,landingMarkers:0};});
  await btn(button,bag).click();
  await page.clock.runFor(650);
  assert.match(await text('#hint'),/^龍捲射擊/);
  const draw=await page.evaluate(()=>window.tornadoDraw);
  assert.ok(draw.swirls>=3,'actual canvas should render the burst');
  assert.equal(draw.landingMarkers>0,payload,'only Cloudburst marks an airborne landing');
 }
 assert.deepEqual(failures,[]);
 console.log((mobile?'手機':'桌面')+' '+viewport.width+'×'+viewport.height+'：開場普攻、教學、城門頭目、進城、購買、賭裝、倉庫存取、主線寶石、回城結算、固定通貨倉與打造、有效天賦、穿戴插槽、手動施放與兩種龍捲射擊通過。');
 await page.close();
}
async function verifyBeachRetry(){
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 // Use a one-shot, test-only death after the first loot event. Real movement and retry controls are unchanged.
 await page.addInitScript(()=>{Math.random=()=>.4;});
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker="if(ev.target===hillockId&&!state.dead)notify(";
  assert.ok(source.includes(marker));
  await route.fulfill({response,body:source.replace(marker,
   "if(!window.__retryTestDeath&&state.zone==='beach'&&state.pendingLoot.gold>0){window.__retryTestDeath=true;state.dead=true;state.player.life=0;}"+marker)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 await page.clock.runFor(3500);
 const retry=page.getByRole('button',{name:'從岩灘重試 · 保留戰利品'});
 assert.ok(await retry.isVisible());
 const pending=await page.locator('#field-loot').innerText();
 assert.match(pending,/待回城：1 金幣/);
 assert.equal(await page.locator('#town-entry').isVisible(),false);
 await retry.click();
 await page.clock.runFor(75);
 assert.equal(await retry.isVisible(),false);
 assert.equal(await page.locator('#life-num').innerText(),'70/70');
 assert.equal(await page.locator('#field-loot').innerText(),pending);
 assert.match(await page.locator('#status').innerText(),/擊殺 1/);
 assert.equal(await page.locator('#town-entry').isVisible(),false);
 await page.close();
 console.log('岩灘重試：死亡後保留待結算戰利品、恢復生命，城門仍未開啟。');
}
async function verifyVaalPact(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:20};
 for(const id of tracePath(p,10808).slice(1,-1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  await route.fulfill({response,body:source.replace(marker,
   `state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`)
   .replace(allocation,'if(id===10808){state.player.life=20;state.flasks.life={charges:21,remaining:2};}'+allocation)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 await page.locator('#talent-open').click();
 await page.getByRole('searchbox',{name:'搜尋天賦'}).fill('瓦爾冥約');
 const node=page.locator('[data-talent-id="10808"]');
 assert.equal(await node.getAttribute('data-talent-state'),'available');
 await node.click();
 assert.match(await page.locator('.talent-details').innerText(),/近戰傷害的生命偷取立即生效/);
 await page.locator('[data-talent-allocate="10808"]').click();
 assert.equal(await node.getAttribute('data-talent-state'),'allocated');
 await page.keyboard.press('Escape');
 await page.clock.runFor(900);
 assert.equal(await page.locator('#flask-life').innerText(),'紅水 21/21 · 停用');
 assert.equal(await page.locator('#flask-life').getAttribute('data-active'),'false');
 assert.match(await page.locator('#life-num').innerText(),/^20\//);
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('瓦爾冥約：手機天賦實際配置後，紅水停止回復且保留充能。');
}
async function verifyGhostDance(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:25};
 for(const id of tracePath(p,35255).slice(1,-1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  await route.fulfill({response,body:source.replace(marker,
    `state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`)
   .replace(allocation,"updateEquipment();if(id===35255){Object.assign(state.player,{energyShield:20,maximumEnergyShield:150,evasion:100,esRegen:0,shieldInterruptedAt:state.time+100,defence:{},ghostClock:0,ghostShrouds:0});state.enemyCasts=[{x:0,y:0,source:'test',impactAt:state.time+2.6,radius:1,damage:8,element:'fire'}];}return state.progression;")});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 await page.locator('#talent-open').click();
 await page.getByRole('searchbox',{name:'搜尋天賦'}).fill('鬼舞');
 const node=page.locator('[data-talent-id="35255"]');
 assert.equal(await node.getAttribute('data-talent-state'),'available');
 await node.click();
 assert.match(await page.locator('.talent-details').innerText(),/閃避值 3%/);
 await page.locator('[data-talent-allocate="35255"]').click();
 assert.equal(await node.getAttribute('data-talent-state'),'allocated');
 await page.keyboard.press('Escape');
 await page.clock.runFor(2150);
 assert.equal(await page.locator('#es-meter').innerText(),'護盾 20/150 · 鬼影 1/3');
 await page.clock.runFor(650);
 assert.equal(await page.locator('#es-meter').innerText(),'護盾 15/150 · 鬼影 0/3');
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('鬼舞：手機配置後累積鬼影，實際吃到敵方法術時回復護盾並消耗一層。');
}
async function verifyAttackRecovery(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:60};
 for(const n of [6042,27788])for(const id of tracePath(p,n).slice(1,-1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Math.random=()=>.4;});
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  const fixture=`updateEquipment();if(id===6042||id===27788){
    Object.assign(state.player,{life:20,maximumLife:100,lifeRegen:0});
    state.flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
    state.enemies=[{id:'recovery-fixture',x:2.3,y:0,life:id===6042?1000:1,maximumLife:1000,speed:0,defence:{},evasion:0,radius:.4}];
    state.projectiles=[];state.cooldown=0;
   }return state.progression;`;
  await route.fulfill({response,body:source.replace(marker,
    `state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`)
   .replace(allocation,fixture)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 const allocateThroughUI=async(id,description)=>{
  await page.locator('#talent-open').click();
  await page.getByRole('searchbox',{name:'搜尋天賦'}).fill(String(id));
  const node=page.locator(`[data-talent-id="${id}"]`);
  assert.equal(await node.getAttribute('data-talent-state'),'available');
  await node.click();
  assert.match(await page.locator('.talent-details').innerText(),description);
  await page.locator(`[data-talent-allocate="${id}"]`).click();
  assert.equal(await node.getAttribute('data-talent-state'),'allocated');
  await page.keyboard.press('Escape');
 };
 await allocateThroughUI(6042,/攻擊擊中一名敵人/);
 await page.clock.runFor(450);
 assert.equal(await page.locator('#life-num').innerText(),'25/100');
 await allocateThroughUI(27788,/擊殺時回復 2%/);
 await page.clock.runFor(450);
 assert.equal(await page.locator('#life-num').innerText(),'27/100');
 assert.match(await page.locator('#status').innerText(),/擊殺 1/);
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('擊中與擊殺回復：手機配置兩個節點後，普攻命中 +5，最後一擊另外 +2。');
}
async function verifySkillCost(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:30};
 for(const id of tracePath(p,27788).slice(1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Math.random=()=>.4;});
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  const fixture=`updateEquipment();if(id===292&&option===38454){
    Object.assign(state.player,{life:20,maximumLife:100,lifeRegen:0,mana:28,maximumMana:60,manaRegenMultiplier:0,manaRegenFlat:0});
    state.flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
    state.enemies=[{id:'cost-fixture',x:2.3,y:0,life:1000,maximumLife:1000,speed:0,defence:{},evasion:0,radius:.4}];
    state.projectiles=[];state.cooldown=0;
    inventory.equip('burning-arrow','weapon',0);inventory.setMode('burning-arrow','auto');
   }return state.progression;`;
  await route.fulfill({response,body:source.replace(marker,
    `state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`)
   .replace(allocation,fixture)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 await page.locator('#talent-open').click();
 await page.getByRole('searchbox',{name:'搜尋天賦'}).fill('292');
 await page.locator('[data-talent-id="292"]').click();
 const option=page.locator('[data-mastery-effect="38454"]');
 assert.equal(await option.isEnabled(),true);
 await option.click();
 assert.equal(await option.innerText(),'已選擇');
 await page.keyboard.press('Escape');
 await page.clock.runFor(500);
 assert.equal(await page.locator('#life-num').innerText(),'19/100');
 assert.equal(await page.locator('#mana-num').innerText(),'22/60');
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('技能消耗：手機配置生命專精後，實際一次燃燒箭矢扣除 6 魔力及 1 生命。');
}
async function verifyWindAndAgony(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:30};
 for(const end of [11239,23407])for(const id of tracePath(p,end).slice(1,-1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{Math.random=()=>.4;});
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  const fixture=`updateEquipment();if(id===11239||id===23407){
    Object.assign(state.player,{life:70,maximumLife:100,lifeRegen:0,energyShield:0,maximumEnergyShield:0,evasion:0,defence:{},lastAttackHit:undefined});
    state.flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
    state.cooldown=99;
    state.enemies=id===11239?[{id:'wind-fixture',x:.2,y:0,radius:.4,life:1000,maximumLife:1000,speed:0,evasion:0,accuracy:1000,defence:{},attack:{baseDamage:{physical:10},attacksPerSecond:1.5}}]:
      [{id:'agony-fixture',x:2.3,y:0,radius:.4,life:1000,maximumLife:1000,speed:0,evasion:0,defence:{},boss:true,name:'絕對受難測試目標'}];
    state.projectiles=id===23407?[{x:0,y:0,dx:1,dy:0,speed:35,remainingRange:4,skill:{id:'agony-probe',source:'spell',active:{tags:[]},baseDamage:{fire:10},criticalChance:1,criticalMultiplier:2.5},rolls:{critical:0,confirmation:0,block:.4,ignite:.4}}]:[];
   }return state.progression;`;
  await route.fulfill({response,body:source.replace(marker,`state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`).replace(allocation,fixture)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 const pick=async(id,check)=>{
  await page.locator('#talent-open').click();
  await page.getByRole('searchbox',{name:'搜尋天賦'}).fill(String(id));
  await page.locator(`[data-talent-id="${id}"]`).click();
  assert.match(await page.locator('.talent-details').innerText(),check);
  await page.locator(`[data-talent-allocate="${id}"]`).click();
  await page.keyboard.press('Escape');
 };
 await pick(11239,/近期未被攻擊擊中/);
 await page.clock.runFor(250);
 assert.equal(await page.locator('#life-num').innerText(),'62/100');
 await page.clock.runFor(550);
 assert.equal(await page.locator('#life-num').innerText(),'50/100');
 await pick(23407,/暴擊不造成額外擊中傷害/);
 await page.clock.runFor(250);
 const hp=()=>page.locator('#boss-meter').evaluate(node=>node.value);
 const first=await hp();
 assert.ok(first>=980&&first<990,first);
 await page.clock.runFor(450);
 assert.ok(await hp()<980);
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('風魔舞者與絕對受難：手機配置後，首擊減傷、再擊增傷、暴擊傷害轉為點燃均實測。');
}
async function verifyEnemyArrows(){
 const {allocate,tracePath}=await import('../engine/passive-tree.mjs');
 let p={characterClass:'Ranger',level:1,passivePoints:30};
 for(const id of tracePath(p,54922).slice(1,-1))p=allocate(p,id);
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:!!process.env.BROWSER_PROXY});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  Math.random=()=>.4;
  window.arrowDraw={windup:0,arrow:0};
  const original=CanvasRenderingContext2D.prototype.stroke;
  CanvasRenderingContext2D.prototype.stroke=function(...args){
   if(this.strokeStyle==='#efaaee')window.arrowDraw.windup++;
   if(this.strokeStyle==='#ffbaff')window.arrowDraw.arrow++;
   return original.apply(this,args);
  };
 });
 await page.route('**/play.mjs?v=0.5.16',async route=>{
  const response=await route.fetch(),source=await response.text();
  const marker='updateEquipment({refill:true});guideChoice.close();';
  const allocation='updateEquipment();return state.progression;';
  assert.ok(source.includes(marker)&&source.includes(allocation));
  const fixture=`updateEquipment();if(id===54922){
    Object.assign(state.player,{life:50,maximumLife:50,evasion:0,lifeRegen:0,speed:4});
    state.flasks={life:{charges:0,remaining:0},mana:{charges:0,remaining:0}};
    state.projectiles=[];state.cooldown=99;
    state.enemies=[{id:'archer',name:'遠古之弓',family:'ancient-archer',x:5,y:0,life:1000,maximumLife:1000,speed:0,evasion:0,accuracy:1000,defence:{},radius:.38,attackRange:7,attack:{baseDamage:{physical:10},attacksPerSecond:.45},arrow:{speed:12,windup:.48,lifetime:.92}}];
   }return state.progression;`;
  await route.fulfill({response,body:source.replace(marker,`state.progression=${JSON.stringify(p)};updateEquipment({refill:true});state.enemies=[];guideChoice.close();`).replace(allocation,fixture)});
 });
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'跳過教學'}).click();
 await page.locator('#talent-open').click();
 await page.getByRole('searchbox',{name:'搜尋天賦'}).fill('54922');
 const node=page.locator('[data-talent-id="54922"]');
 assert.equal(await node.getAttribute('data-talent-state'),'available');
 await node.click();
 assert.match(await page.locator('.talent-details').innerText(),/閃避值加倍/);
 await page.locator('[data-talent-allocate="54922"]').click();
 await page.keyboard.press('Escape');
 await page.clock.runFor(250);
 const cue=await page.evaluate(()=>({...window.arrowDraw}));
 assert.ok(cue.windup>0);
 assert.equal(cue.arrow,0);
 await page.keyboard.down('w');
 await page.clock.runFor(270);
 await page.keyboard.up('w');
 await page.clock.runFor(600);
 const arrow=await page.evaluate(()=>window.arrowDraw.arrow);
 assert.ok(arrow>0);
 assert.equal(await page.locator('#life-num').innerText(),'50/50');
 assert.deepEqual(errors,[]);
 await page.close();
 console.log('箭舞與敵方箭矢：手機實測可見射擊路線，箭真的飛過，走位閃開不扣血。');
}
try{
 if(process.env.VERIFY_BEACH_RETRY==='1'||new URL(entry).hostname==='127.0.0.1'){await verifyBeachRetry();await verifyVaalPact();await verifyGhostDance();await verifyAttackRecovery();await verifySkillCost();await verifyWindAndAgony();await verifyEnemyArrows();}
 await verify({width:412,height:892},true);
 await verify({width:1100,height:730},false);
}finally{await browser.close();}
