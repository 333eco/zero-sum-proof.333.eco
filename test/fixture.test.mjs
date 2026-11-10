// A real published proof, from the ledger's test tree (2026-11-09): entries 0–63, four windows. Checked offline; then tampered with.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { run } from "../check.mjs";

const files = new Map();
const serve = (over = {}) => async (url) => {
    const p = url.replace("https://fixture/", "");
    if (over[p]) return { ok: true, arrayBuffer: async () => over[p] };
    try { return { ok: true, arrayBuffer: async () => readFileSync(new URL(`../fixtures/test-tree/${p}`, import.meta.url)) }; } catch { return { ok: false, status: 404 }; }
};
const check = (o = {}) => run({ base: "https://fixture", origin: "log.333.eco/ledger-test2", deep: true, doFetch: serve(o.over), ...o });

test("a real published proof checks out, every window", async () => {
    const r = await check();
    assert.equal(r.ok, true, r.why);
    assert.equal(r.proved, 64);
    assert.equal(r.windowsVerified, 4);
});
test("checked against another log's name, it fails", async () => { assert.equal((await check({ origin: "log.333.eco/ledger" })).ok, false); });
test("with a changed rule, it fails", async () => { assert.equal((await check({ rules: { 0: { kiitos: 2, kiitti: 1 }, 1: { kiitos: 1, kiitti: 1 } } })).ok, false); });
test("a file that is not the one the log names fails", async () => {
    const f = JSON.parse(readFileSync(new URL("../fixtures/test-tree/proof/0-64.json", import.meta.url), "utf8"));
    f.windows[2].c_old = "0x1";
    const r = await check({ over: { "proof/0-64.json": Buffer.from(JSON.stringify(f)) } });
    assert.equal(r.ok, false); assert.match(r.why, /not the file the log names/);
});
