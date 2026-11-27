# Projectile family design

Sources: https://www.poewiki.net/wiki/Projectile ; https://www.poewiki.net/wiki/Pierce ; https://www.poewiki.net/wiki/Return ; https://www.poewiki.net/wiki/Barrage ; https://www.poewiki.net/wiki/Split_Arrow ; https://www.poewiki.net/wiki/Freezing_Pulse ; https://www.poewiki.net/wiki/Frostbolt ; https://www.poewiki.net/wiki/Power_Siphon

Verified shared behavior priority: split, pierce, fork, chain, return. One behavior per collision. Range is bounded by lifetime times speed and a maximum distance (15 metres in PoE); game world unit conversion remains to be defined. Track age and accumulated distance separately. Returning projectiles need separate hit history. Simultaneous volleys and sequential shots require different hit policies.

Verified Split Arrow level 1: 5 mana, 120% damage/effectiveness, 110% attack speed, 5 arrows. Barrage: sequential shots with 40% windup and 60% allocated to firing. Freezing Pulse: inherent pierce and lifetime-dependent damage/freeze decay. Frostbolt: inherent pierce. Power Siphon: target-specific radial targeting, culling and power charge mechanics.

Implementation backlog (not verified exhaustive): bow/wand straight shots, sequential attacks, secondary hits and explosions, ground trails, persistent projectiles, phase transitions, returning trajectories, spell casting and independent base damage, weapon restrictions, ailment handling, support-specific hit/ailment modifiers. Verify each skill and variant before enabling it. Exclude lobbed, random and orbiting trajectories from the initial straight-shot family unless their primary segment qualifies.
