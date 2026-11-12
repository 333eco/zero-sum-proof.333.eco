# The zero-sum proof

Check the HeartBank® gratitude ledger yourself, from its public log alone.

Every thank on the ledger moves the same amount up for one side and down for the
other, so each sea of Kiitos and Kiitti adds up to zero. This repo holds what you
need to check that claim without trusting whoever runs the ledger: the circuit,
its verification key, and the checker. The same checker runs in your browser at
[earth.333.eco/proof](https://earth.333.eco/proof).

```sh
npm ci
node check.mjs           # the newest file's proofs, and the hashes and chain of all
node check.mjs --deep    # every proof
npm test                 # offline: a real published proof from the test tree, then tampered copies
```

The check fetches only from the public log (`log.333.eco/ledger`). The two points
of public setup it needs are built in (`src/crs.mjs`), so it never contacts a third
party and never tells anyone you are checking.

## What a passing check shows

For every log entry the proofs cover, starting at the log's first entry:

- Every counted thank carries a passkey signature, with the person present and
  verified, over that exact thank.
- Each one moves exactly its season's rule from one account to another. A
  passkey's own account moves only with that passkey's signature; a person's
  receiving account is only ever credited.
- No thank is counted twice, at any position, in any season.
- The chain of commitments starts from empty accounts, so every balance in each
  ledger and season adds up to zero.

The public learns no thank, pair, person, place, balance or amount from the proof,
and no count beyond the size of the log, which is padded.

## Check your own thanks, after a season closes

```sh
node check-mine.mjs heartbank-record.json
```

Download your record from your page at earth.333.eco, then run this. For each
closed season your signed thanks are in, it checks that every one of them was
counted, and that nothing else moved the accounts your thanks moved. It names any
of your thanks that did not check out, never a balance, a total or a count. Your
file is read on your computer and sent nowhere. The same check runs in your
browser at [earth.333.eco/proof](https://earth.333.eco/proof).

How it works: when a season closes, its `jubilee` entry is the last of that
season's entries in the log. The proof file covering it reveals the two tree roots
and their blinding, which must open the very commitment that window ends with. Your
record carries, for each of your thanks, your own account's salt and path and the
thank's spent path. The check recomputes each of your balances from your own thanks
and finds them, and each thank's mark, in the revealed trees.

It checks every account your own thanks moved. A thank missing from your record
could only have credited you: an account opened by a passkey moves only with that
passkey, and a person's receiving account is only ever credited.

## What it cannot show

- A passkey shows that someone holds a key, not that they are one human. Whoever
  runs the ledger could make accounts with keys of its own.
- Two people can still thank each other for show.
- A thank left out of the proof looks like padding. The person whose thank it is
  can find that out when the season ends.
- It does not check the log's own signature: run the ledger's tree check, or
  [explorer.333.eco/ledger](https://explorer.333.eco/ledger), for that.

## What is published, and where

- Each proof file: `log.333.eco/ledger/proof/<from>-<to>.json`, holding windows of
  16 log entries, each with its commitments before and after and its proof.
- Each file's SHA-256, in the log itself, as a public entry
  `{"t":"proof","v":1,"from":…,"to":…,"hash":…}`.
- The first file carries the blinding of the empty starting point, so anyone can
  recompute where the chain begins.

`rules.json` holds each log's season rules. The proof binds the units of all 8 seasons, a season the log does not have counting as zero, so checking with the wrong log's rules fails every proof.

A proof's public inputs, in order: the commitment before, the commitment after,
the SHA-256 of the log's name (32 bytes), each of 8 seasons' units for Kiitos and
Kiitti, and the 16 log entries it covers (32 bytes each; a public entry, which is
longer, counts as zeros).

## Rebuilding the key

```sh
npm run rebuild    # python3 circuit/gen.py 16, compile, then write circuit/vk.bin
```

The result must match `circuit/vk.sha256`. The proofs are made with
`@aztec/bb.js` 5.3.0 (UltraHonk, its zero-knowledge form) and Noir 1.0.0, both
pinned. The circuit is generated from `circuit/main.nr.tmpl` by `circuit/gen.py`,
which computes its tables rather than typing them.

The files under `circuit/`, `src/` and `scripts/` are kept byte-for-byte identical
to the code that makes the proofs; a check there fails if they drift.

## License

Your choice of CC0 1.0 (no rights reserved) or Apache 2.0: see `LICENSE`.
