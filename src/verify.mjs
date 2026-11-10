/**
 * Checks a published proof file against the public log, using only public things: the file, the log's own entries, the circuit's
 * verification key, the season rules and the log's name. Runs the same in Node and in a browser. ⭐ It says what was checked and nothing
 * more: every counted entry carries a passkey signature with the user verified, moves its rule's units from one account to another,
 * and is counted once, and the chain of commitments starts from empty trees, so every balance in every ledger and season adds to zero.
 */
import { UltraHonkVerifierBackend } from "@aztec/bb.js";
import { fromBase64, hasher, hex, P, toHex } from "./hash.mjs";
import { SparseTree } from "./tree.mjs";

const field32 = (x) => `0x${(((BigInt(x) % P) + P) % P).toString(16).padStart(64, "0")}`;
/** The circuit's public inputs, in its own order: c_old, c_new, origin, rules, seals. */
export function publicInputs(w, origin, rules, entries) {
    const out = [field32(w.c_old), field32(w.c_new)];
    for (const b of origin) out.push(field32(b));
    for (let s = 0; s < 8; s++) out.push(field32(rules[s]?.kiitos ?? 0), field32(rules[s]?.kiitti ?? 0));
    for (const e of entries) for (let i = 0; i < 32; i++) out.push(field32(e && e.length === 32 ? e[i] : 0));
    return out;
}

/** A public log entry (longer than 32 bytes: a tag, a NUL, then JSON), or null for a row's seal or padding. */
export function publicEntry(e) {
    if (!e || e.length === 32) return null;
    const nul = e.indexOf(0), m = nul > 0 ? /^ledger\/([a-z]+)\/v(\d+)$/.exec(new TextDecoder().decode(e.subarray(0, nul))) : null;
    if (!m) return null;
    try { return { ...JSON.parse(new TextDecoder().decode(e.subarray(nul + 1))), t: m[1] }; } catch { return null; }
}

/**
 * A season's close, as the file reveals it (C5): the two roots and the blind must open the very commitment the window holding that
 * season's `jubilee` entry ends with, so they are the trees the proofs moved and no others. ⛔ A season that closed inside this file
 * without a reveal fails: its people could not check. Returns { ok, why?, reveals: [{ season, acctRoot, spentRoot, at }] }.
 */
export async function checkReveals({ file, entry, h }) {
    const reveals = [], given = new Map((file.reveals ?? []).map((r) => [r.season, r]));
    for (const w of file.windows) {
        for (let i = 0; i < file.K; i++) {
            const p = publicEntry(await entry(w.from + i));
            if (p?.t !== "jubilee") continue;
            const r = given.get(p.n);
            if (!r) return { ok: false, why: `season ${p.n} closed at entry ${w.from + i}, and its accounts were not revealed` };
            if (r.at !== w.from) return { ok: false, why: `season ${p.n}'s reveal is not at the window that closes it` };
            if (field32(await h.commitment(BigInt(r.acctRoot), BigInt(r.spentRoot), BigInt(r.blind))) !== field32(w.c_new)) return { ok: false, why: `season ${p.n}'s revealed trees are not the ones the proofs moved` };
            reveals.push({ season: p.n, acctRoot: r.acctRoot, spentRoot: r.spentRoot, at: r.at });
            given.delete(p.n);
        }
    }
    if (given.size) return { ok: false, why: `a reveal for season ${[...given.keys()][0]}, which did not close here` };
    return { ok: true, reveals };
}

/** `prev`: the last c_new of the file before, when this file does not start the chain. Returns { ok, why?, last }. */
export async function verifyFile({ file, entry, vk, origin, rules, api, prev }) {
    const h = await hasher(api), v = new UltraHonkVerifierBackend(api);
    if (file.v !== 1) return { ok: false, why: "an unknown file version" };
    if (file.origin !== toHex(origin)) return { ok: false, why: "a file for another log" };
    let expect = prev;
    if (file.from === 0) {
        if (!file.genesis) return { ok: false, why: "the first file must show its starting point" };
        const a = await new SparseTree(h, 64).init(), s = await new SparseTree(h, 128).init();
        expect = hex(await h.commitment(a.root(), s.root(), BigInt(file.genesis.blind))); // empty trees: every balance starts at zero
    }
    if (!expect) return { ok: false, why: "nothing to chain from" };
    let at = file.from;
    for (const w of file.windows) {
        if (w.from !== at) return { ok: false, why: `a window starts at ${w.from}, not ${at}` };
        if (field32(w.c_old) !== field32(expect)) return { ok: false, why: `the window at ${w.from} does not start where the last one ended` };
        const entries = [];
        for (let i = 0; i < file.K; i++) entries.push(await entry(w.from + i));
        const ok = await v.verifyProof({ proof: fromBase64(w.proof), publicInputs: publicInputs(w, origin, rules, entries), verificationKey: vk }, { verifierTarget: "noir-recursive" }).catch(() => false);
        if (!ok) return { ok: false, why: `the proof for entries ${w.from}–${w.from + file.K - 1} does not verify` };
        expect = w.c_new;
        at += file.K;
    }
    if (at !== file.to) return { ok: false, why: "the file does not cover what it says" };
    const rv = await checkReveals({ file, entry, h });
    if (!rv.ok) return rv;
    return { ok: true, last: expect, windows: file.windows.length, reveals: rv.reveals };
}
