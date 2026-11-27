// Supported Ranger subgraph from the official 3.30.0 PoE 1 export. Node IDs,
// adjacency and values are preserved; the local names translate the English export.
export const rangerTalentSource='https://github.com/grindinggear/skilltree-export/blob/3.30.0/data.json';
export const rangerTalentSourceSHA256='9686b969bbd744a77f13eeadc57bb71be5032b0ed22be1ee4dbf2025649ccab0';
const ranger='50459';
const node=(id,name,branch,neighbors,bonuses,notable=false)=>Object.freeze({
 id,name,branch,neighbors:Object.freeze(neighbors),bonuses:Object.freeze(bonuses),notable
});
export const rangerTalents=Object.freeze([
 node('45035','投射物傷害與命中','firepower',[ranger,'59370','465'],{accuracy:30,projectileDamage:.16}),
 node('465','投射物傷害與攻擊速度','firepower',['45035','41536','65033'],{attackSpeed:.04,projectileDamage:.10}),
 node('41536','投射物傷害','firepower',['465','62712'],{projectileDamage:.10}),
 node('62712','投射物傷害','firepower',['41536','41250'],{projectileDamage:.10}),
 node('41250','投射物傷害','firepower',['62712','50338'],{projectileDamage:.10}),
 node('65033','攻擊速度','firepower',['465','10017'],{attackSpeed:.04}),
 node('10017','攻擊速度','firepower',['65033','38344'],{attackSpeed:.04}),
 node('38344','攻擊速度','firepower',['10017','50338'],{attackSpeed:.04}),
 node('50338','彈道學','firepower',['41250','38344','38662'],{projectileSpeed:.20,projectileDamage:.20,dexterity:20},true),
 node('39821','閃避與生命','survival',[ranger,'52904','2094'],{evasion:20,life:14}),
 node('2094','閃避與生命','survival',['39821','60803','720'],{evasion:30,lifeIncrease:.05}),
 node('60803','閃避','survival',['2094','6542'],{evasionIncrease:.14}),
 node('6542','閃避','survival',['60803','94'],{evasionIncrease:.14}),
 node('94','閃避','survival',['6542','54142'],{evasionIncrease:.14}),
 node('720','命中與攻擊傷害','survival',['2094','29870'],{attackDamage:.08,accuracyIncrease:.08}),
 node('29870','攻擊速度','survival',['720','56149'],{attackSpeed:.04}),
 node('56149','命中與攻擊傷害','survival',['29870','54142'],{attackDamage:.08,accuracyIncrease:.08}),
 node('54142','靈巧','survival',['94','56149','61306'],{attackSpeed:.08,dexterity:20,accuracyIncrease:.15},true),
 node('52904','敏捷','movement',['39821','444'],{dexterity:10}),
 node('444','敏捷','movement',['52904','61306'],{dexterity:10}),
 node('61306','敏捷','movement',['444','54142','60942'],{dexterity:10}),
 node('60942','敏捷','movement',['61306','32555'],{dexterity:10}),
 node('32555','敏捷','movement',['60942','22266'],{dexterity:10}),
 node('22266','敏捷','movement',['32555','9786'],{dexterity:10}),
 node('9786','閃避與移動速度','movement',['22266','33558'],{evasionIncrease:.12,speed:.03}),
 node('33558','閃避與移動速度','movement',['9786'],{evasionIncrease:.14,speed:.03}),
 node('59370','敏捷','movement',['45035','63795'],{dexterity:10}),
 node('63795','敏捷','movement',['59370','38662'],{dexterity:10}),
 node('38662','敏捷','movement',['63795','50338'],{dexterity:10})
]);
const byId=new Map(rangerTalents.map(t=>[t.id,t]));
const allocated=progression=>new Set((Array.isArray(progression?.talents)?progression.talents:[]).filter(id=>byId.has(id)));
export function talentPoints(progression){
 const earned=Number.isSafeInteger(progression?.passivePoints)?Math.max(0,progression.passivePoints):0;
 const spent=allocated(progression).size;
 return {earned,spent,remaining:Math.max(0,earned-spent)};
}
export function talentAvailability(progression,id){
 const talent=byId.get(id);
 const nodes=allocated(progression);
 if(!talent)return {available:false,allocated:false,reason:'未知天賦',links:[]};
 const links=talent.neighbors.filter(neighbor=>neighbor!==ranger).map(id=>byId.get(id));
 if(nodes.has(id))return {available:false,allocated:true,reason:'已配置',links};
 if(!talent.neighbors.some(neighbor=>neighbor===ranger||nodes.has(neighbor)))return {available:false,allocated:false,reason:'需連接已配置的天賦',links};
 if(talentPoints(progression).remaining<1)return {available:false,allocated:false,reason:'沒有可用天賦點',links};
 return {available:true,allocated:false,reason:'可配置 · 消耗 1 點',links};
}
export function allocateTalent(progression,id){
 const availability=talentAvailability(progression,id);
 if(!availability.available)throw new Error(availability.reason);
 return {...progression,talents:[...allocated(progression),id]};
}
const empty={life:0,lifeIncrease:0,accuracy:0,accuracyIncrease:0,evasion:0,evasionIncrease:0,attackSpeed:0,attackDamage:0,projectileDamage:0,projectileSpeed:0,speed:0,dexterity:0};
export function talentBonuses(progression){
 const totals={...empty};
 for(const id of allocated(progression))for(const [stat,amount] of Object.entries(byId.get(id).bonuses))totals[stat]+=amount;
 // PoE 1 Dexterity grants 2 Accuracy per point and 2% increased Evasion per 10.
 totals.accuracy+=2*totals.dexterity;
 totals.evasionIncrease+=.002*totals.dexterity;
 return totals;
}
export function talentModifiers(progression){
 const {projectileDamage,attackDamage,projectileSpeed,attackSpeed}=talentBonuses(progression);
 return [
  {stat:'damage',kind:'increased',value:projectileDamage,tags:['projectile']},
  {stat:'damage',kind:'increased',value:attackDamage,tags:['attack']},
  {stat:'projectileSpeed',kind:'increased',value:projectileSpeed,tags:['projectile']},
  {stat:'attackSpeed',kind:'increased',value:attackSpeed,tags:['attack']}
 ].filter(mod=>mod.value!==0);
}
// Pass the character's baseline after gear (not an already talent-adjusted snapshot).
export function applyTalentStats(player,progression){
 const t=talentBonuses(progression);
 return {...player,maximumLife:Math.round((player.maximumLife+t.life)*(1+t.lifeIncrease)),
  accuracy:Math.round((player.accuracy+t.accuracy)*(1+t.accuracyIncrease)),
  evasion:Math.round((player.evasion+t.evasion)*(1+t.evasionIncrease)),
  speed:player.speed*(1+t.speed)};
}
const statText={
 life:n=>'最大生命 +'+n,lifeIncrease:n=>'最大生命提高 '+pct(n),accuracy:n=>'命中值 +'+n,
 accuracyIncrease:n=>'命中值提高 '+pct(n),evasion:n=>'閃避值 +'+n,evasionIncrease:n=>'閃避值提高 '+pct(n),
 attackSpeed:n=>'攻擊速度提高 '+pct(n),attackDamage:n=>'攻擊傷害提高 '+pct(n),
 projectileDamage:n=>'投射物傷害提高 '+pct(n),projectileSpeed:n=>'投射物速度提高 '+pct(n),
 speed:n=>'移動速度提高 '+pct(n),dexterity:n=>'敏捷 +'+n
};
const pct=n=>Math.round(n*100)+'%';
export const talentEffects=talent=>Object.entries(talent.bonuses).map(([key,amount])=>statText[key](amount));
