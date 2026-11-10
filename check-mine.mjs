#!/usr/bin/env node
// Your own season-close check, from the record you downloaded from your page and the public log alone:
//   node check-mine.mjs heartbank-record.json [--base https://log.333.eco/ledger] [--origin log.333.eco/ledger]
// For each closed season your signed thanks are in: every one of them was counted, and nothing else moved the accounts they moved.
// ⛔ It names which of your thanks failed, never a balance, a total or a count. Your file is read here and sent nowhere.
import { readFileSync } from "node:fs";
import { Barretenberg, BackendType } from "@aztec/bb.js";
import { checkPublished } from "./src/published.mjs";
import { checkMine } from "./src/mine.mjs";
import { hasher, sha256 } from "./src/hash.mjs";
import { CRS_G1, CRS_G2 } from "./src/crs.mjs";
import { rulesFor } from "./check.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2];
if (!file || file.startsWith("--")) { console.log("usage: node check-mine.mjs heartbank-record.json"); process.exit(2); }
let record = null;
try { record = JSON.parse(readFileSync(file, "utf8")); } catch { /* not JSON */ }
if (record?.v !== 1 || !Array.isArray(record.entries)) { console.log("✗ this file is not a record from your page"); process.exit(1); }
const base = arg("--base", "https://log.333.eco/ledger"), originName = arg("--origin", "log.333.eco/ledger");
const api = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, skipSrsInit: true });
await api.srsInitSrs({ pointsBuf: CRS_G1, numPoints: 1, g2Point: CRS_G2 }); // built in: nothing fetched from anyone
try {
    const vk = readFileSync(new URL("circuit/vk.bin", import.meta.url)), vkSha = readFileSync(new URL("circuit/vk.sha256", import.meta.url), "utf8").trim();
    const pub = await checkPublished({ base, vk, vkSha, rules: rulesFor(originName), origin: await sha256(new TextEncoder().encode(originName)), api });
    if (!pub.ok) { console.log(`✗ the public log does not check out: ${pub.why}`); process.exit(1); }
    const r = await checkMine({ h: await hasher(api), entries: record.entries, reveals: pub.reveals ?? {} });
    const seasons = Object.keys(r.seasons).sort((a, b) => a - b);
    if (!seasons.length) { console.log("nothing to check yet: a season can be checked the day after it closes"); process.exit(0); }
    let bad = false;
    for (const s of seasons) {
        const x = r.seasons[s];
        if (x.ok) console.log(`✓ season ${s}: every thank of yours was counted, and nothing else moved the accounts your thanks moved`);
        else { bad = true; console.log(`✗ season ${s}: these thanks of yours did not check out:`); for (const p of x.problems) console.log(`  log entry ${p.index}: ${p.why}`); }
    }
    process.exit(bad ? 1 : 0);
} finally { await api.destroy(); }
