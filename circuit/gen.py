#!/usr/bin/env python3
"""Writes circuit/src/main.nr: the statement the zero-sum proof proves (design/signed-proof.md, Part 2).

    python3 circuit/gen.py [K]      K = slots per proof (16 in production; tests use fewer, same code)

The tables (which bytes are safe, the base64url alphabet, the passkey site's hash) are computed here, never typed.
"""
import hashlib, sys, os
K = int(sys.argv[1]) if len(sys.argv) > 1 else 16
HERE = os.path.dirname(os.path.abspath(__file__))
ALPH = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
SAFE = set(ALPH) | set(b".:")
table = lambda s: "[" + ", ".join("true" if i in s else "false" for i in range(256)) + "]"
u8s = lambda b: "[" + ", ".join(str(x) for x in b) + "]"
lit = lambda s: (u8s(s.encode()), len(s.encode()))
RP = hashlib.sha256(b"sign.333.eco").digest()
L = {k: lit(v) for k, v in {
    "app": '{"app":"', "at": '","at":"', "cargo": '","cargo":"', "dir": '","dir":"', "from": '","from":"', "kind": '","kind":"',
    "ledger": '","ledger":"', "salt": '","salt":"', "season": '","season":', "to": ',"t":"thank","to":"', "units": '","units":', "v": ',"v":1}',
    "w_kind": "kind", "w_thankful": "thankful", "w_thing": "thing", "w_plant": "plant", "w_animal": "animal", "w_kiitos": "kiitos", "w_kiitti": "kiitti",
    "seal_tag": "ledger/seal/v1\0", "press_tag": "ledger/press/v1\0", "other_tag": "ledger/other/v1\0",
    "cd_prefix": '{"type":"webauthn.get","challenge":"', "cd_origin": '","origin":"https://sign.333.eco"',
}.items()}
src = open(os.path.join(HERE, "main.nr.tmpl"), encoding="utf-8").read()
for k, (arr, n) in L.items():
    src = src.replace("@%s@" % k, arr).replace("@%s_N@" % k, str(n))
src = src.replace("@K@", str(K)).replace("@SAFE@", table(SAFE)).replace("@B64@", table(set(ALPH))).replace("@ALPH@", u8s(ALPH)).replace("@RP@", u8s(RP))
assert "@" not in src.replace("@@", ""), [l for l in src.splitlines() if "@" in l][:3]
os.makedirs(os.path.join(HERE, "src"), exist_ok=True)
open(os.path.join(HERE, "src", "main.nr"), "w", encoding="utf-8").write(src)
print("main.nr written, K = %d" % K)
