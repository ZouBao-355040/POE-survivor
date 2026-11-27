#!/usr/bin/env python3
"""Extract the shared main tree, not Ascendancies or item-generated subtrees."""
import hashlib, json, math, pathlib, sys
source = pathlib.Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(source).hexdigest() == '9686b969bbd744a77f13eeadc57bb71be5032b0ed22be1ee4dbf2025649ccab0'
d = json.loads(source)
n = {k:v for k,v in d['nodes'].items() if k.isdigit() and 'group' in v
     and not any(v.get(t) for t in ('ascendancyName','isProxy','isBlighted'))
     and not v.get('expansionJewel', {}).get('parent')}
def links(v):
    return sorted(set(v['in'] + v['out']) & n.keys(), key=int)
def location(v):
    g = d['groups'][str(v['group'])]
    o, i = v['orbit'], v['orbitIndex']
    degrees = ([0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330][i]
               if o in (2,3) else i * 360 / d['constants']['skillsPerOrbit'][o])
    a, r = math.radians(degrees), d['constants']['orbitRadii'][o]
    return [round(g['x']+math.sin(a)*r),round(g['y']-math.cos(a)*r)]
starts = {}
rows = []
for k,v in sorted(n.items(), key=lambda row:int(row[0])):
    kind = ('start' if 'classStartIndex' in v else 'mastery' if v.get('isMastery') else
            'keystone' if v.get('isKeystone') else 'jewel' if v.get('isJewelSocket') else
            'notable' if v.get('isNotable') else 'small')
    name = v['name']
    if kind == 'start':
        name = d['classes'][v['classStartIndex']]['name']
        starts[name] = int(k)
    rows.append([int(k),name,kind,*location(v),v['group'],list(map(int,links(v))),v['stats'],
                 [[e['effect'],e['stats']] for e in v.get('masteryEffects',[])]])
out = pathlib.Path(__file__).resolve().parents[1]/'engine'/'passive-tree-data.mjs'
out.write_text('// Generated from GGG passive skill tree 3.30.0; see scripts/import-passive-tree.py.\n'
    +'export const starts='+json.dumps(starts,separators=(',',':'))+';\nexport const rows=[\n'
    +''.join(json.dumps(row,separators=(',',':'))+',\n' for row in rows)+'];\n', encoding='utf8')
