import {blockStats} from './defence.mjs?v=0.5.21';
import {equippedStats} from './town-services.mjs?v=0.5.21';
import {selectedPassives} from './passive-tree.mjs?v=0.5.28';
import {classAttributes,resolveCharacterClass} from './character.mjs?v=0.5.10';
import {combatRecoveryResources} from './combat-recovery.mjs?v=0.5.18';
import {resourceKeystones} from './keystones.mjs?v=0.5.18';

const baseline=['life','mana','es','evasion','accuracy','armour','move','manaRegen','lifeRegen','lifeRegenPct','esRegenPct','manaRegenFlat',
 'esRecharge','esFasterStart','manaRegenPerSpellBlock','suppress','suppressLucky','suppressPrevented','attackBlock','spellBlock','strength','dexterity','intelligence','lifeWithoutBodyLife',
 'damagePerDex','speedToDamage','bowSpeedToDamage','criticalUnique','criticalFull','reducedCritExtra','skillManaRecover','lowLifeThreshold',
 'fullLifeThreshold','sixLifeMasteries','flaskChargeGain','flaskRecoveryLife','flaskRecoveryMana','flaskPeriodicLife','flaskPeriodicMana','flaskLifeOnHit','flaskLifeOnUse','flaskDuration','flaskEffect'];
export function applyLoadout(player,town,progression,modifiers,{refill=false}={}){
 const gear=equippedStats(town),{keys,mods,lifeMasteries}=selectedPassives(progression);
 const sum=(stat,kind='flat')=>mods.reduce((a,m)=>a+(m.stat===stat&&m.kind===kind?m.value:0),0);
 const up=s=>sum(s,'increased');
 const [str,dex,int]=classAttributes[resolveCharacterClass(progression)];
 const strength=str+sum('strength'), dexterity=dex+sum('dexterity'), intelligence=int+sum('intelligence');
 const lifeAffix=town.gear.find(i=>i.id===town.equipped.body)?.affixes?.some(a=>a.key==='life');
 const passiveMods=mods.filter(m=>!baseline.includes(m.stat)&&!/^res:|^maxres:|^recover|^recoup/.test(m.stat)).map(m=>{
  const [stat,...tags]=m.stat.split(':');return {...m,stat,tags};
 });
 const plus=(stat,value,tags,kind='increased')=>{if(value)passiveMods.push({stat,kind,value,tags});};
 const strengthDamage=Math.floor(strength/5)*.01;
 plus('physicalDamage',strengthDamage,['attack','melee']);
 if(keys.has('ironGrip'))plus('physicalDamage',strengthDamage,['attack','projectile']);
 if(keys.has('ironWill'))plus('damage',strengthDamage,['spell']);
 plus('damage',Math.floor(dexterity/16)*16*sum('damagePerDex'),['projectile']);
 for(const m of passiveMods.filter(m=>m.stat==='projectileSpeed')){
  if(sum('speedToDamage'))plus('damage',m.value,['projectile',...m.tags],m.kind);
  if(sum('bowSpeedToDamage')&&m.kind==='increased')plus('damage',m.value,['bow',...m.tags]);
 }
 modifiers.replace('town-gear',gear.attack?[{stat:'damage',kind:'increased',value:gear.attack,tags:['attack']}]:[]);
 modifiers.replace('talents',passiveMods);
 const life=Math.round((70+gear.life+sum('life')+Math.floor(strength/2)-7)*(1+up('life')+(lifeAffix?0:sum('lifeWithoutBodyLife')))*(sum('sixLifeMasteries')&&lifeMasteries>=6?1.1:1));
 const resource=resourceKeystones({maximumLife:life,maximumMana:Math.round((58+gear.mana+sum('mana')+Math.floor(intelligence/2)-7)*(1+up('mana'))),
  maximumEnergyShield:Math.round((gear.energyShield+sum('es'))*(1+up('es')+Math.floor(intelligence/10)*.02))},keys);
 const {maximumLife,maximumMana,maximumEnergyShield}=resource.stats;
 const accuracy=Math.round((90+gear.accuracy+sum('accuracy')+2*(dexterity-32))*(1+up('accuracy')));
 const evasion=Math.round((15+gear.evasion+sum('evasion'))*(1+up('evasion')+(!keys.has('ironReflexes')&&!keys.has('magebane')?(dexterity-32)*.002:-32*.002)));
 const armour=Math.round((gear.armour+sum('armour'))*(1+up('armour')))+(keys.has('ironReflexes')?evasion:0);
 const resistances={},maximumResistances={};
 for(const type of ['fire','cold','lightning','chaos']){
  resistances[type]=(gear.resistances[type]??0)+sum('res:'+type);
  maximumResistances[type]=Math.min(.9,.75+sum('maxres:'+type));
 }
 const regen=()=>sum('lifeRegen')+maximumLife*sum('lifeRegenPct');
 const suppression=sum('suppress')+(keys.has('magebane')?Math.floor(dexterity/15)*.01:0);
 const block=blockStats({attack:sum('attackBlock'),spell:sum('spellBlock'),glancing:keys.has('glancing')});
 const rules={...resource.rules,damageTakenFromManaBeforeLife:keys.has('mindOverMatter')?.4:0,
  resolute:keys.has('resolute'),precise:keys.has('precise'),avatarFire:keys.has('avatarFire'),
  ghostReaver:keys.has('ghostReaver'),eldritchBattery:keys.has('eldritchBattery'),wickedWard:keys.has('wickedWard'),acrobatics:keys.has('acrobatics'),
  eternalYouth:keys.has('eternalYouth'),elementalOverload:keys.has('elementalOverload'),elementalEquilibrium:keys.has('elementalEquilibrium'),
  crimsonDance:keys.has('crimsonDance'),arrowDancing:keys.has('arrowDancing'),windDancer:keys.has('windDancer'),perfectAgony:keys.has('perfectAgony'),pointBlank:keys.has('pointBlank'),ancestralBond:keys.has('ancestralBond'),painAttunement:keys.has('painAttunement'),
  lowLifeThreshold:sum('lowLifeThreshold')||.5,fullLifeThreshold:sum('fullLifeThreshold')||1,
  criticalUnique:sum('criticalUnique'),criticalFull:sum('criticalFull'),skillManaRecover:!!sum('skillManaRecover')};
 const leechConfig={instant:sum('leechInstant')};
 for(const [resource,name] of [['life','Life'],['mana','Mana'],['energyShield','EnergyShield']])
  leechConfig[resource]={rate:1+sum('leech'+name+'Rate'),cap:(1+sum('leech'+name+'Cap'))*(resource==='life'&&rules.eternalYouth?.5:1)};
 const combatRecovery={};
 for(const [name,key] of Object.entries(combatRecoveryResources)){
  const tag=name.replace(' ',''),attackHit=sum('recover'+tag+'AttackHit'),killFlat=sum('recover'+tag+'KillFlat');
  const killFraction=sum('recover'+tag+'KillFraction'),recoup=sum('recoup'+tag);
  if(attackHit||killFlat||killFraction||recoup)
   combatRecovery[key]={attackHit,killFlat,killFraction,recoup,recoupDuration:sum('recoup'+tag+'Duration')||4};
 }
 return {...player,strength,dexterity,intelligence,maximumLife,life:refill?maximumLife:Math.min(player.life,maximumLife),
  maximumMana,mana:refill?maximumMana:Math.min(player.mana,maximumMana),
  maximumEnergyShield,energyShield:refill?maximumEnergyShield:Math.min(player.energyShield??0,maximumEnergyShield),
  esRechargeDelay:2/(1+up('esFasterStart')),
  esRechargeRate:Math.max(0,(1+up('esRecharge'))/3)*(keys.has('eldritchBattery')?.5:1)*(keys.has('wickedWard')?.6:1),accuracy,evasion:keys.has('ironReflexes')?0:evasion,speed:4*gear.speed*Math.max(0,1+up('move')),
  lifeRegen:keys.has('zealotsOath')?0:regen()*(rules.eternalYouth?.5:1),esRegen:maximumEnergyShield*sum('esRegenPct')+(keys.has('zealotsOath')?sum('lifeRegen')+maximumEnergyShield*sum('lifeRegenPct'):0),manaRegenMultiplier:Math.max(0,1+up('manaRegen')+sum('manaRegenPerSpellBlock')*block.spellBlock),manaRegenFlat:sum('manaRegenFlat'),
  flaskConfig:{gain:1+up('flaskChargeGain'),duration:1+up('flaskDuration'),effect:1+up('flaskEffect'),recovery:{life:1+up('flaskRecoveryLife'),mana:1+up('flaskRecoveryMana')},
   periodic:{life:sum('flaskPeriodicLife'),mana:sum('flaskPeriodicMana')},lifeOnHit:sum('flaskLifeOnHit'),lifeOnUse:sum('flaskLifeOnUse')},
  rules,leechConfig,combatRecovery,defence:{...player.defence,armour,hitArmourMultiplier:keys.has('imbalancedGuard')?2:1,maximumDamageReduction:keys.has('imbalancedGuard')?.5:.9,resistances,maximumResistances,reducedCritExtra:sum('reducedCritExtra'),
   ...block,suppressionPrevented:.5+sum('suppressPrevented'),
   suppressionChance:keys.has('acrobatics')?0:suppression,spellDodge:keys.has('acrobatics')?Math.min(.75,suppression*.5):0,suppressionLucky:!!sum('suppressLucky')}};
}
