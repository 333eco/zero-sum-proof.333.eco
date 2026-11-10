/**
 * The season-close check (design/signed-proof.md, C5): a person checks, from their own record alone and the public log, that every
 * signed thank of theirs in a closed season was counted, and that nothing else moved their accounts. Runs the same in Node and in a
 * browser. ⭐ It recomputes each balance from the person's OWN rows, so a row left out, or one they never made, shows as a mismatch.
 * ⛔ It reports which of their own thanks failed, never a balance, a total or a count: what it says is pass or which receipt.
 */
import { fromBase64, mod, pack } from "./hash.mjs";
import { emptyHashes, rootFrom } from "./tree.mjs";

const LEDGER = { kiitos: 1, kiitti: 2 };
const other = (role) => (role === "from" ? "to" : "from");

/**
 * `entries`: the person's export (each with `row`, `index`, `role`, and for a signed row their own `press` or `other` opening, and
 * after the season's close its `reveal`). `reveals`: season -> { acctRoot, spentRoot } as the public log proves them (checkPublished).
 * Returns { seasons: { [n]: { ok, problems: [{ index, code, why }] } } } for every closed season the record has signed rows in.
 */
export async function checkMine({ h, entries, reveals }) {
    const empty64 = await emptyHashes(h, 64), empty128 = await emptyHashes(h, 128);
    const bySeason = new Map();
    for (const e of entries) {
        if (!e.press && !e.other) continue; // an unsigned row (the test tree's season 0): the proof never counted it
        const s = e.row.season;
        if (!reveals[s]) continue; // a season not yet closed and revealed
        (bySeason.get(s) ?? bySeason.set(s, []).get(s)).push(e);
    }
    const out = {};
    for (const [s, list] of bySeason) {
        const { acctRoot, spentRoot } = reveals[s], problems = [], accounts = new Map();
        for (const e of list) {
            if (!e.reveal) { problems.push({ index: e.index, code: "nopath", why: "your record has no path for this thank" }); continue; }
            const row = e.row, u = BigInt(row.units), ledger = BigInt(LEDGER[row.ledger]), season = BigInt(s);
            const signerRole = e.press ? e.role : other(e.role), signerDelta = signerRole === "from" ? -u : u;
            let key, delta;
            if (e.press) {
                const x = fromBase64(e.press.x), y = fromBase64(e.press.y);
                key = await h.acctKey(1n, season, ledger, pack(x, 0, 16), pack(x, 16, 16), pack(y, 0, 16), pack(y, 16, 16));
                delta = signerDelta;
            } else {
                const id = fromBase64(e.other.id);
                key = await h.acctKey(BigInt(e.other.type + 1), season, ledger, pack(id, 0, 16), pack(id, 16, 16), 0n, 0n);
                delta = -signerDelta;
            }
            const a = accounts.get(key) ?? { bal: 0n, salt: e.reveal.acct.salt, path: e.reveal.acct.path, indexes: [] };
            if (a.salt !== e.reveal.acct.salt) problems.push({ index: e.index, code: "salt", why: "this thank's account does not match your other thanks in it" });
            a.bal += delta; a.indexes.push(e.index); accounts.set(key, a);
            // counted: the row's nullifier is marked spent in the revealed tree
            const salt = new TextEncoder().encode(row.salt), nk = await h.perm(pack(salt, 0, 21), pack(salt, 21, 22), 0n, 8n);
            if ((await rootFrom(h, 128, empty128, nk, await h.spentLeaf(nk), e.reveal.spent.path)) !== BigInt(spentRoot)) problems.push({ index: e.index, code: "uncounted", why: "this thank was not counted" });
        }
        // nothing else moved them: each account's leaf, with the balance THEIR OWN rows add up to, is in the revealed tree
        for (const [key, a] of accounts) {
            const leaf = await h.acctLeaf(key, mod(a.bal), BigInt(a.salt));
            if ((await rootFrom(h, 64, empty64, key, leaf, a.path)) !== BigInt(acctRoot)) for (const index of a.indexes) problems.push({ index, code: "mismatch", why: "the account this thank moved does not match your own thanks in it" });
        }
        out[s] = { ok: problems.length === 0, problems };
    }
    return { seasons: out };
}
