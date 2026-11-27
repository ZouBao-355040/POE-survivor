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
 await page.clock.install();
 await page.goto(entry,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('等級'));
 assert.match(await page.locator('.brand').innerText(),/v0\.3\.0/);
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');
 await page.clock.runFor(2300);
 await page.getByRole('button',{name:'寶石',exact:true}).click();
 assert.ok(await page.getByRole('dialog').isVisible());
 const snapshot=()=>page.evaluate(()=>[
  document.querySelector('#status').textContent,document.querySelector('#life').value,
  document.querySelector('#mana').value,document.querySelector('canvas').toDataURL()]);
 const paused=await snapshot();await page.clock.runFor(1900);
 assert.deepEqual(await snapshot(),paused,'world state and rendered battlefield must freeze');
 await page.getByRole('button',{name:'PoE 寶石圖鑑'}).click();
 await page.getByRole('searchbox').fill('Fireball of Radiation');
 assert.equal(await page.locator('.index-item').count(),1);
 assert.match(await page.locator('.index-item').innerText(),/輻射/);
 await page.getByRole('button',{name:'技能試射'}).click();
 await page.getByRole('searchbox').fill('Split Arrow');
 await page.getByRole('button',{name:/^裂化箭矢 以較寬/}).click();
 await page.clock.runFor(1000);
 assert.match(await page.locator('#status').innerText(),/試射場/);
 assert.match(await page.locator('#hint').innerText(),/裂化箭矢/);
 await page.getByRole('button',{name:'寶石',exact:true}).click();
 await page.getByRole('button',{name:/^高階多重投射輔助 · 等級 1/}).click();
 await page.getByRole('button',{name:'○',exact:true}).first().click();
 assert.match(await page.getByRole('dialog').innerText(),/生效輔助：高階多重投射輔助/);
 await page.getByRole('button',{name:'關閉',exact:true}).click();
 await page.clock.runFor(1500);
 assert.notEqual(await page.locator('#status').innerText(),paused[0]);
 if(mobile){
  const cdp=await page.context().newCDPSession(page);
  const target=page.locator('canvas');
  const rect=await target.boundingBox();
  const x=Math.round(rect.width/2),y=Math.round(rect.height*.55);
  const before=await target.evaluate(n=>n.toDataURL());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y}]});
  await page.clock.runFor(300);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await target.evaluate(n=>n.toDataURL()),before);
 }else{
  await page.keyboard.down('d');await page.clock.runFor(260);await page.keyboard.up('d');
 }
 await page.getByRole('button',{name:'重開',exact:true}).click();
 await page.clock.runFor(300);
 assert.match(await page.locator('#hint').innerText(),/燃燒箭矢/);
 assert.doesNotMatch(await page.locator('#status').innerText(),/試射場/);
 assert.deepEqual(failures,[]);
 console.log((mobile?'手機':'桌面')+' '+viewport.width+'×'+viewport.height+'：載入、戰鬥暫停、圖鑑、試射、裝備、移動、重開通過。');
 await page.close();
}
try{
 await verify({width:412,height:892},true);
 await verify({width:1100,height:730},false);
}finally{await browser.close();}
