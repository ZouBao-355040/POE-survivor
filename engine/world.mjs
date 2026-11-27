export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function moveToward(a,b,speed,dt,stop=0){const d=distance(a,b);if(d<=stop)return {...a};const step=Math.min(d-stop,Math.max(0,speed*dt));return {...a,x:a.x+(b.x-a.x)*step/d,y:a.y+(b.y-a.y)*step/d};}
export function nearestEnemy(player,enemies,range=Infinity){let best=null,d=range;for(const e of enemies){if(e.life<=0)continue;const n=distance(player,e);if(n<=d){best=e;d=n;}}return best;}
export function spawnEnemy(id,player,angle,radius,stats){return {...stats,id,x:player.x+Math.cos(angle)*radius,y:player.y+Math.sin(angle)*radius};}
