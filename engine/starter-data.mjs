// Sources: https://www.poewiki.net/wiki/Crude_Bow
// https://poedb.tw/tw/Burning_Arrow
export const crudeBow={id:'crude-bow',damage:{physical:[5,13]},attacksPerSecond:1.4,criticalChance:.05};
export const burningArrow={id:'burning-arrow',kind:'active',level:1,tags:['attack','projectile','fire','bow'],cost:8,weaponDamageMultiplier:2.8,effectiveness:2.8,attackSpeedMultiplier:.7,conversion:[{from:'physical',to:'fire',fraction:1,kind:'convert',priority:'skill'}],igniteChance:.25,projectileSpeed:32.6};
export const basicBowAttack={id:'basic-bow-attack',tags:['attack','projectile','bow'],cost:0,weaponDamageMultiplier:1,effectiveness:1,attackSpeedMultiplier:1};
