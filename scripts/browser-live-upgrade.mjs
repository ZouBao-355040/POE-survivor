// This integration harness keeps the same live old tab open across a real deploy.
// Start before deploying, then create RELEASE_READY_FILE only after Pages matches.
import assert from 'node:assert/strict';
import {access,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {encodeCheckpoint,checkpointKey} from '../engine/checkpoint.mjs';
import {GemInventory} from '../engine/gem-inventory.mjs';
import {newTownServices,equippedSocketLayout} from '../engine/town-services.mjs';
import {gemById} from '../engine/projectile-catalog.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const {GAME_URL,OLD_VERSION,NEW_VERSION,OLD_OPEN_FILE,RELEASE_READY_FILE}=process.env;
assert.ok(GAME_URL&&OLD_VERSION&&NEW_VERSION&&OLD_OPEN_FILE&&RELEASE_READY_FILE);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:412,height:892},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const town=newTownServices({starter:true}),inventory=new GemInventory();
 inventory.setLayout(equippedSocketLayout(town));inventory.acquire(gemById.get('burning-arrow'));
 inventory.equip('burning-arrow','weapon',0);inventory.setMode('burning-arrow','manual');
 const state={zone:'town',routeIndex:1,gold:37,progression:{characterClass:'Ranger',level:3,passivePoints:2,experience:2}};
 const raw=encodeCheckpoint({state,town,inventory},OLD_VERSION);
 await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);},{key:checkpointKey,raw});
 let checks=0;page.on('request',r=>{if(r.url().includes('/version.json?'))checks++;});
 const btn=name=>page.getByRole('button',{name,exact:true});
 await page.clock.install();
 const address=new URL(GAME_URL);address.searchParams.set('v',OLD_VERSION);
 await page.goto(address.href,{waitUntil:'networkidle'});
 assert.equal(await page.locator('.brand small').innerText(),'v'+OLD_VERSION);
 await btn('繼續遊戲').click();await page.clock.runFor(200);
 assert.equal(await page.locator('#gold-hud').innerText(),'金幣 37');
 assert.equal(await btn('有新版').isVisible(),false);
 await writeFile(OLD_OPEN_FILE,'ready');
 const checksWhileWaiting=checks;
 let ready=false;
 for(let i=0;i<120&&!ready;i++){
  try{await access(RELEASE_READY_FILE);ready=true;}catch{await delay(2000);}
 }
 assert.ok(ready,'Timed out waiting for live release file');
 assert.equal(checks,checksWhileWaiting,'the old tab must not poll while waiting');
 await page.clock.fastForward(65000);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await btn('有新版').click({timeout:30000});
 assert.ok((await page.locator('#version-message-copy').innerText()).includes('v'+NEW_VERSION));
 assert.equal(await page.locator('.brand small').innerText(),'v'+OLD_VERSION,'old tab did not reload on its own');
 await btn('儲存並重新載入').click();
 await page.waitForURL(u=>u.searchParams.get('v')===NEW_VERSION);
 await btn('繼續遊戲').click();await page.clock.runFor(200);
 assert.equal(await page.locator('.brand small').innerText(),'v'+NEW_VERSION);
 assert.equal(await page.locator('#gold-hud').innerText(),'金幣 37');
 assert.equal(await btn('有新版').isVisible(),false);
 const resumed=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),checkpointKey);
 assert.equal(resumed.routeIndex,1);assert.equal(resumed.inventory.manual,'burning-arrow');
 assert.deepEqual(errors,[]);
 console.log('Real two-release Pages handoff passed:',OLD_VERSION,'→',NEW_VERSION);
}finally{await browser.close();}
