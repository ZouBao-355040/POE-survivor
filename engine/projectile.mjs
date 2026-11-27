// Continuous collision in world units; no projectile tunnels through a target at speed.
const EPS = 1e-8;
const distance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);

function firstCollision(p,dx,dy,enemies){
 let first=Infinity, hit=null;
 const a=dx*dx+dy*dy;
 for(const e of enemies){
  if(e.life<=0||p.hitIds?.includes(e.id)||p.volley?.hits.has(e.id)||p.ignoreId===e.id)continue;
  const x=p.x-e.x,y=p.y-e.y,r=(e.radius??.35)+(p.radius??0);
  const b=2*(x*dx+y*dy),c=x*x+y*y-r*r,disc=b*b-4*a*c;
  const t=c<=0?0:a>0&&disc>=0?(-b-Math.sqrt(disc))/(2*a):Infinity;
  if(t>=0&&t<=1&&t<first){first=t;hit=e;}
 }
 return {hit,fraction:hit?first:1};
}

export function advanceProjectile(p,dt,enemies){
 const travel=Math.min(p.remainingRange,p.speed*dt);
 const dx=p.dx*travel,dy=p.dy*travel;
 const {hit,fraction}=p.noCollision?{hit:null,fraction:1}:firstCollision(p,dx,dy,enemies);
 const moved=travel*fraction, remainingRange=p.remainingRange-moved;
 const pierces=!!hit&&(p.pierce??0)>0;
 return {projectile:{...p,x:p.x+dx*fraction,y:p.y+dy*fraction,remainingRange,
  distanceTravelled:(p.distanceTravelled??0)+moved,age:(p.age??0)+(p.speed>0?moved/p.speed:dt),
  pierce:pierces?p.pierce-1:(p.pierce??0),hitIds:hit?[...(p.hitIds??[]),hit.id]:(p.hitIds??[])},
  hitId:hit?.id??null,used:p.speed>0?moved/p.speed:dt,
  expired:(!!hit&&!pierces)||remainingRange<=EPS};
}

const aim=(p,target,extra={})=>{
 const d=distance(p,target);
 return d>EPS?{...p,...extra,dx:(target.x-p.x)/d,dy:(target.y-p.y)/d}:null;
};
const turn=(p,a,extra={})=>({...p,...extra,dx:p.dx*Math.cos(a)-p.dy*Math.sin(a),dy:p.dx*Math.sin(a)+p.dy*Math.cos(a)});

export function redirectProjectile(p,enemies,player,{hitId=null}={}){
 const candidates=enemies.filter(e=>e.life>0&&!p.hitIds?.includes(e.id)&&!p.volley?.hits.has(e.id)
  &&distance(p,e)<=Math.min(p.remainingRange,p.chainRadius??6));
 candidates.sort((a,b)=>distance(p,a)-distance(p,b));
 if(hitId!==null&&!p.returning&&p.remainingRange>EPS){
  if(p.split>0&&candidates.length)return candidates.slice(0,p.split).map(e=>aim(p,e,{split:0})).filter(Boolean);
  if(p.fork>0)return [-.52,.52].map(a=>turn(p,a,{fork:p.fork-1}));
  if(p.chain>0){const next=candidates.map(e=>aim(p,e,{chain:p.chain-1})).find(Boolean);if(next)return [next];}
 }
 if(p.canReturn&&!p.returning){
  const next=aim(p,player,{returning:true,hitIds:[],ignoreId:hitId,volley:p.returnVolley,pierce:Infinity,
   remainingRange:distance(p,player),fork:0,chain:0,split:0,noCollision:false});
  if(next)return [next];
 }
 return [];
}

// An entity consumes only the unused fraction of the world tick after a collision.
export function stepProjectiles(shots,dt,{enemies,player,impact=()=>{},terminate=()=>{},pulse=()=>{},steer}){
 const next=[];
 for(const original of shots){
  const queue=[[original,dt]];
  for(let i=0;i<queue.length;i++){
   let [p,left]=queue[i];
   if(p.delay>0){const wait=Math.min(p.delay,left);p={...p,delay:p.delay-wait};left-=wait;}
   if(left<=EPS){next.push(p);continue;}
   if(p.returning){
    p=aim(p,player,{remainingRange:distance(p,player)});
    if(!p)continue;
   } else if(steer){p=steer(p,left);}
   let step=left;
   if(p.pulseEvery>0)step=Math.min(step,Math.max(EPS,p.pulseEvery-(p.pulseAge??0)));
   const result=advanceProjectile(p,step,enemies);
   const target=result.hitId===null?null:enemies.find(e=>e.id===result.hitId);
   if(target){p.volley?.hits.add(target.id);impact(target,result.projectile);}
   let moved=result.projectile;
   if(p.pulseEvery>0){
    moved={...moved,pulseAge:(p.pulseAge??0)+result.used};
    if(moved.pulseAge>=p.pulseEvery-EPS){pulse(moved);moved.pulseAge=0;}
   }
   if(p.ignoreId!==null&&p.ignoreId!==undefined){
    const ignored=enemies.find(e=>e.id===p.ignoreId);
    if(!ignored||distance(moved,ignored)>(ignored.radius??.35)+(p.radius??0))moved.ignoreId=null;
   }
   const spare=Math.max(0,left-result.used);
   if(target&&p.split>0&&!p.returning&&moved.remainingRange>EPS){
    const split=redirectProjectile({...moved,fork:0,chain:0,canReturn:false},enemies,player,{hitId:target.id});
    if(split.length){for(const part of split)queue.push([{...part,pierce:p.pierce,fork:p.fork,chain:p.chain,canReturn:p.canReturn},spare]);continue;}
   }
   if(result.expired){
    const routed=redirectProjectile({...moved,split:0},enemies,player,{hitId:result.hitId});
    if(routed.length){
     for(const part of routed)queue.push([part,spare]);
    }else{
     for(const child of terminate(moved,target)??[])queue.push([child,spare]);
    }
   }else if(spare>EPS&&(target||step<left-EPS)){
    queue.push([moved,spare]);
   }else next.push(moved);
  }
 }
 return next;
}
