// Writes src/crs.mjs: the one G1 point and the G2 point of the public Aztec Ignition setup that verifying an UltraHonk proof needs.
// They are fixed public values: anyone can compare them with the ceremony's own files (crs.aztec-cdn.foundation, g1/g2 .dat).
import { Crs } from "@aztec/bb.js";
import { writeFileSync } from "node:fs";
const crs = await Crs.new(1);
const hex = (b) => Buffer.from(b).toString("hex");
writeFileSync(new URL("../src/crs.mjs", import.meta.url), `/**
 * The public setup a verifier needs (Aztec Ignition, the ceremony behind UltraHonk on BN254): the first G1 point and the G2 point.
 * ⭐ Built in, so a check never fetches it from anyone and never tells a third party who is checking. Written by scripts/crs.mjs.
 */
const b = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
export const CRS_G1 = b("${hex(crs.getG1Data().subarray(0, 64))}");
export const CRS_G2 = b("${hex(crs.getG2Data())}");
`);
console.log("src/crs.mjs written");
