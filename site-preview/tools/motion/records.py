"""Write site-preview/src/data/motion.json from the cut lists."""
import json, sys
repo = sys.argv[1]
products = json.load(open(f'{repo}/src/data/products.json'))
lst = [l.split() for l in open('/tmp/aha-video/campaign-list.txt')]
photo_src = {}
for p in products:
    for i, c in enumerate(p['campaign']):
        photo_src[(p['slug'], i)] = c['src']
shot_photo = {}
for line in open('/tmp/aha-video/shots.txt'):
    name, idx = line.split()[:2]
    slug, n = lst[int(idx)][0], int(lst[int(idx)][1])
    shot_photo[name] = photo_src[(slug, n)]
seeds = {k: v['seed'] for k, v in json.load(open('/tmp/aha-video/raw/prompts.json')).items()}
seeds['mm-1'] = 5103
city = {'c01': (37898716, 'Yura Forrat'), 'c02': (5838621, 'CityXcape'), 'c03': (11724587, 'Jan Pischke'), 'c04': (19145696, 'Lukas Rodriguez'),
        'c05': (32095634, 'Stoic Tea Time Yelverton'), 'c06': (36244091, 'Yura Forrat'), 'c07': (36244109, 'Yura Forrat'), 'c08': (3856665, 'Martin Portas'),
        'c09': (5727833, 'CityXcape'), 'c10': (5729409, 'CityXcape'), 'c11': (5828502, 'Charles Parker'), 'c12': (15941743, 'Volkan Yilmaz'), 'c13': (36934432, 'Yura Forrat')}
GEN = 'AI image-to-video: LTX-2.3 distilled, run locally from the campaign photo; first half-second only; the 1972 film treatment is added afterwards'
films = json.load(open('/tmp/aha-video/films.json'))
out = {}
for f in films:
    lead = photo_src[(f['lead'], 0)]
    out[lead] = {
        'large': f"/motion/{f['name']}-800.mp4", 'small': f"/motion/{f['name']}-600.mp4", 'tall': f"/motion/{f['name']}-600t.mp4", 'seconds': f['seconds'],
        'label': f"{f['collection']} film · New York footage from Pexels · garment shots AI-generated",
        'city': [{'pexels': city[c][0], 'creator': city[c][1]} for c in f['shots'] if c in city],
        'garments': [{'photo': shot_photo[g], 'seed': seeds[g], 'generator': GEN} for g in f['shots'] if g not in city],
    }
json.dump(out, open(f'{repo}/src/data/motion.json', 'w'), indent=2, ensure_ascii=False)
open(f'{repo}/src/data/motion.json', 'a').write('\n')
print(json.dumps({k: [v['large'], len(v['city']), len(v['garments'])] for k, v in out.items()}, indent=1))
