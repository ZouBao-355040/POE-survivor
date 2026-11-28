import test from 'node:test';
import assert from 'node:assert/strict';
import {allocate,tracePath,points} from './passive-tree.mjs';
import {applyLoadout} from './player-loadout.mjs';
import {newTownServices,rollGear,equipGear} from './town-services.mjs';
import {ModifierStore} from './modifiers.mjs';
import {stepWorld} from './game-loop.mjs';
import {interruptLifeRecharge,tickLifeRecharge} from './life-recharge.mjs';
import {retryBeach} from './campaign.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const fresh={life:80,maximumLife:150,mana:30,maximumMana:30,energyShield:20,maximumEnergyShield:40,rules:{eternalYouth:true},x:0,y:0,esRechargeRate:1/3};
const world=(player,time=0,enemyCasts=[])=>({player,time,enemyCasts,enemies:[],projectiles:[],cooldown:9});
const opts={enemyModifiers:new ModifierStore(),random:()=>.4};

test('Eternal Youth redirects actual charge from shield to life and uses life maximum',()=>{
 const progression={characterClass:'Ranger',level:23,passivePoints:22};
 const selected=tracePath(progression,21650).slice(1).reduce((p,id)=>allocate(p,id),progression);
 const rolled=rollGear(newTownServices({starter:true}),10,'helmet',()=>.9);
 const player=applyLoadout(fresh,equipGear(rolled.town,rolled.item.id),selected,new ModifierStore());
 assert.equal(player.rules.eternalYouth,true);
 near(player.leechConfig.life.cap,.5);
 near(player.leechConfig.mana.cap,1);
 const start={...player,life:50,energyShield:3,lifeRegen:0};
 const after=stepWorld(world(start,3),.05,opts).player;
 near(after.life,50+player.maximumLife*player.esRechargeRate*.05);
 near(after.energyShield,3);
 const noES=stepWorld(world({...start,energyShield:0,maximumEnergyShield:0},3),.05,opts).player;
 near(noES.life,after.life);
 const vaal=stepWorld(world({...start,rules:{...start.rules,vaalPact:true}},3),.05,opts).player;
 near(vaal.life,50);
});

test('only actual life damage interrupts, not a hit fully absorbed by ES',()=>{
 const cast=damage=>({x:0,y:0,radius:1,damage,element:'fire',impactAt:.05});
 const shielded=stepWorld(world(fresh,0,[cast(10)]),.05,opts).player;
 near(shielded.life,82.5);
 assert.equal(shielded.lifeRechargeInterruptedAt,undefined);
 const hit=stepWorld(world(fresh,0,[cast(30)]),.05,opts).player;
 near(hit.life,72.5);
 near(hit.lifeRechargeInterruptedAt,.05);
 near(tickLifeRecharge(hit,2,.05).life,hit.life);
 near(tickLifeRecharge(hit,2.03,.05).life,hit.life+1.5);
 const retry=retryBeach({...world(hit),zone:'beach',dead:true});
 assert.equal(retry.player.lifeRechargeInterruptedAt,undefined);
});

test('Wicked Ward protects a running life recharge window; reservation remains a hard ceiling',()=>{
 const player={...fresh,rules:{...fresh.rules,wickedWard:true},lifeCharging:true,lifeRechargeStarted:1};
 const surviving={...player,life:55};
 assert.equal(interruptLifeRecharge(player,surviving,4.99),surviving);
 assert.equal(interruptLifeRecharge(player,surviving,5).lifeRechargeInterruptedAt,5);
 const capped=tickLifeRecharge({...player,life:119,reservedLife:30},4,.05);
 near(capped.life,120);assert.equal(capped.lifeCharging,false);
});

test('only life regeneration and the total overtime life leech cap are halved',()=>{
 const p={characterClass:'Ranger',level:35,passivePoints:34};
 const pick=(state,id)=>tracePath(state,id).slice(1).reduce((s,n)=>allocate(s,n),state);
 const before=pick(p,3167),after=pick(before,21650);
 const town=newTownServices({starter:true});
 const a=applyLoadout(fresh,town,before,new ModifierStore()),b=applyLoadout(fresh,town,after,new ModifierStore());
 assert.ok(a.lifeRegen>0&&b.lifeRegen>0);
 near(b.lifeRegen/b.maximumLife,a.lifeRegen/a.maximumLife*.5);
 const activeLeech={life:Array.from({length:20},()=>({remaining:20,rate:3}))};
 const tick=(p)=>stepWorld(world({...p,life:50,lifeRegen:0,activeLeech,lifeRechargeInterruptedAt:0},.5),.05,opts).player.life;
 near(tick(a)-50,a.maximumLife*.20*.05);
 near(tick(b)-50,b.maximumLife*.10*.05);
});

test('faster recharge start from the real Essence Surge passive applies to both resources',()=>{
 const base={characterClass:'Ranger',level:65,passivePoints:64};
 const pick=(s,id)=>tracePath(s,id).slice(1).reduce((p,i)=>allocate(p,i),s);
 const faster=pick(base,62577),youth=pick(faster,21650);
 assert.ok(faster.talents?.includes("62577"));
 const town=newTownServices({starter:true});
 const load=s=>({...applyLoadout(fresh,town,s,new ModifierStore()),life:50,energyShield:0,lifeRegen:0,esRegen:0,lifeRechargeInterruptedAt:0,shieldInterruptedAt:0});
 const a=load(faster),b=load(youth);
 near(a.esRechargeDelay,2/1.2);near(b.esRechargeDelay,a.esRechargeDelay);
 const tick=(p,t)=>stepWorld(world(p,t),.05,opts).player;
 near(tick(a,1.6).energyShield,0);near(tick(b,1.6).life,50);
 assert.ok(tick(a,1.7).energyShield>0);assert.ok(tick(b,1.7).life>50);
});

test('a legal level-26 Ranger can allocate both recharge keystones and they do not bypass Vaal Pact',()=>{
 const base={characterClass:'Ranger',level:26,passivePoints:25};
 const allocateAll=(s,ids)=>ids.reduce((p,i)=>allocate(p,i),s);
 const shared=allocateAll(base,[39821,52904,444,61306,63139,5408]);
 const vaal=[56589,23471,20010,10808];
 const youth=[11497,238,10829,16167,19144,28330,46578,13714,55485,65034,46910,33740,15405,50862,21650];
 const a=allocateAll(shared,vaal),b=allocateAll(shared,youth),both=allocateAll(a,youth);
 assert.equal(points(both).remaining,0);
 const rolled=rollGear(newTownServices({starter:true}),10,'helmet',()=>.9);
 const town=equipGear(rolled.town,rolled.item.id);
 const damageThenWait=s=>{
  const loaded=applyLoadout(fresh,town,s,new ModifierStore());
  assert.ok(loaded.maximumEnergyShield>0);
  const p={...loaded,life:loaded.maximumLife,energyShield:loaded.maximumEnergyShield,lifeRegen:0,esRegen:0};
  const hit=stepWorld(world(p,.95,[{x:0,y:0,radius:1,damage:p.maximumEnergyShield+25,element:'fire',impactAt:1}]),.05,opts).player;
  assert.ok(hit.life<p.life&&hit.life>0);near(hit.energyShield,0);
  const before=stepWorld(world(hit,2.75),.05,opts).player;
  near(before.life,hit.life);near(before.energyShield,hit.energyShield);
  return [hit,stepWorld(world(before,3.1),.05,opts).player];
 };
 const [ha,pa]=damageThenWait(a),[hb,pb]=damageThenWait(b),[hc,pc]=damageThenWait(both);
 near(pa.life,ha.life);assert.ok(pa.energyShield>0);
 near(pb.energyShield,hb.energyShield);assert.ok(pb.life>hb.life);
 near(pc.energyShield,hc.energyShield);near(pc.life,hc.life);
});
