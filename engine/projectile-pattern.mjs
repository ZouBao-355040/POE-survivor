export const bearing=(from,to)=>Math.atan2(to.y-from.y,to.x-from.x);
const TAU=Math.PI*2;
export function projectilePattern({player,target,enemies=[],count,skill,cooldown}){
 const a=bearing(player,target),side={x:-Math.sin(a),y:Math.cos(a)},active=skill.active;
 const line=(angle,offset=0,delay=0,group=0,aim=target)=>({
  x:player.x+side.x*offset,y:player.y+side.y*offset,dx:Math.cos(angle),dy:Math.sin(angle),delay,group,aim});
 if(skill.targeted||active.targeted)return enemies.filter(e=>e.life>0&&Math.hypot(e.x-player.x,e.y-player.y)<=(player.attackRange??10))
   .sort((x,y)=>Math.hypot(x.x-player.x,x.y-player.y)-Math.hypot(y.x-player.x,y.y-player.y))
   .slice(0,count).map((e,i)=>line(bearing(player,e),0,0,i,e));
 if(skill.sequence){
  const step=cooldown*.6/count;
  const shots=Array.from({length:count},(_,i)=>line(a+(active.spiral?TAU*i/count:0),0,cooldown*.4+i*step,i));
  if(active.finalVolley)for(let i=0;i<active.finalVolley;i++)shots.push(line(a+(i-(active.finalVolley-1)/2)*.12,0,cooldown*.4+(count-1)*step,count));
  return shots;
 }
 const gap=active.spread??(active.sourceKey==='SplitArrow'?.17:.105);
 return Array.from({length:count},(_,i)=>{
  const lane=i-(count-1)/2;
  if(skill.volley)return line(a,lane*.53);
  const angle=a+lane*Math.min(gap,1.35/Math.max(1,count-1));
  return line(angle);
 });
}
