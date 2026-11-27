import {equippedStats} from './town-services.mjs?v=0.5.6';
import {talentBonuses,talentModifiers} from './act-one-talents.mjs?v=0.5.6';

export function applyLoadout(player,town,progression,modifiers,{refill=false}={}){
 const gear=equippedStats(town),talents=talentBonuses(progression);
 modifiers.replace('town-gear',gear.attack?[{stat:'damage',kind:'increased',value:gear.attack,tags:['attack']}]:[]);
 modifiers.replace('talents',talentModifiers(progression));
 const maximumLife=Math.round((70+gear.life+talents.life)*(1+talents.lifeIncrease));
 const maximumMana=58+gear.mana;
 return {...player,maximumLife,life:refill?maximumLife:Math.min(player.life,maximumLife),
  maximumMana,mana:refill?maximumMana:Math.min(player.mana,maximumMana),
  accuracy:Math.round((90+gear.accuracy+talents.accuracy)*(1+talents.accuracyIncrease)),
  evasion:Math.round((15+gear.evasion+talents.evasion)*(1+talents.evasionIncrease)),
  speed:4*(gear.speed+talents.speed),defence:{...player.defence,resistances:gear.resistances}};
}
