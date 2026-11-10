#!/usr/bin/env node
// Checks the zero-sum proof from the public log alone.   node check.mjs [--deep] [--base https://log.333.eco/ledger] [--origin log.333.eco/ledger]
// --deep verifies every proof; without it, the newest file's proofs, and the hashes and chain of all. Nothing here trusts the operator.
import { readFileSync } from "node:fs";
import { Barretenberg, BackendType } from "@aztec/bb.js";
import { checkPublished } from "./src/published.mjs";
import { sha256 } from "./src/hash.mjs";
import { CRS_G1, CRS_G2 } from "./src/crs.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
export async function run({ base, origin, deep, doFetch = fetch, rules = JSON.parse(readFileSync(new URL("rules.json", import.meta.url), "utf8")).seasons }) {
    const vk = readFileSync(new URL("circuit/vk.bin", import.meta.url)), vkSha = readFileSync(new URL("circuit/vk.sha256", import.meta.url), "utf8").trim();
    const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
    await api.srsInitSrs({ pointsBuf: CRS_G1, numPoints: 1, g2Point: CRS_G2 }); // built in: nothing fetched from anyone
    try { return await checkPublished({ base, vk, vkSha, rules, origin: await sha256(new TextEncoder().encode(origin)), api, doFetch, deep }); }
    finally { await api.destroy(); }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const r = await run({ base: arg("--base", "https://log.333.eco/ledger"), origin: arg("--origin", "log.333.eco/ledger"), deep: process.argv.includes("--deep") });
    if (!r.ok) { console.log(`✗ ${r.why}`); process.exit(1); }
    if (!r.files) { console.log(`no proof has been published yet (the log has ${r.size} entries)`); process.exit(0); }
    console.log(`✓ checked: log entries 0–${r.proved - 1} of ${r.size}, ${r.files} file(s), ${r.windowsVerified} proof(s) verified${r.deep ? " (every one)" : " (the newest file's; --deep for all)"}`);
}
