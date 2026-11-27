export function advanceProjectile(p,dt,enemies){
 const travel=Math.min(p.remainingRange,p.speed*dt);
 const dx=p.dx*travel,dy=p.dy*travel;
 let hit=null,first=Infinity;
 for(const e of enemies){if(e.life<=0||(p.hitIds??[]).includes(e.id))continue;const x=p.x-e.x,y=p.y-e.y,r=e.radius??.35;const a=dx*dx+dy*dy,b=2*(x*dx+y*dy),c=x*x+y*y-r*r;let t=c<=0?0:Infinity;const disc=b*b-4*a*c;if(c>0&&a>0&&disc>=0)t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1&&t<first){first=t;hit=e;}}
 const fraction=hit?first:1;
 const pierces=!!hit&&(p.pierce??0)>0;
 return {projectile:{...p,x:p.x+dx*fraction,y:p.y+dy*fraction,remainingRange:p.remainingRange-travel*fraction,pierce:pierces?p.pierce-1:(p.pierce??0),hitIds:hit?[...(p.hitIds??[]),hit.id]:(p.hitIds??[])},hitId:hit?.id??null,expired:(!!hit&&!pierces)||p.remainingRange<=travel*fraction};
}
