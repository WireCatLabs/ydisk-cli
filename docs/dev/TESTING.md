# Testing

How the tests run, and what they never touch. The rules are the handbook's
[Testing page](../../node_modules/@wirecat/cli-base/docs/standards/testing.md).

- `pnpm test` runs vitest. `@wirecat/cli-base/testing/setup` gives each test file its own temporary home folder, a
  keyring that throws and no network, and points this CLI's config, state, cache and the shared store into that
  folder. `src/testing/sandbox.ts` names the config folder, which tests write into by name.
- `pnpm test:coverage` adds the coverage floor in `vitest.config.ts`.
- A script that starts the built bin runs it through `scripts/sandboxed.ts`, as `lint:commands` and the smoke tests
  do: a temporary home folder, its `XDG_*` folders, no `YDISK_*` overrides and the keyring out of reach. A run
  that sees your home can move your real folders.
- `pnpm test:slow` lists the 20 slowest tests and the 10 slowest files. No test waits for real time (`WC-TEST-5`):
  waits go through an injected sleep, and `fakeClock()` from `@wirecat/cli-base/testing` records them.
- Every test has 15 s (`testTimeout` in `vitest.config.ts`), and a test that builds big data runs within 3 s on your
  machine, since a slow CI runner takes up to five times as long (`WC-TEST-20`). Shrink the data; never raise one
  test's timeout. From cli-base 0.107.0, `pnpm test:slow` warns about each test over 3 s.
- Each run logs the command lines the tests drove (`coverage/argv.jsonl`). `pnpm test:matrix` turns that log into
  [test-matrix.md](test-matrix.md); a command or option no test drives needs a reason in
  `scripts/test-matrix-untested.ts`.
- `pnpm contracts:check` runs the built CLI against `contracts/plan.json`: help, discovery, errors and the MCP tool
  list. `pnpm exec cli-contract contracts/plan.json --update` rewrites the snapshots; review the diff.
- `src/mcp.test.ts` pins `contracts/mcp-catalogue.json`: this CLI's own commands an agent can find over MCP, each a
  read or a write, from cli-core's `ownCatalogue`. What cli-core mounts is left out, since cli-core pins it, so a
  cli-core release does not rewrite the file. Pin a shared command here only when this CLI changes it on purpose.
- `pnpm contracts:upgrade` checks that this build reads what the previous release wrote
  ([WC-TEST-14](../../node_modules/@wirecat/cli-base/docs/standards/testing.md)). `contracts/previous/` installs that
  release from npm (`@wirecat/previous-cli`, now `@wirecat/yandex-disk-cli@0.6.0`). `contracts/seed.mjs` loads its own
  modules and its own cli-core, signs nobody in, and saves one synced file and a note into the synthetic store, as
  `ydisk <profile> sync` would, with the profile's folder choice and sync state. `contracts/upgrade.json` then lists
  the documents, reads one, the status, search and notes with that release and with this build. After a release, move
  the baseline: the version in `contracts/previous/package.json` and in `upgrade.json`'s `previous.version`, then
  `pnpm --dir contracts/previous install`. A cli-core bump that migrates the store makes this build print one line on
  stderr the first time it opens the old store; the cases allow exactly that line as `diagnosticPattern`.
- `pnpm smoke` installs the packed package into a temporary folder and runs it offline.
- `pnpm audit:commands` audits the command tree beside the latest published WireCat CLIs.

## The bundle a user installs

`pnpm build` compiles `src/` with `tsc`, then cli-base's `cli-dev bundle`
([WC-LAY-10](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/layout.md))
bundles `dist/bin/ydisk.js` into `dist/bundle/` and makes the bin a loader. The vitest suite runs
against `src/`, so `scripts/smoke-bundle.ts` is the proof the bundle works: `pnpm smoke:node` runs it
under Node and `pnpm smoke:bun` under Bun, both in CI.
