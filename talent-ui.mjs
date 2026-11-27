import {rangerTalents,talentPoints,talentAvailability,talentEffects,rangerTalentSource} from './engine/act-one-talents.mjs?v=0.5.6';

const routes=Object.freeze([
 ['firepower','投射物路線','從投射物與命中開始，可往傷害或攻擊速度繞到彈道學。'],
 ['survival','生命與閃避路線','從閃避與生命開始，可沿閃避或命中與攻擊走向靈巧。'],
 ['movement','敏捷與走位路線','敏捷每 10 點提供 20 命中值、2% 閃避，往外可配置移動速度。']
]);

export function renderTalentTree(container,{progression,onAllocate}){
 const doc=container.ownerDocument;
 const element=(tag,text,cls)=>{
  const el=doc.createElement(tag);
  if(text)el.textContent=text;
  if(cls)el.className=cls;
  return el;
 };
 const preferred=container.querySelector('[aria-pressed="true"][data-talent-route]')?.dataset.talentRoute??routes[0][0];
 const previouslyFocused=container.contains(doc.activeElement)?doc.activeElement?.dataset.talentId:null;
 const {earned,spent,remaining}=talentPoints(progression);
 const points=element('p','剩餘 '+remaining+' 點（已配 '+spent+'／累計 '+earned+'）','talent-points');
 points.setAttribute('aria-live','polite');
 const summary=element('p','遊俠起點節錄 · 每點配置一個相鄰天賦。這版尚未開放退點。','muted');
 const tabs=element('div',null,'button-row talent-routes');
 tabs.setAttribute('aria-label','天賦路線');
 const section=element('section',null,'talent-route-panel');
 const source=element('a','資料來源：PoE 1 3.30.0 原版遊俠起點','muted');
 source.href=rangerTalentSource;source.target='_blank';source.rel='noopener noreferrer';
 function renderRoute(branch){
  const title=routes.find(r=>r[0]===branch);
  if(!title)return;
  for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab.dataset.talentRoute===branch));
  section.replaceChildren(element('h3',title[1]),element('p',title[2],'muted'));
  const list=element('div',null,'library-list talent-list');
  for(const talent of rangerTalents.filter(t=>t.branch===branch)){
   const state=talentAvailability(progression,talent.id);
   const button=element('button',null,'gem-card talent-node');
   button.type='button';button.dataset.talentId=talent.id;
   button.dataset.talentState=state.allocated?'allocated':state.available?'available':'locked';
   button.setAttribute('aria-pressed',String(state.allocated));
   button.setAttribute('aria-disabled',String(!state.available));
   const name=element('strong',talent.name+(talent.notable?' · 重要天賦':''));
   button.append(name);
   for(const effect of talentEffects(talent))button.append(element('small',effect));
   button.append(element('small',state.reason));
   const links=state.links.map(n=>n.name+' #'+n.id);
   if(links.length)button.append(element('small','連接：'+links.join('、')));
   if(state.available)button.onclick=()=>onAllocate(talent.id);
   list.append(button);
  }
  section.append(list);
 }
 for(const [branch,title] of routes){
  const button=element('button',title);button.type='button';button.dataset.talentRoute=branch;
  button.onclick=()=>renderRoute(branch);tabs.append(button);
 }
 container.replaceChildren(points,summary,tabs,section,source);
 renderRoute(preferred);
 if(previouslyFocused)container.querySelector('[data-talent-id="'+previouslyFocused+'"]')?.focus({preventScroll:true});
}
