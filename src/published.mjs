/**
 * Checks everything the zero-sum proof has published, from the public log alone (log.333.eco/ledger): its checkpoint, its entries, the
 * `proof` entries among them, each file against the hash its entry holds, and the chain of proofs from the first entry of the log.
 * Runs in Node and in a browser. ⭐ It reports what it checked, and how far; never more.
 */
import { sha256, toBase64url, toHex } from "./hash.mjs";
import { verifyFile } from "./verify.mjs";

const bundle = (b) => { const out = []; for (let i = 0; i < b.length;) { const n = (b[i] << 8) | b[i + 1]; out.push(b.subarray(i + 2, i + 2 + n)); i += 2 + n; } return out; };
const idx = (n) => { const s = String(n).padStart(3, "0"); return n < 1000 ? s : `x${s}`; };

export async function readLog(base, doFetch = fetch) {
    const get = async (p) => { const r = await doFetch(`${base}/${p}`); if (!r.ok) throw new Error(`${p}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };
    const note = new TextDecoder().decode(await get("checkpoint")).split("\n");
    const size = Number(note[1]);
    const entries = [];
    for (let t = 0; t < size / 256; t++) entries.push(...bundle(await get(`tile/entries/${idx(t)}`)));
    return { size, entries, get };
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
    for (const [k, f] of files.entries()) {
        if (f.from !== at) return { ok: false, why: `a gap: the proofs stop at entry ${at}, and the next starts at ${f.from}` };
        const raw = await log.get(`proof/${f.from}-${f.to}.json`);
        if (toBase64url(await sha256(raw)) !== f.hash) return { ok: false, why: `proof/${f.from}-${f.to}.json is not the file the log names` };
        const file = JSON.parse(new TextDecoder().decode(raw));
        if (file.circuit?.vk !== vkSha) return { ok: false, why: `proof/${f.from}-${f.to}.json was made for another circuit` };
        const full = deep || k === files.length - 1;
        const r = full
            ? await verifyFile({ file, entry: async (i) => log.entries[i], vk, origin, rules, api, prev })
            : chainOnly(file, prev);
        if (!r.ok) return { ok: false, why: r.why };
        if (full) checked += file.windows.length;
        prev = r.last; at = f.to;
        onProgress({ file: k + 1, of: files.length, to: at });
    }
    return { ok: true, proved: at, size: log.size, files: files.length, windowsVerified: checked, deep };
}
/** The commitments join up, file to file. ⚠️ Only the proofs show each step is valid; this is the cheap part of the check. */
function chainOnly(file, prev) {
    let expect = prev;
    for (const w of file.windows) { if (expect && w.c_old !== expect) return { ok: false, why: `the window at ${w.from} does not start where the last one ended` }; expect = w.c_new; }
    return { ok: true, last: expect };
}
