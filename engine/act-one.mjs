// Main-route zone names from PoE 1; enemy numbers and waves are Survivor balance.
const fire=(damage,radius,windup=.9)=>({damage,radius,windup});
export const actOne=Object.freeze([
 {id:'coast',name:'暮光海灘',duration:120,packs:10,packSize:6,maxActive:12,refillAt:6,theme:'coast',
  boss:{name:'怒炎之使',health:700,range:6.8,rate:.48,fireCast:fire(16,2.1)}},
 {id:'mud-flats',name:'炙熱鹽沼',duration:105,packs:11,packSize:6,maxActive:15,refillAt:7,theme:'mud',glyphs:true,
  boss:{name:'腐生恐喙',health:950,speed:2.3,physical:17,rate:.64}},
 {id:'passage',name:'海潮地穴',duration:100,packs:11,packSize:6,maxActive:16,refillAt:7,theme:'cave',
  boss:{name:'海蟲之母',health:1450,range:5.8,rate:.44,fireCast:fire(15,1.8)}},
 {id:'ledge',name:'沉寂海崖',duration:90,packs:10,packSize:7,maxActive:17,refillAt:8,theme:'ridge',
  boss:{name:'偽神庫度古',health:1900,range:7.2,rate:.44,fireCast:fire(18,2.2)}},
 {id:'climb',name:'碎岩山坡',duration:90,packs:11,packSize:7,maxActive:18,refillAt:8,theme:'ridge',
  boss:{name:'遺世鐵鋒',health:2400,speed:2.4,physical:20,rate:.7}},
 {id:'lower-prison',name:'禁靈之獄下層',duration:85,packs:11,packSize:7,maxActive:18,refillAt:8,theme:'prison'},
 {id:'upper-prison',name:'禁靈之獄上層',duration:105,packs:12,packSize:7,maxActive:18,refillAt:8,theme:'prison',
  boss:{name:'典獄長布魯特斯',health:3200,speed:2.15,physical:23,rate:.64}},
 {id:'prisoners-gate',name:'監獄大門',duration:95,packs:12,packSize:7,maxActive:19,refillAt:9,theme:'ridge',
  boss:{name:'暴炎獸',health:4100,range:6.5,rate:.52,fireCast:fire(21,2.2)}},
 {id:'ship-graveyard',name:'魅影船墓',duration:90,packs:12,packSize:7,maxActive:20,refillAt:9,theme:'cave'},
 {id:'cavern-wrath',name:'怨忿之窟',duration:90,packs:11,packSize:8,maxActive:20,refillAt:9,theme:'cave'},
 {id:'cavern-anger',name:'怨忿之窟深處',duration:120,packs:12,packSize:8,maxActive:22,refillAt:10,theme:'cave',
  boss:{name:'莫薇兒',health:6500,phaseTwo:true,range:6.9,rate:.49,fireCast:{...fire(25,2.4,.98),element:'cold'}}},
]);
export const trialStage=n=>actOne[n]??null;
export function advanceRoute(state){
 if(state.zone!=='trial'||state.dead||state.encounter?.phase!=='cleared')return state;
 const current=state.routeIndex??0;
 return {...state,routeIndex:current+1,chapterComplete:current+1>=actOne.length};
}
