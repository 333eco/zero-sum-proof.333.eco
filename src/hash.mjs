/** The Poseidon2 shapes the circuit uses (circuit/main.nr.tmpl), computed by the same library that proves. ⛔ Any change here must match the circuit, or nothing proves. */
import { Barretenberg } from "@aztec/bb.js";

export const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const mod = (x) => ((x % P) + P) % P;
const toBytes = (x) => { const b = new Uint8Array(32); let v = mod(x); for (let i = 31; i >= 0; i--) { b[i] = Number(v & 255n); v >>= 8n; } return b; };
// ⭐ No Buffer and no node:crypto here or in verify.mjs and published.mjs: the same files run in a browser.
export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromBytes = (b) => BigInt(`0x${toHex(b)}`);
export const fromBase64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
export const toBase64url = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const sha256 = async (b) => new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", b));
export const hex = (x) => `0x${mod(x).toString(16)}`;
export const pack = (bytes, start, count) => { let v = 0n; for (let i = 0; i < count; i++) v = v * 256n + BigInt(bytes[start + i]); return v; };

export async function hasher(api) {
    const own = !api;
    api ??= await Barretenberg.new({ threads: 1 });
    const perm = async (a, b, c, d) => fromBytes((await api.poseidon2Permutation({ inputs: [a, b, c, d].map(toBytes) })).outputs[0]);
    return {
        api, perm,
        hash2: (l, r) => perm(l, r, 0n, 2n),
        acctLeaf: (key, bal, salt) => perm(key, bal, salt, 3n),
        spentLeaf: (key) => perm(key, 1n, 0n, 4n),
        commitment: (a, s, blind) => perm(a, s, blind, 5n),
        acctKey: async (kind, season, ledger, a, b, c, d) => perm(await perm(kind * 4294967296n * 256n + season * 256n + ledger, a, b, 6n), c, d, 7n),
        destroy: () => (own ? api.destroy() : undefined),
    };
}
