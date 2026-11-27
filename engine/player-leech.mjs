import {LeechPool} from './recovery.mjs?v=0.5.9';
const resources=[['life','maximumLife','reservedLife'],['mana','maximumMana','reservedMana'],['energyShield','maximumEnergyShield','reservedEnergyShield']];
const descriptor=Object.fromEntries(resources.map(entry=>[entry[0],entry]));
const total=damage=>Object.values(damage).reduce((acc,n)=>acc+Math.max(0,n??0),0);

// Only damage from successful direct hits is eligible unless a modifier explicitly transfers proxy leech.
export function addHitLeech(player,shot,result,modifiers){
 if(!(player.life>0)||!result.hit.hit||result.mitigation?.blocked||!result.mitigation?.damage)return;
 const damage=result.target?.rules?.immuneChaos?{...result.mitigation.damage,chaos:0}:result.mitigation.damage;
 const delivered=total(damage);
 if(!(delivered>0))return;
 const source=shot.skill.source??'attack';
 const proxy=shot.leechProxy??(['totem','trap','mine'].includes(shot.skill.deploy)?shot.skill.deploy:undefined);
 if(proxy&&proxy!=='totem')return;
 const context={...shot.skill.context,tags:[...(shot.skill.context?.tags??[]),source]};
 const f=stat=>modifiers.calculate(0,stat,context);
 const life=proxy==='totem'
  ?(source==='attack'?(damage.physical??0)*f('leechTotemPhysicalLife'):0)
  :delivered*f('leechLife')+(damage.physical??0)*f('leechPhysicalLife');
 const amounts={life:player.rules?.ghostReaver?0:life,
  mana:proxy?0:delivered*f('leechMana')+(damage.physical??0)*f('leechPhysicalMana'),
  energyShield:(proxy?0:delivered*f('leechEnergyShield'))+(player.rules?.ghostReaver?life:0)};
 const cfg=player.leechConfig??{};
 for(const [resource,amount] of Object.entries(amounts)){
  const [key,max,reserved]=descriptor[resource],maximum=player[max];
  const cap=(maximum??0)-(player[reserved]??0),current=player[key]??0;
  if(!(amount>0&&maximum>0&&current<cap))continue;
  const pool=new LeechPool(resource);
  pool.instances=[...(player.activeLeech?.[resource]??[])];
  const size=Math.min(amount,maximum*.1),instant=size*Math.min(1,Math.max(0,cfg.instant??0));
  if(instant>0)player[key]=Math.min(cap,current+instant);
  if((player[key]??current)<cap)pool.add(size-instant,1,maximum,{instanceRate:.02*(cfg[resource]?.rate??1)});
  else pool.instances=[];
  player.activeLeech={...player.activeLeech,[resource]:pool.instances};
 }
}

export function advancePlayerLeech(player,dt){
 if(!player.activeLeech)return;
 if(!(player.life>0)){delete player.activeLeech;return;}
 const cfg=player.leechConfig??{},next={};
 for(const [key,max,reserved] of resources){
  const pending=player.activeLeech[key],maximum=player[max];
  if(!pending?.length||!(maximum>0))continue;
  const pool=new LeechPool(key);
  pool.instances=pending.map(instance=>({...instance}));
  player[key]=pool.advance(dt,player[key]??0,maximum,{
   totalRate:(key==='energyShield'?.1:.2)*(cfg[key]?.cap??1)*(key==='energyShield'&&player.rules?.ghostReaver?2:1),
   unreservedMaximum:Math.max(0,maximum-(player[reserved]??0))
  });
  if(pool.instances.length)next[key]=pool.instances;
 }
 if(Object.keys(next).length)player.activeLeech=next;
 else delete player.activeLeech;
}
