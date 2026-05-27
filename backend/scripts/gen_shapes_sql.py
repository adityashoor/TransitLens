import json

data = json.load(open('backend/scripts/route_shapes.json'))

chunk_size = 20
num_chunks = 0
for ci, i in enumerate(range(0, len(data), chunk_size)):
    chunk = data[i:i+chunk_size]
    vals = []
    for r in chunk:
        rid = r['route_id'].replace("'", "''")
        path_json = json.dumps(r['path']).replace("'", "''")
        vals.append(f"('{rid}', '{path_json}'::jsonb)")
    sql = "INSERT INTO public.tl_route_shapes (route_id, path) VALUES\n" + ",\n".join(vals) + "\nON CONFLICT (route_id) DO UPDATE SET path = EXCLUDED.path;"
    open(f'backend/scripts/shapes_{ci:02d}.sql', 'w', encoding='utf-8').write(sql)
    num_chunks = ci + 1

print(f'Written {num_chunks} SQL files for {len(data)} routes')
