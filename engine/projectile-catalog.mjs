import {extraProfiles} from './projectile-families.mjs';
import {gemIndex} from './projectile-index.mjs?v=0.5.2';
import {momentumSupport} from './momentum.mjs';

const activeProfiles = {
 ...extraProfiles,
 BurningArrow:{description:'將物理傷害轉為火焰，有機率點燃。'},
 BurningArrowAltX:{description:'基於最大生命附加火焰傷害。',lifeFire:.21},
 SplitArrow:{description:'以較寬扇面掃射多支箭，同一輪不重複命中。'},
 SplitArrowAltX:{description:'箭矢命中後裂化，改由附近敵人承接。',split:3,splitCountInstead:true,splitOnEnd:true},
 LightningArrow:{description:'命中時閃電殃及周遭最多三名敵人。',splash:'lightning'},
 IceShot:{description:'命中時在目標後方造成冰冷錐形傷害。',splash:'cone'},
 IceShotAltX:{description:'穿透並擊中途經的敵人，沒有冰冷錐形爆發。',pierce:Infinity},
 CausticArrow:{description:'著地或撞擊後留下持續造成混沌傷害的腐蝕地面。',ground:'chaos',groundOnImpact:true},
 Barrage:{description:'短暫準備後連續射擊，同一敵人可被多次命中。',sequence:true},
 BarrageAltX:{description:'連射的最後一發帶有同時射出的額外齊射。',sequence:true,finalVolley:6},
 TornadoShot:{description:'每支主箭穿透敵人，抵達落點時向四周射出 3 支次級箭。',tornado:'primary',pierce:Infinity,burst:3,aimRange:true},
 TornadoShotAltX:{description:'單支載箭從空中落下，落地後向四周射出 9 支箭；額外投射物增加落地後射出的箭數。',tornado:'payload',projectileCount:1,payloadArrows:gemIndex.TornadoShotAltX.stats.base_number_of_arrows,aimRange:true,noCollision:true},
 GalvanicArrow:{description:'短程箭矢與正前方的閃電錐同時攻擊。',lifetime:.22,launchCone:true},
 GalvanicArrowAltY:{description:'射出的箭矢持續迸發小型閃電錐。',lifetime:.55,pulseEvery:.13,pulseRadius:1.3},
 Frenzy:{description:'命中疊狂怒球，提升自身攻速及此技能傷害。',charges:'frenzy'},
 PowerSiphon:{description:'分別向附近目標射擊，撲殺低血量敵人並取得暴擊球。',targeted:true,cull:true,charges:'power'},
 PowerSiphonAltX:{description:'鎖定不同敵人，依最大魔力附加閃電傷害。',targeted:true,manaLightning:.15,cull:true,charges:'power'},
 Puncture:{description:'箭矢造成流血，移動中的敵人承受更高流血傷害。',bleed:true},
 CobraLash:{description:'連鎖、可施毒；保留越多連鎖時傷害越高。',chainBonus:.08},
 SpectralThrow:{description:'穿透敵人後折返，去程和回程可各命中一次。',pierce:Infinity,canReturn:true,speed:16,lifetime:.65},
 VenomGyre:{description:'可施毒，返回時穿透並可被接住。',canReturn:true,speed:28,lifetime:.65,catch:true,returnMultiplier:.25},
 KineticBlast:{description:'投射物命中時在碰撞點四周連續爆炸。',splash:'cluster'},
 Fireball:{description:'火球在停止處爆炸，有機率點燃。',explosion:1.35,speed:24},
 FireballAltX:{description:'緩慢前進，對飛行路線附近施加持續火焰傷害，不造成命中。',noCollision:true,speed:7.2,pulseEvery:.12,pulseRadius:1.0,radiation:true},
 FreezingPulse:{description:'穿透所有敵人，傷害隨飛行時間減弱。',pierce:Infinity,pulseDecay:true,speed:23,lifetime:.56},
 FrostBolt:{description:'緩慢飛行並穿透所有敵人，可冰凍。',pierce:Infinity,speed:9,lifetime:1.9},
 IceSpear:{description:'近距離連射冰矛；進入第二階段後高速穿透且暴擊率大增。',sequence:true,phase:true,speed:12},
 IceSpearAltX:{description:'冰矛第一個命中會裂化，增加投射物改為增加裂化數。',split:4,splitCountInstead:true,phase:true,speed:12},
 EtherealKnives:{description:'向前方扇形投擲多把物理飛刃。',speed:25,lifetime:.5,spread:.13},
 EtherealKnivesAltY:{description:'放出密集扇形物理飛刃。',speed:25,lifetime:.5,spread:.10},
 BallLightning:{description:'緩慢前進，定期對附近敵人放電。',speed:5,lifetime:2.6,noCollision:true,pulseEvery:.15,pulseRadius:2.1},
 CreepingFrost:{description:'落點爆裂，留下會向附近敵人移動的冰緩地面。',explosion:1.7,ground:'cold',movingGround:true,speed:18},
 EssenceDrain:{description:'命中造成混沌持續傷害，並從受影響敵人回復生命。',drain:true,speed:23},
 Soulrend:{description:'追蹤敵人，穿透並對飛行路線周圍施加混沌持續傷害。',speed:21,lifetime:.8,pierce:Infinity,homing:true,pulseEvery:.08,pulseRadius:1.25,trailDot:true},
 SoulrendAltX:{description:'追蹤敵人的重型混沌投射物。',speed:18,lifetime:.8,homing:true},
 SoulrendAltY:{description:'依序向旋轉方位放出帶混沌持續傷害的投射物。',speed:21,lifetime:.8,pierce:Infinity,spiral:true,sequence:true,pulseEvery:.08,pulseRadius:1.25,trailDot:true},
 RollingMagma:{description:'沿地面跳躍，每次落地爆炸，再依連鎖數續跳。',noCollision:true,aimRange:true,bounce:true,explosion:1.65,speed:16,lifetime:.50},
 BlazingSalvo:{description:'發射多枚弧形飛彈，到達目標區域後各自爆炸。',noCollision:true,aimRange:true,explosion:1.3,lob:true,speed:22},
 Unearth:{description:'投射物穿透，落地造成物理範圍傷害並留下一具屍體。',pierce:Infinity,aimRange:true,explosion:1.1,corpse:true,speed:26},
};

function idFor(key,g){
 if(!g.support)return g.effect.replaceAll('_','-');
 return ({SupportBarrage:'barrage-support',SupportLesserMultipleProjectiles:'lesser-multiple-projectiles',SupportViciousProjectiles:'vicious-projectiles'})[key] ??
  g.en.replace(/ Support$/,'').toLowerCase().replaceAll(' ','-');
}
function makeActive(key,profile){
 const g=gemIndex[key],s=g.stats??{},spell=g.tags.includes('spell'),d={},added={};
 for(const type of ['physical','fire','cold','lightning','chaos']){
  const min=s['spell_minimum_base_'+type+'_damage'],max=s['spell_maximum_base_'+type+'_damage'];
  if(min!==undefined&&max!==undefined)d[type]=[min,max];
  const lo=s['attack_minimum_added_'+type+'_damage']??s['attack_minimum_added_'+type+'_damage_for_elemental_hit'];
  const hi=s['attack_maximum_added_'+type+'_damage']??s['attack_maximum_added_'+type+'_damage_for_elemental_hit'];
  if(lo!==undefined&&hi!==undefined)added[type]=[lo,hi];
 }
 const conversion=[];
 for(const [id,pct] of Object.entries(s)){
  const m=id.match(/(physical|fire|cold|lightning|chaos)_damage_%_to_convert_to_(physical|fire|cold|lightning|chaos)$/);
  if(m)conversion.push({from:m[1],to:m[2],fraction:pct/100,kind:'convert',priority:'skill'});
 }
 const radius=(s.active_skill_base_area_of_effect_radius??12)/10;
 return {id:idFor(key,g),sourceKey:key,kind:'active',name:g.zh,level:1,requiredLevel:g.requiredLevel,tags:g.tags,types:g.types,weaponTypes:g.weapons??[],
  cost:g.mana??0,baseSpellDamage:d,baseAddedDamage:added,castTime:(g.castMs??1000)/1000,spellCriticalChance:(g.crit??500)/10000,
  weaponDamageMultiplier:1+(g.attackDamage??0)/10000,effectiveness:spell?(g.effectiveness??100)/100:1+(g.attackDamage??0)/10000,
  attackSpeedMultiplier:1+(g.attackSpeed??0)/100,conversion,igniteChance:(s['base_chance_to_ignite_%']??s['chance_to_freeze_shock_ignite_%']??0)/100,
  freezeChance:(s['base_chance_to_freeze_%']??s['chance_to_freeze_shock_ignite_%']??0)/100,poisonChance:(s['base_chance_to_poison_on_hit_%']??0)/100,
  projectileCount:s.power_siphon_base_fire_at_x_targets??s.base_number_of_arrows??s.base_number_of_projectiles??1,
  projectileSpeed:profile.speed??32.6,projectileLifetime:profile.lifetime??.85,
  pierce:s.always_pierce?Infinity:(s.projectile_base_number_of_targets_to_pierce??0),
  chain:s.number_of_chains??0,noPierce:!!s.cannot_pierce,split:s.projectile_number_to_split??0,
  baseDot:(s.base_chaos_damage_to_deal_per_minute??s.base_cold_damage_to_deal_per_minute??s.base_fire_damage_to_deal_per_minute??0)/60,
  duration:(s.base_skill_effect_duration??1500)/1000,areaRadius:radius,stats:s,...profile};
}
const supportProfiles = {
 SupportLesserMultipleProjectiles:{additionalProjectiles:2,damageMultiplier:.85,description:'額外 2 個投射物，各自傷害降低。'},
 SupportGreaterMultipleProjectiles:{additionalProjectiles:4,damageMultiplier:.65,description:'額外 4 個投射物，各自傷害降低。'},
 SupportAwakenedGreaterMultipleProjectiles:{additionalProjectiles:4,damageMultiplier:.70,description:'額外投射物，傷害懲罰低於普通版。',family:'greater-multiple-projectiles'},
 SupportFasterProjectiles:{increasedProjectileSpeed:.5,increasedProjectileDamage:.2,description:'增加飛行速度；同樣飛行時間下飛得更遠。'},
 SupportSlowerProjectiles:{projectileSpeedMultiplier:.8,damageMultiplier:1.10,description:'降低飛行速度與距離，提高傷害。'},
 SupportPierce:{pierce:2,description:'額外穿透 2 名敵人。'},
 SupportFork:{fork:1,projectileDamageMultiplier:.90,description:'穿透耗盡後，命中會分裂為兩道。'},
 SupportAwakenedFork:{fork:2,projectileDamageMultiplier:1.00,description:'可以再次分裂。',family:'fork'},
 SupportGreaterFork:{fork:2,extraForkChance:.30,description:'可以再次分裂，並可能多分出一道。',family:'fork'},
 SupportChain:{chain:2,hitDamageMultiplier:.70,description:'分裂及穿透用完後，在附近敵人間連鎖 2 次。'},
 SupportAwakenedChain:{chain:3,hitDamageMultiplier:.76,description:'在附近敵人間連鎖 3 次。',family:'chain'},
 SupportGreaterChain:{chain:1,chainMultiplier:1.5,description:'增加連鎖次數及其倍率。',family:'chain'},
 SupportReturningProjectiles:{canReturn:true,returnMultiplier:.30,description:'去程結束時飛回你身旁，回程穿透但傷害較低。'},
 SupportIronGrip:{ironGrip:true,requiresAll:['projectile','attack'],description:'將力量提供的物理近戰傷害加成套用到投射物攻擊。'},
 SupportPinpoint:{pinpoint:true,requiresAll:['projectile','spell'],description:'站定施放逐步集中，投射物變少、單枚傷害提高；移動散去。'},
 SupportBallistaTotem:{deploy:'totem',requiresAll:['projectile','attack','bow'],description:'改由砲塔發射，攻擊速度及傷害降低。',attackSpeedMultiplier:.5,damageMultiplier:.68},
 SupportFocusedBallista:{focused:true,requiresAll:['projectile','totem'],description:'砲塔跟隨你的攻擊節奏，提升射擊速度。',attackSpeedMultiplier:1.25},
 SupportLocusMine:{deploy:'mine',requiresAll:['projectile','attack'],requiresAny:['bow','wand'],description:'落下定位地雷，延時向角色方向引爆。',damageMultiplier:.76,additionalProjectiles:2},
 SupportFlamewood:{retaliate:true,requiresAll:['totem'],description:'附近有敵人威脅砲塔或圖騰時，圖騰向其拋出火焰彈。'},
 SupportGluttony:{gluttony:true,requiresAll:['projectile','spell'],description:'施放累積 10 層後，短時間改以新星施放並增加 5 個投射物。'},
 SupportWindburst:{windburst:true,requiresAll:['attack'],description:'移動累積達 10 公尺，下次命中時放出風破。'},
 SupportSpellEcho:{echo:1,echoRate:1.40,requiresAll:['spell'],description:'施法時以更快的節奏重複一次。'},
 SupportAwakenedSpellEcho:{echo:1,echoRate:1.50,echoLast:1.22,family:'spell-echo',requiresAll:['spell'],description:'加速重複施法，最後一次可能造成更重的命中。'},
 SupportGreaterSpellEcho:{echo:2,echoRate:1.30,family:'spell-echo',requiresAll:['spell'],description:'施法依序重複兩次。'},
 SupportUnleash:{unleash:3,unleashPeriod:.95,requiresAll:['spell'],description:'隨時間蓄積封印，下次施法消耗封印重複施放。'},
 SupportAwakenedUnleash:{unleash:4,unleashPeriod:.85,family:'unleash',requiresAll:['spell'],description:'上限較高的封印，消耗後重複施法。'},
 SupportGreaterUnleash:{unleash:3,unleashPeriod:.75,family:'unleash',requiresAll:['spell'],description:'封印累積更快，下次施法時一同釋放。'},
 SupportMirageArcher:{mirage:true,requiresAll:['attack','bow'],description:'命中後召出幻影射手，短時間重複射出弱化箭矢。'},
 SupportSacredWisps:{wisps:true,requiresAll:['attack'],description:'法杖攻擊有機會喚出妖精同步進行額外攻擊。'},
 SupportVoidstorm:{voidstorm:true,requiresAll:['attack'],description:'落射攻擊額外形成短時間的混沌區域。'},
 SupportSummonPhantasm:{phantasm:true,description:'命中型技能擊殺時有機會召出幻影，自動發射穿透的物理飛彈。'},
 SupportPointBlank:{pointBlank:true,requiresAll:['projectile','attack'],description:'投射物攻擊近距離傷害較高、遠距離較低。'},
 SupportVolley:{additionalProjectiles:2,volley:true,damageMultiplier:.70,description:'改成平行齊射，額外 2 個投射物。'},
 SupportGreaterVolley:{additionalProjectiles:4,volley:true,damageMultiplier:.70,description:'改成較寬的平行齊射，額外 4 個投射物。'},
 SupportBarrage:{additionalProjectiles:4,sequence:true,sequenceTimePerShot:.1,damageMultiplier:.50,requiresAll:['projectile','attack'],requiresAny:['bow','wand'],description:'改為依序發射，額外 4 發並延長攻擊時間。'},
 SupportArrowNova:{additionalProjectiles:4,nova:true,damageMultiplier:.70,requiresAll:['projectile','attack','bow'],description:'先把導引箭射向落點，到達後向外放射。'},
 SupportAwakenedArrowNova:{additionalProjectiles:4,nova:true,damageMultiplier:.74,requiresAll:['projectile','attack','bow'],family:'arrow-nova',description:'導引箭落點放射，傷害懲罰較低。'},
 SupportViciousProjectiles:{requiresAll:['projectile','attack'],attackSpeedMultiplier:.90,physicalChaosMultiplier:1.30,description:'降低投射物攻速，增加物理及混沌相關傷害。'},
 SupportAwakenedViciousProjectiles:{requiresAll:['projectile','attack'],attackSpeedMultiplier:.90,physicalChaosMultiplier:1.40,family:'vicious-projectiles',description:'降低投射物攻速，提高物理與混沌相關傷害。'},
 SupportMomentum:{...momentumSupport,description:'站定攻擊累積動量；移動清空。'},
 SupportFasterAttacks:{requiresAll:['attack'],increasedAttackSpeed:.20,description:'增加攻擊速度。'},
 SupportFasterCasting:{requiresAll:['spell'],increasedCastSpeed:.20,description:'增加施放速度。'},
 SupportAddedColdDamage:{addedDamage:{cold:[4,6]},description:'為攻擊及法術命中附加冰冷傷害。'},
 SupportAddedLightningDamage:{addedDamage:{lightning:[1,8]},description:'為攻擊及法術命中附加閃電傷害。'},
 SupportAddedChaosDamage:{addedDamage:{chaos:[18,26]},description:'為攻擊及法術命中附加混沌傷害。'},
 SupportAddedFireDamage:{gainFire:.25,description:'獲得等同部分物理傷害的額外火焰傷害。'},
};
const intrinsicallyFixed=new Set(['SplitArrowAltX','TornadoShot','TornadoShotAltX','PowerSiphon','PowerSiphonAltX','Barrage','BarrageAltX','RollingMagma','BallLightning']);
function makeSupport(key,profile){
 const g=gemIndex[key];
 const projectile=g.tags.includes('projectile');
 return {id:idFor(key,g),sourceKey:key,name:g.zh,kind:'support',requiredLevel:g.requiredLevel,tags:g.tags,costMultiplier:(g.costMultiplier??100)/100,
  requiresAll:projectile?['projectile']:[],supportRules:g.supportRules,
  ...profile,appliesTo(active){
   if(!(active.tags.includes('attack')||active.tags.includes('spell')))return false;
   if((active.countLocked||active.rain)&&this.nova)return false;
   if(active.noPierce&&this.pierce)return false;
   if(active.countLocked&&this.additionalProjectiles&&!this.nova)return false;
   if(active.deploy&&(this.deploy||this.echo||this.unleash||this.mirage||this.wisps||this.voidstorm))return false;
   if(this.wisps&&!active.weaponTypes.includes('Wand'))return false;
   if(this.voidstorm&&!active.rain)return false;
   if(this.phantasm&&active.radiation)return false;
   if(active.radiation&&(this.addedDamage||this.fork||this.pierce||this.chain||this.canReturn))return false;
   if(this.nova||this.sequence||this.volley){
    if(intrinsicallyFixed.has(active.sourceKey))return false;
    if(this.volley&&(active.spiral||active.lob))return false;
   }
   if(active.sourceKey==='BallLightning'&&(this.fork||this.chain||this.pierce))return false;
   if(active.bounce&&(this.fork||this.pierce||this.canReturn))return false;
   return true;
  }};
}
const byKey=new Map(Object.entries(activeProfiles).map(([k,v])=>[k,makeActive(k,v)]));
export const activeGems=[...byKey.values()].map(g=>{
 const fallbackActive=byKey.get(g.fallbackKey);
 const pactActive=byKey.get(g.pactBase);
 return fallbackActive||pactActive?{...g,fallbackActive,pactActive}:g;
});
export const supportGems=Object.entries(supportProfiles).filter(([k])=>k in gemIndex).map(([k,v])=>makeSupport(k,v));
export const catalog=[...activeGems,...supportGems];
export const gemById=new Map(catalog.map(g=>[g.id,g]));
export const researchIndex=Object.entries(gemIndex).map(([key,entry])=>({...entry,key,playable:catalog.some(g=>g.sourceKey===key)}));
