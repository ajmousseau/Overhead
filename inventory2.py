"""
Livery inventory v2 — run from your repo folder (where liveries/ lives)
python3 inventory2.py
Paste the output back to Claude.
"""
import os, json

liveries = {}
bad = []

if not os.path.exists("liveries"):
    print("ERROR: no liveries/ folder here. Run from your repo root.")
    input("Press Enter to close...")
    raise SystemExit

for f in sorted(os.listdir("liveries")):
    if not (f.endswith(".webp") or f.endswith(".png")):
        continue
    base = f.rsplit(".",1)[0]
    if "_" not in base:
        bad.append(f)
        continue
    icao, typ = base.split("_",1)
    # sanity: real image check (first bytes)
    path = os.path.join("liveries",f)
    with open(path,"rb") as fh:
        head = fh.read(16)
    is_img = (head[:4]==b'RIFF' and head[8:12]==b'WEBP') or head[:8]==b'\x89PNG\r\n\x1a\n'
    if not is_img:
        bad.append(f + " (NOT AN IMAGE - html fake?)")
        continue
    liveries.setdefault(icao.upper(), []).append(typ)

airlines = sorted(liveries.keys())
all_types = sorted(set(t for v in liveries.values() for t in v))

print("="*60)
print(f"AIRLINES WITH LIVERIES: {len(airlines)}")
print(f"TOTAL LIVERY FILES: {sum(len(v) for v in liveries.values())}")
print(f"UNIQUE TYPE CODES: {len(all_types)}")
if bad:
    print(f"BAD FILES (skipped): {len(bad)}")
    for b in bad[:10]: print("  ", b)
print("="*60)
print()
print("AIRLINE CODES (paste this to Claude):")
print(",".join(airlines))
print()
print("TYPE CODES (paste this to Claude):")
print(",".join(all_types))
print()
# Per-airline detail file for reference
with open("livery_index.json","w") as f:
    json.dump({k:sorted(v) for k,v in liveries.items()}, f, indent=1)
print("Full detail saved to livery_index.json (paste that too if small enough)")
input("\nPress Enter to close...")
