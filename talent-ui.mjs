import {resolveCharacterClass} from './engine/character.mjs?v=0.5.10';
import {nodes,points,treeStatus,tracePath,classNames,sourceUrl} from './engine/passive-tree.mjs?v=0.5.26';

export function renderTalentTree(container,{progression,onAllocate}){
 const doc=container.ownerDocument;
 function el(tag,txt='',cls=''){const n=doc.createElement(tag);n.textContent=txt;n.className=cls;return n;}
 const button=(txt,action)=>{const b=el('button',txt);b.type='button';b.onclick=action;return b;};
 const status=el('p','','talent-points');status.setAttribute('aria-live','polite');
 const summary=el('p','PoE 1 主天賦樹 · 拖曳移動、雙指縮放。未接入的效果可查看，但不會扣點。','muted');
 const bar=el('div','','talent-tools'), search=el('input'), filter=el('select');
 search.type='search';search.placeholder='搜尋名稱、效果或節點編號';search.setAttribute('aria-label','搜尋天賦');
 filter.setAttribute('aria-label','篩選天賦');
 for(const [key,label] of [['all','全部節點'],['keystone','關鍵天賦'],['mastery','專精天賦'],['available','目前可點'],['allocated','已配置']]){
  const opt=el('option',label);opt.value=key;filter.append(opt);
 }
 bar.append(search,filter);
 const map=el('canvas','','talent-map');map.setAttribute('aria-label','主天賦樹地圖。也可用搜尋及下方清單選取天賦');
 const controls=el('div','','talent-tools');
 const results=el('div','','talent-results'), details=el('section','','talent-details');
 const shell=el('div','','talent-shell'), sidebar=el('div','','talent-sidebar');
 const source=el('a','資料：PoE 1 3.30.0', 'muted');source.href=sourceUrl;source.target='_blank';source.rel='noopener noreferrer';
 sidebar.append(bar,results,details);shell.append(map,sidebar);
 container.replaceChildren(status,summary,controls,shell,source);

 const ctx=map.getContext('2d'),all=[...nodes.values()];
 const links=all.flatMap(n=>n.neighbors.filter(id=>id>n.id).map(id=>[n,nodes.get(id)]));
 const colors={start:'#e9d9a5',allocated:'#e7b964',available:'#92e1c5',locked:'#8595a1',unimplemented:'#53616b'};
 const camera={x:0,y:0,scale:.15};
 let w=0,h=0,ratio=1,selected,tree,path=[],filterMatches=null;
 const min=.027,max=.72;
 const screen=n=>[(n.x-camera.x)*camera.scale+w/2,(n.y-camera.y)*camera.scale+h/2];
 const radius=n=>n.kind==='start'||n.kind==='keystone'?6:n.kind==='mastery'||n.kind==='notable'?4:2.6;
 function refreshSize(){
  if(!map.isConnected||!map.clientWidth||!map.clientHeight)return;
  w=map.clientWidth;h=map.clientHeight;ratio=Math.min(2,doc.defaultView.devicePixelRatio||1);
  if(map.width!==Math.round(w*ratio)||map.height!==Math.round(h*ratio)){
   map.width=Math.round(w*ratio);map.height=Math.round(h*ratio);
  }
  draw();
 }
 function draw(){
  if(!w||!h)return;
  const lit=new Set(path);
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  for(const [n,m] of links){
   const [x,y]=screen(n), [a,b]=screen(m);
   if(Math.max(x,a)<0||Math.min(x,a)>w||Math.max(y,b)<0||Math.min(y,b)>h)continue;
   const both=(tree.picked.has(n.id)||tree.start===n.id)&&tree.picked.has(m.id)||tree.picked.has(n.id)&&tree.start===m.id;
   ctx.beginPath();ctx.strokeStyle=both?'#e5b564':lit.has(n.id)&&lit.has(m.id)?'#88cbbb':'#34444f';
   ctx.lineWidth=both?2:1;ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();
  }
  for(const n of all){
   const [x,y]=screen(n);
   if(x< -12||x>w+12||y< -12||y>h+12)continue;
   const s=tree.availability(n.id).state, r=Math.max(1.2,radius(n)*Math.min(1,camera.scale/.115));
   ctx.globalAlpha=filterMatches&&!filterMatches.has(n.id)&&n.id!==selected&&n.id!==tree.start&&!lit.has(n.id)?.25:1;
   ctx.beginPath();
   if(n.kind==='keystone'||n.kind==='mastery'){ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();}
   else ctx.arc(x,y,r,0,Math.PI*2);
   ctx.fillStyle=colors[s];ctx.fill();
   if(n.id===selected||lit.has(n.id)){ctx.lineWidth=1.4;ctx.strokeStyle=n.id===selected?'#fff4d5':'#9ac4be';ctx.stroke();}
   if(n.kind==='start'&&camera.scale>.045){ctx.font='11px sans-serif';ctx.fillStyle=colors.start;ctx.fillText(n.name,x+8,y+4);}
  }
  ctx.globalAlpha=1;
 }
 function zoom(factor,atX=w/2,atY=h/2){
  const was=camera.scale,next=Math.max(min,Math.min(max,was*factor));
  camera.x+=(atX-w/2)*(1/was-1/next);camera.y+=(atY-h/2)*(1/was-1/next);camera.scale=next;draw();
 }
 function center(id,scale){
  const n=nodes.get(id);camera.x=n.x;camera.y=n.y;if(scale)camera.scale=scale;draw();
 }
 function select(id,centerMap){
  selected=id;
  path=tracePath(progression,id);
  if(centerMap)center(id,Math.max(.12,camera.scale));
  else draw();
  renderDetails();
 }
 function renderDetails(){
  details.replaceChildren();
  const n=nodes.get(selected);
  if(!n){details.append(el('p','點選地圖或清單上的天賦查看效果。','muted'));return;}
  const tag={small:'普通天賦',notable:'重要天賦',keystone:'關鍵天賦',mastery:'專精天賦',start:'職業起點',jewel:'珠寶插槽'}[n.kind];
  const verdict=tree.availability(n.id);
  details.append(el('h3',n.name),el('p',tag+' · #'+n.id,'muted'));
  if(n.kind==='mastery'){
   for(const option of n.options){
    const check=tree.availability(n.id,option.id);
    const current=Number(progression.masteries?.[n.id])===option.id;
    const line=el('div','','mastery-choice');
    line.append(el('p',option.effects.join('；')));
    const label=current?'已選擇':!option.available?'尚未接入':check.state==='available'?'配置此效果':tree.used.has(option.id)?'已在其他專精選擇':verdict.state==='allocated'?'此群已選擇其他效果':check.reason;
    const choose=button(label,()=>apply(n.id,option.id));choose.disabled=check.state!=='available';choose.dataset.masteryEffect=option.id;
    line.append(choose);details.append(line);
   }
  }else{
   for(const line of n.effects)details.append(el('p',line));
   const b=button(verdict.state==='available'?'配置天賦（1 點）':verdict.reason,()=>apply(n.id));
   b.disabled=verdict.state!=='available';b.dataset.talentAllocate=n.id;b.dataset.talentState=verdict.state;
   details.append(b);
  }
  if(path.length>2){
   details.append(el('p','沿可用連線尚需 '+(path.length-1)+' 點','muted'));
   const step=path[1];details.append(button('查看下一個節點：'+nodes.get(step).name,()=>select(step,true)));
  }
 }
 function renderResults(){
  results.replaceChildren();
  const q=search.value.normalize('NFKC').trim().toLowerCase(),mode=filter.value;
  let candidates=all.filter(n=>mode==='all'||n.kind===mode||tree.availability(n.id).state===mode);
  if(q)candidates=candidates.filter(n=>String(n.id).includes(q)||[n.name,n.original,...n.effects].some(s=>s.toLowerCase().includes(q)));
  filterMatches=q||mode!=='all'?new Set(candidates.map(n=>n.id)):null;
  if(!q&&mode==='all')candidates=candidates.filter(n=>n.id===tree.start||tree.picked.has(n.id)||n.neighbors.some(id=>id===tree.start||tree.picked.has(id)));
  const root=nodes.get(tree.start);
  const rank=n=>n.id===tree.start?-3:tree.availability(n.id).state==='available'?-2:tree.picked.has(n.id)?-1:0;
  candidates.sort((a,b)=>rank(a)-rank(b)||Math.hypot(a.x-root.x,a.y-root.y)-Math.hypot(b.x-root.x,b.y-root.y));
  for(const n of candidates.slice(0,60)){
   const b=button(n.name+' #'+n.id,()=>select(n.id,true));
   const v=tree.availability(n.id);b.dataset.talentId=n.id;b.dataset.talentState=v.state;
   if(v.state==='unimplemented')b.append(el('small','未接入'));
   results.append(b);
  }
  if(!candidates.length)results.append(el('p','找不到符合條件的節點。','muted'));
  else if(candidates.length>60)results.prepend(el('p','顯示前 60／'+candidates.length+'。輸入名稱或編號可縮小範圍。','muted'));
  draw();
 }
 function apply(id,option){
  const next=onAllocate(id,option);if(!next)return;
  progression=next;refresh();
  details.querySelector('h3')?.setAttribute('tabindex','-1');details.querySelector('h3')?.focus({preventScroll:true});
 }
 function refresh(){
  tree=treeStatus(progression);if(selected)path=tracePath(progression,selected);
  const {earned,spent,remaining}=points(progression);
  status.textContent=classNames[resolveCharacterClass(progression)]+' · 剩餘 '+remaining+' 點（已配 '+spent+'／累計 '+earned+'）';
  renderResults();renderDetails();refreshSize();
 }
 search.oninput=filter.onchange=renderResults;
 controls.append(button('放大 +',()=>zoom(1.4)),button('縮小 −',()=>zoom(1/1.4)),
  button('我的起點',()=>center(tree.start,.16)),button('總覽',()=>{camera.x=0;camera.y=-100;camera.scale=Math.max(min,Math.min(w/27000,h/18800));draw();}));
 const pointers=new Map();let drag=0;
 const position=e=>{const r=map.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 map.onpointerdown=e=>{if(!pointers.size)drag=0;pointers.set(e.pointerId,position(e));map.setPointerCapture(e.pointerId);};
 map.onpointermove=e=>{
  if(!pointers.has(e.pointerId))return;
  const was=[...pointers.values()];pointers.set(e.pointerId,position(e));const next=[...pointers.values()];
  if(next.length===1){const dx=next[0].x-was[0].x,dy=next[0].y-was[0].y;drag+=Math.abs(dx)+Math.abs(dy);camera.x-=dx/camera.scale;camera.y-=dy/camera.scale;}
  if(next.length>=2){drag=10;
   const [a,b]=was,[c,d]=next;const distance=Math.hypot(a.x-b.x,a.y-b.y);
   camera.x-=(c.x+d.x-a.x-b.x)/2/camera.scale;camera.y-=(c.y+d.y-a.y-b.y)/2/camera.scale;
   if(distance>0)zoom(Math.max(.25,Math.hypot(c.x-d.x,c.y-d.y)/distance),(c.x+d.x)/2,(c.y+d.y)/2);
  }
  draw();
 };
 map.onpointercancel=e=>pointers.delete(e.pointerId);
 map.onpointerup=e=>{
  pointers.delete(e.pointerId);if(drag>6||pointers.size)return;
  const p=position(e);let nearest=null,dist=12;
  for(const n of all){const [x,y]=screen(n),d=Math.hypot(p.x-x,p.y-y);if(d<dist){dist=d;nearest=n.id;}}
  if(nearest)select(nearest,false);
 };
 map.addEventListener('wheel',e=>{e.preventDefault();const p=position(e);zoom(Math.exp(-e.deltaY*.002),p.x,p.y);},{passive:false});
 refresh();center(tree.start,.16);
 const resize=new ResizeObserver(refreshSize);resize.observe(map);
 container.closest('dialog')?.addEventListener('close',()=>resize.disconnect(),{once:true});
}
