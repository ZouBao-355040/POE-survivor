"""Offline ingestion: python scripts/build-projectile-index.py re-poe-gems.json poedb-tw-projectile.html
Both inputs are research snapshots, not runtime dependencies.
"""
import hashlib, html, json, pathlib, re, sys
gem_path, zh_path = map(pathlib.Path, sys.argv[1:])
raw = gem_path.read_bytes()
gems = json.loads(raw)
zh = {url: html.unescape(name) for url,name in re.findall(r'href="/tw/([^"#?]+)"[^>]*>([^<>]{1,80})</a>', zh_path.read_text()) if re.search(r'[\u4e00-\u9fff]',name)}
extra = {'FasterAttacks': '快速攻擊輔助', 'SupportFasterAttacks':'快速攻擊輔助',
 'SupportFasterCasting':'快速施放輔助','SupportAddedColdDamage':'附加冰冷傷害輔助','SupportAddedLightningDamage':'附加閃電傷害輔助',
 'SupportAddedFireDamage':'附加火焰傷害輔助','SupportAddedChaosDamage':'附加混沌傷害輔助','SupportMomentum':'動量輔助','SupportSpellEcho':'施放迴響輔助','SupportAwakenedSpellEcho':'覺醒．施放迴響輔助',
 'SupportGreaterSpellEcho':'高階施放迴響輔助','SupportUnleash':'釋放輔助','SupportAwakenedUnleash':'覺醒．釋放輔助',
 'SupportGreaterUnleash':'高階釋放輔助','SupportMirageArcher':'幻影射手輔助','SupportSacredWisps':'聖潔妖精輔助',
 'SupportVoidstorm':'虛空風暴輔助','SupportSummonPhantasm':'召喚幻影輔助'}
out = {}
for key,g in gems.items():
    item = g.get('base_item') or {}
    if (item.get('release_state') != 'released' or not item.get('id','').startswith(('Metadata/Items/Gems/SkillGem','Metadata/Items/Gems/SupportGem')) or re.search(r'Royale|Ruthless|HardMode|Playtest',key)):
        continue
    tags = g.get('tags') or []
    if 'projectile' not in tags and key not in extra: continue
    active = g.get('active_skill') or {}
    support = g.get('support_gem') or {}
    lev = g.get('per_level',{}).get('1') or {}
    st = g.get('static') or {}
    per = lev.get('stats') or []
    names = (g.get('display_name'),item.get('display_name'), active.get('display_name'))
    name = next((n for n in names if n),key)
    slug = re.sub(r"[^a-zA-Z0-9_'-]",'',name.replace(' ','_'))
    stats = {d['id']: per[i]['value'] if i<len(per) and per[i] and per[i].get('value') is not None else d.get('value') for i,d in enumerate(st.get('stats') or []) if d}
    keep = re.compile(r'^attack_(minimum|maximum)_added|^explosive_arrow|^fuse_arrow|^chance_to_freeze_shock_ignite|^cannot_pierce|^(spell|attack)_(minimum|maximum)_base_|^added_|^active_skill_projectile_speed|^base_chance_to_freeze|convert_to_|chance_to_|^base_number_of_|^always_pierce$|^number_of_|^support_|^projectile_|^active_skill_base_|^base_skill_effect_duration$|^base_.*damage_to_deal_per_minute$|pierce|fork|chain|return|additional|target|^cluster_burst|^ice_spear_second')
    costs = lev.get('costs') or st.get('costs') or {}
    rec = {
      'en': name, 'zh': zh.get(slug) or extra.get(key), 'slug':slug, 'effect':active.get('id'), 'support':bool(g.get('is_support')),
      'tags': [tag for tag in tags if tag not in {'grants_active_skill','strength','dexterity','intelligence','support'}],
      'types':active.get('types'), 'weapons':active.get('weapon_restrictions'), 'supportRules':{k:v for k,v in support.items() if 'type' in k or 'weapon' in k},
      'requiredLevel':lev.get('required_level'), 'mana':costs.get('Mana'), 'castMs':g.get('cast_time'), 'crit':st.get('crit_chance'),
      'attackSpeed':st.get('attack_speed_multiplier'), 'attackDamage':lev.get('damage_multiplier'),
      'effectiveness':lev.get('damage_effectiveness') if lev.get('damage_effectiveness') is not None else st.get('damage_effectiveness'),
      'costMultiplier':lev.get('cost_multiplier') or st.get('cost_multiplier'),
      'stats':{k:v for k,v in stats.items() if k and v is not None and keep.search(k)},
    }
    out[key] = {k:v for k,v in rec.items() if v is not None and v!=[] and v!={}}
print(len(out), sum(not g.get('zh') for g in out.values()))
print('Missing translation:',[(k,v['en']) for k,v in out.items() if not v.get('zh')])
output=pathlib.Path('engine/projectile-index.mjs')
output.write_text('// Generated with scripts/build-projectile-index.py. Do not edit manually.\nexport const snapshotSha256='+json.dumps(hashlib.sha256(raw).hexdigest())+';\nexport const gemIndex = {\n'+''.join(' '+json.dumps(k)+':'+json.dumps(v,ensure_ascii=False,separators=(',',':'))+',\n' for k,v in out.items())+'};\n')
