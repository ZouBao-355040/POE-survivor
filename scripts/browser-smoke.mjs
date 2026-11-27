import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const launchOptions={headless:true};
if(process.env.CHROMIUM_EXECUTABLE)launchOptions.executablePath=process.env.CHROMIUM_EXECUTABLE;
const browser=await chromium.launch(launchOptions);
const entry=process.env.GAME_URL??'http://127.0.0.1:8123/';
async function verify(viewport,mobile){
 const page=await browser.newPage({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1});
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
 assert.match(await text('.brand'),/v0\.5\.3/);
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
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
 const rewardOrb=choices[0].replace(/ ×1$/,'');
 await btn(choices[0],reward).click();
 assert.equal(await reward.isVisible(),false);
 const inTown=await snapshot();await page.clock.runFor(1800);assert.deepEqual(await snapshot(),inTown);
 const services=page.locator('#town-dialog');
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
 assert.equal(await btn('取出 '+rewardOrb,services).isVisible(),true);
 assert.equal(await btn('存入 '+rewardOrb,services).count(),0);
 await btn('取出 '+rewardOrb,services).click();
 await btn('存入 '+rewardOrb,services).click();
 await btn(/^存入 動量/,services).click();
 await btn(/^取出 動量/,services).click();
 await btn('關閉',services).click();
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
   if(await reward.isVisible())await reward.getByRole('button').first().click();
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
  await btn('前往炙熱鹽沼').click();
  assert.equal(await text('#gold-hud'),walletBefore);
  assert.match(await text('#field-loot'),/[1-9]\d* 金幣/);
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
 console.log((mobile?'手機':'桌面')+' '+viewport.width+'×'+viewport.height+'：開場普攻、教學、城門頭目、進城、購買、賭裝、倉庫存取、主線寶石、回城結算、通貨三選一、穿戴插槽與兩種龍捲射擊通過。');
 await page.close();
}
async function verifyBeachRetry(){
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true});
 // Use a one-shot, test-only death after the first loot event. Real movement and retry controls are unchanged.
 await page.addInitScript(()=>{Math.random=()=>.4;});
 await page.route('**/play.mjs?v=0.5.3',async route=>{
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
try{
 if(process.env.VERIFY_BEACH_RETRY==='1'||new URL(entry).hostname==='127.0.0.1')await verifyBeachRetry();
 await verify({width:412,height:892},true);
 await verify({width:1100,height:730},false);
}finally{await browser.close();}
