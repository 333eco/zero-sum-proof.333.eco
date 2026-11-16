/**
 * Checks everything the zero-sum proof has published, from the public log alone (log.333.eco/ledger): its checkpoint, its entries, the
 * `proof` entries among them, each file against the hash its entry holds, and the chain of proofs from the first entry of the log.
 * Runs in Node and in a browser. ⭐ It reports what it checked, and how far; never more.
 */
import { hasher, sha256, toBase64url, toHex } from "./hash.mjs";
import { checkReveals, verifyFile } from "./verify.mjs";

const bundle = (b) => { const out = []; for (let i = 0; i < b.length;) { const n = (b[i] << 8) | b[i + 1]; out.push(b.subarray(i + 2, i + 2 + n)); i += 2 + n; } return out; };
const idx = (n) => { const s = String(n).padStart(3, "0"); return n < 1000 ? s : `x${s}`; };
/** How many tiles, and how many proof files, are fetched at once (perf audit 2026-11-15, perf-13: one after another before, and the log grows every day). */
export const AT_ONCE = 8;
/** `fn` over 0…n−1, at most `cap` at a time, the results in index order. A failure stops new work; the lowest failing index's error is thrown, as one-by-one would. */
async function inOrder(n, cap, fn) {
    const out = new Array(n), errs = new Map();
    let next = 0;
    const lane = async () => { while (next < n && !errs.size) { const i = next++; try { out[i] = await fn(i); } catch (e) { errs.set(i, e); } } };
    await Promise.all(Array.from({ length: Math.min(cap, n) }, lane));
    if (errs.size) throw errs.get(Math.min(...errs.keys()));
    return out;
}
/** Item k, with the next `cap` − 1 already on their way: a failure is thrown only when its own item is asked for, as one-by-one would. */
function ahead(n, cap, fetchOne) {
    const got = new Array(n);
    return (k) => { for (let j = k; j < Math.min(n, k + cap); j++) if (!got[j]) { got[j] = fetchOne(j); got[j].catch(() => {}); } return got[k]; };
}

export async function readLog(base, doFetch = fetch) {
    const get = async (p) => { const r = await doFetch(`${base}/${p}`); if (!r.ok) throw new Error(`${p}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
    const note = new TextDecoder().decode(await get("checkpoint")).split("\n");
    const size = Number(note[1]);
    const tiles = await inOrder(Math.max(0, Math.ceil(size / 256) || 0), AT_ONCE, (t) => get(`tile/entries/${idx(t)}`));
    return { size, entries: tiles.flatMap(bundle), get };
}

/** `deep`: verify every window's proof; otherwise only the newest file's, and the chain and hashes of all. */
export async function checkPublished({ base, vk, vkSha, rules, origin, api, doFetch = fetch, deep = false, onProgress = () => {} }) {
    if (toHex(await sha256(vk)) !== vkSha) return { ok: false, why: "the verification key is not the one published" };
    const log = await readLog(base, doFetch);
    const files = log.entries.flatMap((e, index) => {
        if (e.length === 32) return [];
        const nul = e.indexOf(0), tag = new TextDecoder().decode(e.subarray(0, nul));
        return tag === "ledger/proof/v1" ? [{ index, ...JSON.parse(new TextDecoder().decode(e.subarray(nul + 1))) }] : [];
    }).sort((a, b) => a.from - b.from);
    if (!files.length) return { ok: true, proved: 0, size: log.size, files: 0, why: "no proof has been published yet" };
    let prev = null, at = 0, checked = 0;
    const reveals = {}, h = await hasher(api);
    const proofFile = ahead(files.length, AT_ONCE, (k) => log.get(`proof/${files[k].from}-${files[k].to}.json`)); // perf-13: fetched ahead, checked in order
    for (const [k, f] of files.entries()) {
        if (f.from !== at) return { ok: false, why: `a gap: the proofs stop at entry ${at}, and the next starts at ${f.from}` };
        const raw = await proofFile(k);
        if (toBase64url(await sha256(raw)) !== f.hash) return { ok: false, why: `proof/${f.from}-${f.to}.json is not the file the log names` };
        const file = JSON.parse(new TextDecoder().decode(raw));
        if (file.circuit?.vk !== vkSha) return { ok: false, why: `proof/${f.from}-${f.to}.json was made for another circuit` };
        const full = deep || k === files.length - 1;
        const r = full
            ? await verifyFile({ file, entry: async (i) => log.entries[i], vk, origin, rules, api, prev })
            : chainOnly(file, prev);
        if (!r.ok) return { ok: false, why: r.why };
        // ⭐ Every file's season reveals are checked, deep or not: they are cheap, and a person's own check rests on them.
        const rv = r.reveals ? r : await checkReveals({ file, entry: async (i) => log.entries[i], h });
        if (!rv.ok) return { ok: false, why: rv.why };
        for (const x of rv.reveals) reveals[x.season] = x;
        if (full) checked += file.windows.length;
        prev = r.last; at = f.to;
        onProgress({ file: k + 1, of: files.length, to: at });
    }
    return { ok: true, proved: at, size: log.size, files: files.length, windowsVerified: checked, deep, reveals };
}
/** The commitments join up, file to file. ⚠️ Only the proofs show each step is valid; this is the cheap part of the check. */
function chainOnly(file, prev) {
    let expect = prev;
    for (const w of file.windows) { if (expect && w.c_old !== expect) return { ok: false, why: `the window at ${w.from} does not start where the last one ended` }; expect = w.c_new; }
    return { ok: true, last: expect };
}
