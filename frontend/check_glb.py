import struct, json
with open('public/brain.glb', 'rb') as f:
    magic, version, length = struct.unpack('<4sII', f.read(12))
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    # chunk_type for JSON is 0x4E4F534A
    if chunk_type == 0x4E4F534A:
        json_data = f.read(chunk_length).decode('utf-8')
        data = json.loads(json_data)
        accessors = data.get('accessors', [])
        print("Total accessors:", len(accessors))
        for i, acc in enumerate(accessors):
            if 'min' in acc and 'max' in acc and acc.get('type') == 'VEC3':
                print(f"VEC3 Accessor {i}: min={acc.get('min')}, max={acc.get('max')}")
        
        # Print materials
        print("\nMaterials:")
        for m in data.get('materials', []):
            print(m)
