const table={
 'maximum Life':'life','maximum Mana':'mana','maximum Energy Shield':'es','Evasion Rating':'evasion','Accuracy Rating':'accuracy','Armour':'armour',
 'Movement Speed':'move','Mana Regeneration Rate':'manaRegen','Attack Speed':'attackSpeed','Cast Speed':'castSpeed','Projectile Speed':'projectileSpeed',
 'Critical Strike Chance':'criticalChance','Damage':'damage','Physical Damage':'physicalDamage','Fire Damage':'fireDamage','Cold Damage':'coldDamage',
 'Lightning Damage':'lightningDamage','Chaos Damage':'chaosDamage','Elemental Damage':'elementalDamage','Attack Damage':'damage:attack',
 'Spell Damage':'damage:spell','Projectile Damage':'damage:projectile','Totem Damage':'damage:totem','Trap Damage':'damage:trap','Mine Damage':'damage:mine',
};
const weapon={'Bows':'bow','Wands':'wand','Claws':'claw','One Handed Swords':'one-hand-sword','One Handed Axes':'one-hand-axe'};
const types={Fire:'fire',Cold:'cold',Lightning:'lightning',Chaos:'chaos'};
const numeric=(stat,value,kind='flat')=>({stat,value,kind});
const translate={
 'maximum Life':'最大生命','maximum Mana':'最大魔力','maximum Energy Shield':'最大能量護盾','Evasion Rating':'閃避值',
 'Accuracy Rating':'命中值','Armour':'護甲','Movement Speed':'移動速度','Mana Regeneration Rate':'魔力回復率',
 'Attack Speed':'攻擊速度','Cast Speed':'施放速度','Attack and Cast Speed':'攻擊與施放速度','Projectile Speed':'投射物速度',
 'Critical Strike Chance':'暴擊率','Damage':'傷害','Physical Damage':'物理傷害','Fire Damage':'火焰傷害','Cold Damage':'冰冷傷害',
 'Lightning Damage':'閃電傷害','Chaos Damage':'混沌傷害','Elemental Damage':'元素傷害','Attack Damage':'攻擊傷害',
 'Spell Damage':'法術傷害','Projectile Damage':'投射物傷害','Totem Damage':'圖騰傷害','Trap Damage':'陷阱傷害','Mine Damage':'地雷傷害',
 Strength:'力量',Dexterity:'敏捷',Intelligence:'智慧','all Attributes':'全能力',Bows:'弓',Wands:'法杖',Claws:'爪',
 'One Handed Swords':'單手劍','One Handed Axes':'單手斧',Fire:'火焰',Cold:'冰冷',Lightning:'閃電',Chaos:'混沌'
};
export const keystones=Object.freeze({
 '31961':['resolute','堅毅之心',['擊中無法被閃避','永遠不會造成暴擊']],
 '57279':['bloodMagic','血魔法',['移除全部魔力','10% 更多最大生命','技能改為消耗與保留生命']],
 '44941':['avatarFire','火之化身',['50% 物理、冰冷、閃電傷害轉為火焰','不造成非火焰傷害']],
 '34098':['mindOverMatter','心靈昇華',['承受傷害時，40% 先由魔力承擔']],
 '50288':['ironWill','鋼鐵意志',['力量的傷害加成也套用至法術傷害']],
 '12926':['ironGrip','鋼鐵之握',['力量的傷害加成也套用至投射物攻擊']],
 '10661':['ironReflexes','霸體',['閃避全數轉換為護甲','敏捷不再提供閃避加成']],
 '56116':['magebane','法師剋星',['敏捷不再提供閃避加成','每 15 點敏捷提供 1% 法術壓抑']],
 '31703':['painAttunement','苦痛靈曲',['低血時，30% 更多法術傷害']],
 '63620':['precise','精準技巧',['命中值高於最大生命時，40% 更多攻擊傷害','永遠不會造成暴擊']],
 '11455':['chaosInoculation','異靈之體',['最大生命變為 1','免疫混沌傷害']],
 '42178':['pointBlank','零點射擊',['投射物攻擊擊中在近距離至多 30% 更多傷害，距離越遠傷害越少']],
 '41970':['ancestralBond','先祖魂約',['你無法親自用技能造成傷害','召喚圖騰上限 +1']],
 '39713':['glancing','側身之擊',['攻擊及法術格擋率加倍','格擋時仍承受 65% 擊中傷害']],
 '56075':['eldritchBattery','異能魔力',['技能魔力消耗優先花費能量護盾','能量護盾改為保護魔力','50% 更少能量護盾充能率']],
 '23950':['wickedWard','惡毒牢房',['近期開始充能時，不會因承受傷害而中斷','40% 更少能量護盾充能率']],
 '63425':['zealotsOath','狂熱誓言',['生命再生套用到能量護盾']],
 '54307':['acrobatics','移形換影',['法術壓抑機率改為一半數值的法術擊中躲避率','最多 75% 法術躲避機率']],
 '22088':['elementalOverload','元素超載',['各技能在造成暴擊後 8 秒內，元素擊中與異常狀態造成 40% 更多傷害','暴擊不再造成額外傷害，異常狀態不視作暴擊施加']],
 '39085':['elementalEquilibrium','元素之相',['元素擊中移除對應元素曝曬，對其他元素施加 −25% 抗性的曝曬']],
 '35255':['ghostDance','鬼舞',['每 2 秒獲得 1 層鬼影，最多 3 層','被擊中時失去 1 層鬼影，回復等同於閃避值 3% 的能量護盾','能量護盾無法回復至高於你的閃避值']],
 '10808':['vaalPact','瓦爾冥約',['近戰傷害的生命偷取立即生效','無法透過偷取以外的方式回復生命']],
 '24426':['ghostReaver','靈能護體',['生命偷取改為能量護盾偷取','能量護盾偷取的每秒總回復上限加倍','能量護盾無法充能']],
 '19732':['theAgnostic','不可知論',['移除全部能量護盾','非滿血時每秒犧牲至多 20% 最大魔力以恢復等量生命']]
});
export function parsePassiveLine(line){
 let m;
 if((m=line.match(/^\+(\d+) to (Strength|Dexterity|Intelligence|all Attributes)$/))){
  const keys=m[2]==='all Attributes'?['strength','dexterity','intelligence']:[m[2].toLowerCase()];
  return [keys.map(key=>numeric(key,+m[1])),translate[m[2]]+' +'+m[1]];
 }
 if((m=line.match(/^\+(\d+) to (maximum Life|maximum Mana|maximum Energy Shield|Evasion Rating|Accuracy Rating|Armour)$/)))
  return [[numeric(table[m[2]],+m[1])],translate[m[2]]+' +'+m[1]];
 if((m=line.match(/^(\d+(?:\.\d+)?)% (increased|reduced) (.+)$/))){
  let [,value,mode,desc]=m,t=desc,tag;
  if(desc==='Elemental Damage with Attack Skills'){t='Elemental Damage';tag='attack';}
  else if(desc==='Damage with Hits'){t='Damage';tag='hit';}
  else if(desc.includes(' with ')){const [k,w]=desc.split(' with ');if(weapon[w]){t=k;tag=weapon[w];}else return null;}
  const stats=t==='Attack and Cast Speed'?['attackSpeed','castSpeed']:[table[t]];
  if(stats.every(Boolean)&&(!tag||stats.every(s=>!['life','mana','es','armour','evasion','move','manaRegen','accuracy'].includes(s))))
   return [stats.map(stat=>numeric(stat+(tag?':'+tag:''),(mode==='increased'?1:-1)*value/100,'increased')),
    (translate[t]??t)+(tag?'（'+(translate[desc.split(' with ')[1]]??(tag==='hit'?'擊中':'攻擊'))+'）':'')+(mode==='increased'?'提高 ':'降低 ')+value+'%'];
 }
 if((m=line.match(/^\+(\d+)% to (all Elemental|Fire|Cold|Lightning|Chaos) Resistances?$/))){
  const keys=m[2]==='all Elemental'?['fire','cold','lightning']:[types[m[2]]];
  return [keys.map(key=>numeric('res:'+key,+m[1]/100)),(translate[m[2]]??'全部元素')+'抗性 +'+m[1]+'%'];
 }
 if((m=line.match(/^\+(\d+)% to maximum (all Elemental|Fire|Cold|Lightning|Chaos) Resistances?$/))){
  const keys=m[2]==='all Elemental'?['fire','cold','lightning']:[types[m[2]]];
  return [keys.map(key=>numeric('maxres:'+key,+m[1]/100)),(translate[m[2]]??'全部元素')+'最大抗性 +'+m[1]+'%'];
 }
 if((m=line.match(/^(\d+(?:\.\d+)?)% of (Physical Attack|Attack|Spell) Damage Leeched as (Life|Mana|Energy Shield)$/))){
  const source=m[2]==='Spell'?'spell':'attack',physical=m[2]==='Physical Attack';
  const names={Life:'生命',Mana:'魔力','Energy Shield':'能量護盾'};
  const key=physical?'leechPhysical'+m[3].replace(' ',''):'leech'+m[3].replace(' ','');
  return [[numeric(key+':'+source,+m[1]/100)],m[1]+'% '+(physical?'物理攻擊':source==='spell'?'法術':'攻擊')+'傷害偷取為'+names[m[3]]];
 }
 if((m=line.match(/^(\d+(?:\.\d+)?)% of Physical Attack Damage dealt by your Totems is Leeched to you as Life$/)))
  return [[numeric('leechTotemPhysicalLife',+m[1]/100)],m[1]+'% 你圖騰造成的物理攻擊傷害偷取為你的生命'];
 if((m=line.match(/^(\d+)% increased (Maximum total (Life|Mana|Energy Shield|Life, Mana and Energy Shield) Recovery per second from Leech|total Recovery per second from (Life|Mana|Energy Shield|Life, Mana, or Energy Shield) Leech)$/))){
  const cap=!!m[3],kind=cap?'Cap':'Rate',label=(m[3]??m[4]);
  const parts=label.startsWith('Life,')?['Life','Mana','Energy Shield']:[label];
  const names={Life:'生命',Mana:'魔力','Energy Shield':'能量護盾'};
  return [parts.map(type=>numeric('leech'+type.replace(' ','')+kind,+m[1]/100)),parts.map(type=>names[type]).join('／')+'偷取每秒總回復'+(cap?'上限':'速度')+'提高 '+m[1]+'%'];
 }
 if((m=line.match(/^Gain (\d+) (Life|Mana|Energy Shield) per Enemy (Killed|Hit with Attacks)$/))){
  const names={Life:['Life','生命'],Mana:['Mana','魔力'],'Energy Shield':['EnergyShield','能量護盾']};
  const [key,label]=names[m[2]],hit=m[3]!=='Killed';
  return [[numeric('recover'+key+(hit?'AttackHit':'KillFlat'),+m[1])],(hit?'每以攻擊擊中一名敵人':'每擊殺一名敵人')+'，回復 '+m[1]+' '+label];
 }
 if((m=line.match(/^Recover (\d+)% of (Life|Mana|Energy Shield) on Kill$/))){
  const names={Life:['Life','生命'],Mana:['Mana','魔力'],'Energy Shield':['EnergyShield','能量護盾']};
  const [key,label]=names[m[2]];
  return [[numeric('recover'+key+'KillFraction',+m[1]/100)],'擊殺時回復 '+m[1]+'% 最大'+label];
 }
 if((m=line.match(/^(\d+)% of Damage taken Recouped as (Life|Mana|Energy Shield)$/))){
  const names={Life:['Life','生命'],Mana:['Mana','魔力'],'Energy Shield':['EnergyShield','能量護盾']};
  const [key,label]=names[m[2]];
  return [[numeric('recoup'+key,+m[1]/100)],'承受的擊中傷害有 '+m[1]+'% 分段回復為'+label];
 }
 if(line==='Life Recoup Effects instead occur over 3 seconds')
  return [[numeric('recoupLifeDuration',3)],'生命傷害回復改為在 3 秒內完成'];
 if((m=line.match(/^(\d+)% of Leech is Instant$/)))
  return [[numeric('leechInstant',+m[1]/100)],m[1]+'% 偷取立即回復'];
 if((m=line.match(/^Regenerate (\d+(?:\.\d+)?)% of Energy Shield per second$/)))
  return [[numeric('esRegenPct',+m[1]/100)],'每秒回復 '+m[1]+'% 能量護盾'];
 if((m=line.match(/^Regenerate (\d+(?:\.\d+)?)(?:(%)(?: of)?)? Life per second$/)))
  return [[numeric(m[2]?'lifeRegenPct':'lifeRegen',+m[1]/(m[2]?100:1))],'每秒回復 '+m[1]+(m[2]??'')+' 生命'];
 if((m=line.match(/^\+(\d+)% to (Global )?Critical Strike Multiplier$/)))
  return [[numeric('criticalMultiplier',+m[1]/100)],'暴擊加成 +'+m[1]+'%'];
 if((m=line.match(/^\+(\d+)% chance to Suppress Spell Damage$/i)))
  return [[numeric('suppress',+m[1]/100)],'法術壓抑機率 +'+m[1]+'%'];
 if((m=line.match(/^\+(\d+)% Chance to Block (Attack|Spell) Damage$/i)))
  return [[numeric(m[2].toLowerCase()+'Block',+m[1]/100)],(m[2].toLowerCase()==='attack'?'攻擊':'法術')+'格擋機率 +'+m[1]+'%'];
 if((m=line.match(/^Projectiles Pierce (\d+) additional Targets?$/i)))
  return [[numeric('pierce',+m[1])],'投射物額外穿透 '+m[1]+' 個目標'];
 if((m=line.match(/^Skills fire (\d+) additional Projectiles?$/i)))
  return [[numeric('projectileCount',+m[1],'flat')],'技能發射 '+m[1]+' 個額外投射物'];
 if((m=line.match(/^(Attack )?Projectiles Return to you$/i)))
  return [[numeric(m[1]?'return:attack':'return',1)],m[1]?'攻擊投射物返回':'投射物返回'];
 if((m=line.match(/^(\d+)% increased Attack Speed when on Full Life$/)))
  return [[{...numeric('attackSpeed',+m[1]/100,'increased'),conditions:{fullLife:true}}],'滿血時攻擊速度提高 '+m[1]+'%'];
 if((m=line.match(/^(\d+)% increased (Spell|Melee) Critical Strike Chance$/)))
  return [[numeric('criticalChance:'+m[2].toLowerCase(),+m[1]/100,'increased')],m[2]==='Spell'?'法術暴擊率提高 '+m[1]+'%':'近戰暴擊率提高 '+m[1]+'%'];
 if((m=line.match(/^\+(\d+)% to (Melee Critical Strike Multiplier|Critical Strike Multiplier for Spell Damage)$/)))
  return [[numeric('criticalMultiplier:'+(m[2].startsWith('Melee')?'melee':'spell'),+m[1]/100)],(m[2].startsWith('Melee')?'近戰':'法術')+'暴擊加成 +'+m[1]+'%'];
 if((m=line.match(/^(\d+)% increased Melee Damage$/)))return [[numeric('damage:melee',+m[1]/100,'increased')],'近戰傷害提高 '+m[1]+'%'];
 if(line==='Skills supported by Unleash have +1 to maximum number of Seals')return [[numeric('unleashSeals',1)],'被釋放輔助的技能封印上限 +1'];
 if(line==="6% increased Cast Speed for each different Non-Instant Spell you've Cast Recently")return [[numeric('castPerRecentSpell',.06)],'近期每施放一種不同的非瞬發法術，施放速度提高 6%'];
 if(line==='Projectiles Pierce an additional Target')return [[numeric('pierce',1)],'投射物額外穿透 1 個目標'];
 if(line==='Attacks fire an additional Projectile')return [[numeric('projectileCount:attack',1)],'攻擊發射 1 個額外投射物'];
 if(line==='Bow Attacks fire an additional Arrow')return [[numeric('projectileCount:attack:bow',1)],'弓攻擊發射 1 支額外箭矢'];
 if((m=line.match(/^Projectile Attack Skills have (\+?)(\d+)% (increased Critical Strike Chance|to Critical Strike Multiplier)$/))){
  const crit=m[3].endsWith('Chance');return [[numeric((crit?'criticalChance':'criticalMultiplier')+':projectile:attack',+m[2]/100,crit?'increased':'flat')],
   '投射物攻擊'+(crit?'暴擊率提高 ':'暴擊加成 +')+m[2]+'%'];
 }
 if((m=line.match(/^(\d+)% increased (Evasion Rating and Armour|Armour and Evasion Rating)$/)))return [[numeric('evasion',+m[1]/100,'increased'),numeric('armour',+m[1]/100,'increased')],'閃避值與護甲提高 '+m[1]+'%'];
 if((m=line.match(/^(\d+)% increased Damage Over Time with Bow Skills$/)))return [[numeric('damageOverTime:bow',+m[1]/100,'increased')],'弓技能的持續傷害提高 '+m[1]+'%'];
 if((m=line.match(/^(\d+)% increased Energy Shield Recharge Rate$/)))return [[numeric('esRecharge',+m[1]/100,'increased')],'能量護盾充能率提高 '+m[1]+'%'];
 if(line==='Projectiles deal 20% increased Damage with Hits and Ailments for each Enemy Pierced')return [[numeric('perPierce',.2)],'每穿透 1 個敵人，此投射物的擊中與異常狀態傷害提高 20%'];
 if(line==='Projectiles deal 20% increased Damage with Hits and Ailments for each time they have Chained')return [[numeric('perChain',.2)],'每連鎖 1 次，此投射物的擊中與異常狀態傷害提高 20%'];
 if(line==='Skills fire an additional Projectile')return [[numeric('projectileCount',1)],'技能發射 1 個額外投射物'];
 if(line==='Projectile Speed Modifiers also apply to Projectile Damage')return [[numeric('speedToDamage',1)],'投射物速度詞綴也套用至投射物傷害'];
 if((m=line.match(/^Regenerate (\d+(?:\.\d+)?) Mana per second$/)))
  return [[numeric('manaRegenFlat',+m[1])],'每秒回復 '+m[1]+' 魔力'];
 if((m=line.match(/^(\d+)% (more|less) Projectile Speed$/)))
  return [[numeric('projectileSpeed',+m[1]/100*(m[2]==='more'?1:-1),'more')],'投射物速度 '+m[1]+'% '+(m[2]==='more'?'更多':'更少')];
 if((m=line.match(/^(\d+)% increased (Mana )?Cost Efficiency(?: of (Attacks|Spells))?$/))){
  const stat=m[2]?'manaEfficiency':'costEfficiency', tag=m[3]==='Attacks'?'attack':m[3]==='Spells'?'spell':'';
  return [[numeric(stat+(tag?':'+tag:''),+m[1]/100)],(tag==='attack'?'攻擊':tag==='spell'?'法術':'')+(m[2]?'魔力':'技能')+'消耗效率提高 '+m[1]+'%'];
 }
 if((m=line.match(/^(\d+)% increased Projectile Damage per (\d+) Dexterity$/)))
  return [[numeric('damagePerDex',+m[1]/100/+m[2])],'每 '+m[2]+' 點敏捷使投射物傷害提高 '+m[1]+'%'];
 if(line==='You count as on Low Life while at 55% of maximum Life or below')return [[numeric('lowLifeThreshold',.55)],'生命不超過 55% 時視為低血'];
 if(line==='You count as on Full Life while at 90% of maximum Life or above')return [[numeric('fullLifeThreshold',.9)],'生命至少 90% 時視為滿血'];
 if(line==='Skills Cost Life instead of 15% of Mana Cost')return [[numeric('lifeCostRatio',.15)],'技能 15% 的魔力消耗改為生命消耗'];
 if((m=line.match(/^Attack Skills Cost Life instead of (\d+)% of Mana Cost$/)))return [[numeric('lifeCostRatio:attack',+m[1]/100)],'攻擊技能 '+m[1]+'% 的魔力消耗改為生命消耗'];
 if(line==='Monsters cannot Block your Attacks')return [[numeric('noBlock:attack',1)],'怪物無法格擋你的攻擊'];
 if(line==='Prevent +3% of Suppressed Spell Damage')return [[numeric('suppressPrevented',.03)],'額外防止 3% 被壓抑的法術傷害'];
 if(line==='Chance to Suppress Spell Damage is Lucky')return [[numeric('suppressLucky',1)],'法術壓抑機率為幸運'];
 if(line==='10% more Maximum Life if you have at least 6 Life Masteries allocated')return [[numeric('sixLifeMasteries',1)],'配置至少 6 個生命專精時，10% 更多最大生命'];
 if(line==='Increases and Reductions to Projectile Speed also apply to Damage with Bows')return [[numeric('bowSpeedToDamage',1)],'投射物速度的提高與降低也套用至弓傷害'];
 if(line==='100% increased Mirage Archer Duration')return [[numeric('mirageDuration',1)],'幻影射手持續時間提高 100%'];
 if(line==='+25% to Critical Strike Multiplier against Unique Enemies')return [[numeric('criticalUnique',.25)],'對傳奇敵人的暴擊加成 +25%'];
 if(line==='150% increased Critical Strike Chance against Enemies that are on Full Life')return [[numeric('criticalFull',1.5)],'對滿血敵人的暴擊率提高 150%'];
 if(line==='You take 30% reduced Extra Damage from Critical Strikes')return [[numeric('reducedCritExtra',.3)],'承受的額外暴擊傷害降低 30%'];
 if(line==='10% chance to Recover 10% of Mana when you use a Skill')return [[numeric('skillManaRecover',1)],'使用技能時有 10% 機率回復 10% 魔力'];
 if(line==='15% increased maximum Life if there are no Life Modifiers on Equipped Body Armour')
  return [[numeric('lifeWithoutBodyLife',.15)],'若身上胸甲沒有生命詞綴，最大生命提高 15%'];
 return null;
}
export function compilePassives(lines){
 const parts=lines.flatMap(line=>line.split('\n')).filter(Boolean).map(line=>({raw:line,result:parsePassiveLine(line)}));
 return {available:parts.length>0&&parts.every(p=>p.result),mods:parts.flatMap(p=>p.result?.[0]??[]),
  effects:parts.map(p=>p.result?.[1]??p.raw),missing:parts.filter(p=>!p.result).map(p=>p.raw)};
}
