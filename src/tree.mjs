/** A sparse Merkle tree of fixed depth, matching the circuit's root_at: a key's path is its low bits, an empty leaf is 0. */
export class SparseTree {
    constructor(h, depth) { this.h = h; this.depth = depth; this.nodes = new Map(); this.defaults = [0n]; }
    async init() { for (let i = 0; i < this.depth; i++) this.defaults.push(await this.h.hash2(this.defaults[i], this.defaults[i])); return this; }
    #get(level, idx) { return this.nodes.get(`${level}:${idx}`) ?? this.defaults[level]; }
    #idx(key) { return key & ((1n << BigInt(this.depth)) - 1n); }
    root() { return this.#get(this.depth, 0n); }
    leaf(key) { return this.#get(0, this.#idx(key)); }
    siblings(key) { const idx = this.#idx(key); return Array.from({ length: this.depth }, (_, i) => this.#get(i, (idx >> BigInt(i)) ^ 1n)); }
    async set(key, value) {
        let idx = this.#idx(key), node = value;
        this.nodes.set(`0:${idx}`, value);
        for (let i = 0; i < this.depth; i++) {
            const sib = this.#get(i, idx ^ 1n);
            node = idx & 1n ? await this.h.hash2(sib, node) : await this.h.hash2(node, sib);
            idx >>= 1n;
            this.nodes.set(`${i + 1}:${idx}`, node);
        }
    }
}
