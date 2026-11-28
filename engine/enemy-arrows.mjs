export const enemyArrowLimit=48;
export const playerArrowRadius=.46;

export function aimEnemyArrow(enemy,player,time){
 const dx=player.x-enemy.x,dy=player.y-enemy.y,n=Math.hypot(dx,dy);
 return {kind:'arrow-windup',x:enemy.x,y:enemy.y,dx:n>1e-9?dx/n:1,dy:n>1e-9?dy/n:0,
  source:enemy.id,impactAt:time+enemy.arrow.windup,windup:enemy.arrow.windup,range:enemy.arrow.speed*enemy.arrow.lifetime,speed:enemy.arrow.speed};
}

export function launchEnemyArrow(cast,enemy){
 return {x:cast.x,y:cast.y,dx:cast.dx,dy:cast.dy,speed:cast.speed,remaining:cast.range,
  attacker:{id:enemy.id,accuracy:enemy.accuracy},skill:{...enemy.attack,source:'attack',attackKind:'projectile'}};
}

// Relative swept collision: the arrow and the player both move during a world step.
export function moveEnemyArrows(arrows,dt,previous,player){
 if(dt===0)return {active:[...arrows],contacts:[]};
 const active=[],contacts=[];
 for(const arrow of arrows){
  const distance=Math.min(arrow.remaining,arrow.speed*dt);
  if(!(distance>0))continue;
  const span=distance/(arrow.speed*dt),x=arrow.x+arrow.dx*distance,y=arrow.y+arrow.dy*distance;
  const ox=arrow.x-previous.x,oy=arrow.y-previous.y;
  const dx=x-arrow.x-(player.x-previous.x)*span,dy=y-arrow.y-(player.y-previous.y)*span;
  const n=dx*dx+dy*dy;
  const t=n>1e-12?Math.max(0,Math.min(1,-(ox*dx+oy*dy)/n)):0;
  if(Math.hypot(ox+t*dx,oy+t*dy)<=playerArrowRadius)contacts.push(arrow);
  else if(arrow.remaining-distance>1e-9)active.push({...arrow,x,y,remaining:arrow.remaining-distance});
 }
 return {active,contacts};
}
