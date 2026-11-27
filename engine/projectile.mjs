export function advanceProjectile(p,dt,enemies){
 const travel=Math.min(p.remainingRange,p.speed*dt);
 const dx=p.dx*travel,dy=p.dy*travel;
 let hit=null,first=Infinity;
 for(const e of enemies){if(e.life<=0||(p.hitIds??[]).includes(e.id))continue;const x=p.x-e.x,y=p.y-e.y,r=e.radius??.35;const a=dx*dx+dy*dy,b=2*(x*dx+y*dy),c=x*x+y*y-r*r;let t=c<=0?0:Infinity;const disc=b*b-4*a*c;if(c>0&&a>0&&disc>=0)t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1&&t<first){first=t;hit=e;}}
 const fraction=hit?first:1;
 const pierces=!!hit&&(p.pierce??0)>0;
 return {projectile:{...p,x:p.x+dx*fraction,y:p.y+dy*fraction,remainingRange:p.remainingRange-travel*fraction,pierce:pierces?p.pierce-1:(p.pierce??0),hitIds:hit?[...(p.hitIds??[]),hit.id]:(p.hitIds??[])},hitId:hit?.id??null,expired:(!!hit&&!pierces)||p.remainingRange<=travel*fraction};
}

export function redirectProjectile(p,enemies,player){
 const candidates=enemies.filter(e=>e.life>0&&!(p.hitIds??[]).includes(e.id)&&!p.volley?.hits.has(e.id));
 const aim=(target,extra)=>{const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy);return d>0?{...p,...extra,dx:dx/d,dy:dy/d}:null;};
 if((p.fork??0)>0){return [-.5,.5].map(a=>({...p,fork:p.fork-1,dx:p.dx*Math.cos(a)-p.dy*Math.sin(a),dy:p.dx*Math.sin(a)+p.dy*Math.cos(a)}));}
 if((p.chain??0)>0&&candidates.length){candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));const next=aim(candidates[0],{chain:p.chain-1});if(next)return [next];}
 if(p.canReturn&&!p.returning){const next=aim(player,{returning:true,hitIds:[],volley:undefined,remainingRange:Math.hypot(player.x-p.x,player.y-p.y),fork:0,chain:0});if(next)return [next];}
 return [];
}
