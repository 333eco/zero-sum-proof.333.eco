// Compiles circuit/ (or the directory given) with the pinned Noir compiler, writing target/zero_sum.json.
import { compile_program, createFileManager } from "@noir-lang/noir_wasm";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "circuit");
const t = Date.now();
try {
    const out = await compile_program(createFileManager(dir));
    mkdirSync(`${dir}/target`, { recursive: true });
    writeFileSync(`${dir}/target/zero_sum.json`, JSON.stringify(out.program));
    console.log("compiled in", Date.now() - t, "ms");
} catch (e) { console.error(e?.message ?? e, JSON.stringify(e?.diagnostics ?? "").slice(0, 3000)); process.exit(1); }
