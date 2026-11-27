// Provisional PoE1 baseline; patch-specific values require verification.
const mod=(stat,kind,value)=>({stat,kind,value});
export function statusModifiers(id,{effect=1,stacks=0,element,exposure=.1}={}){
 if(!Number.isFinite(effect)||effect<0||!Number.isFinite(stacks)||stacks<0)throw new RangeError('Invalid status');
 const inc=(stat,v)=>mod(stat,'increased',v*effect);
 switch(id){
 case 'onslaught':return ['attackSpeed','castSpeed','movementSpeed'].map(s=>inc(s,.2));
 case 'arcaneSurge':return [inc('castSpeed',.1),inc('manaRegeneration',.3)];
 case 'adrenaline':return [inc('damage',1),...['attackSpeed','castSpeed','movementSpeed'].map(s=>inc(s,.25)),mod('additionalPhysicalReduction','flat',.1*effect)];
 case 'intimidate':return [inc('attackDamageTaken',.1)];
 case 'blind':return [inc('accuracy',-.2),inc('evasion',-.2)];
 case 'maim':return [inc('movementSpeed',-.3)];
 case 'hinder':return [inc('movementSpeed',-.3)];
 case 'exposure':if(!['fire','cold','lightning'].includes(element))throw new Error('Invalid exposure');return [mod(element+'Resistance','flat',-exposure*effect)];
 case 'rage':return [mod('attackDamage','more',.01*stacks*effect)];
 case 'fortification':return [mod('hitDamageTaken','more',-Math.min(1,.01*stacks*effect))];
 case 'phasing':return [mod('phasing','override',1)];
 default:throw new Error('Unknown status');
 }
}
