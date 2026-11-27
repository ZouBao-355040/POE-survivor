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
 await page.addInitScript(()=>{Math.random=()=>.40;});
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 const btn=(name,target=page)=>target.getByRole('button',{name,exact:typeof name==='string'});
 const text=s=>page.locator(s).innerText();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('絕望岩灘'));
 assert.match(await text('.brand'),/v0\.5\.0/);
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
 await btn('進入獅眼守望').click();
 await page.clock.runFor(200);
 assert.ok(await page.getByRole('heading',{name:'獅眼守望',exact:true}).isVisible());
 assert.match(await text('#opening-loot'),/西拉克戰利品：\d+ 金幣、[^、]+、/);
 const inTown=await snapshot();await page.clock.runFor(1800);assert.deepEqual(await snapshot(),inTown);
 const services=page.locator('#town-dialog');
 await btn(/^裝備賭商/).click();
 assert.ok(await services.getByRole('heading',{name:'裝備背包'}).isVisible());
 await btn('賭鞋子 · 6 金幣',services).click();
 const equip=btn(/^穿戴 .*靴/,services);
 assert.ok(await equip.isVisible());
 await equip.click();
 await btn(/^卸下 .*靴/,services).click();
 await btn('關閉',services).click();
 await btn(/^倉庫保管員/).click();
 const deposit=btn(/^存入 .*靴/,services);assert.ok(await deposit.isVisible());
 await deposit.click();
 await btn(/^取出 .*靴/,services).click();
 await btn(/^存入 .*石/,services).click();
 await btn(/^取出 .*石/,services).click();
 await btn(/^存入 動量/,services).click();
 await btn(/^取出 動量/,services).click();
 await btn('關閉',services).click();
 await btn(/^寶石商/).click();
 await services.getByRole('searchbox',{name:'搜尋商店寶石'}).fill('裂化箭矢');
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
   if(await btn('繼續戰鬥',page.locator('#reward')).isVisible())await btn('繼續戰鬥',page.locator('#reward')).click();
   if(await page.locator('#boss-hud').isVisible()){
    assert.match(await text('#boss-label'),/怒炎之使/);
    assert.match(await text('#boss-hp'),/700$/);
    sawBoss=true;
   }
   const key=keys[turn%keys.length];
   await page.keyboard.down(key);await page.clock.runFor(680);await page.keyboard.up(key);
  }
  assert.ok(sawBoss,'portrait HUD must render during the real boss fight');
  await btn('前往炙熱鹽沼').click();
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
 assert.deepEqual(failures,[]);
 console.log((mobile?'手機':'桌面')+' '+viewport.width+'×'+viewport.height+'：開場普攻、教學、城門頭目、進城、購買、賭裝、倉庫存取與出鎮通過。');
 await page.close();
}
try{
 await verify({width:412,height:892},true);
 await verify({width:1100,height:730},false);
}finally{await browser.close();}
