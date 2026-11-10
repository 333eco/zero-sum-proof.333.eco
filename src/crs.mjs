/**
 * The public setup a verifier needs (Aztec Ignition, the ceremony behind UltraHonk on BN254): the first G1 point and the G2 point.
 * ⭐ Built in, so a check never fetches it from anyone and never tells a third party who is checking. Written by scripts/crs.mjs.
 */
const b = (h) => Uint8Array.from(h.match(/../g), (x) => parseInt(x, 16));
export const CRS_G1 = b("00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002");
export const CRS_G2 = b("0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c122febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e5504fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4");
