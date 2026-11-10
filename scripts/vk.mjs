// Writes circuit/vk.bin and circuit/vk.sha256 from the compiled circuit (run scripts/compile.mjs first). ⭐ The prover refuses to run if the
// key it derives differs from the committed one, so a proof is never published that the published key cannot check.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
const program = JSON.parse(readFileSync(new URL("../circuit/target/zero_sum.json", import.meta.url), "utf8"));
const api = await Barretenberg.new({ threads: 8 });
const vk = await new UltraHonkBackend(program.bytecode, api).getVerificationKey({ verifierTarget: "noir-recursive" });
const sha = createHash("sha256").update(vk).digest("hex");
writeFileSync(new URL("../circuit/vk.bin", import.meta.url), vk);
writeFileSync(new URL("../circuit/vk.sha256", import.meta.url), `${sha}\n`);
console.log(`vk ${vk.length} bytes, sha256 ${sha}, bytecode sha256 ${createHash("sha256").update(Buffer.from(program.bytecode, "base64")).digest("hex")}`);
await api.destroy();
