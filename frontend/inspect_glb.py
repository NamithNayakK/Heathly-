import struct, json

with open('src/assets/brain.glb', 'rb') as f:
    magic, version, length = struct.unpack('<4sII', f.read(12))
    chunk_length, chunk_type = struct.unpack('<II', f.read(8))
    if chunk_type == 0x4E4F534A:
        json_data = f.read(chunk_length).decode('utf-8')
        data = json.loads(json_data)
        print("Nodes:", json.dumps(data.get('nodes', []), indent=2))
        print("Meshes:", json.dumps(data.get('meshes', []), indent=2))
