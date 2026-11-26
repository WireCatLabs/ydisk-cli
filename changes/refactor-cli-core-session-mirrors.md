### Changed — may break callers

- **`session` and `mirrors` are cli-core's own commands now (cli-core 1.3.0).** ydisk mounts `tokenSessionCommand`
  and `fileMirrorsCommand` instead of its own copies, so `commands --json` gives them `origin: "cli-core"`. A token
  kept by an earlier version still signs the profile in: the keyring entry is the same, so nobody signs in again.
  Mirrors keep their `mirrors.json`, state and versions where they were.
- **`session start --json` and `session status --check --json` give the account at the top level.** The `user`
  object is gone: `item.user.id`, `item.user.login` and `item.user.name` are now `item.id`, `item.login` and
  `item.name`, as in the other WireCat CLIs that sign in with a token. `doctor --online` keeps its `user`.
- **`session list` rows have `state`** (`saved`, `missing`, or `unknown` with `signed_in: null` when the keyring
  cannot be read), beside `signed_in` and `token_from`.
- **`mirrors preview` marks a planned path under the source `plan.path`** in a scheduled agent's run, not `path`.
  It also marks the paths of uploads, downloads, merges, renames, conflicts and errors.

### Added

- **`session start` prints how to get a Yandex OAuth token** before it asks for one at a terminal, and its
  `--help` ends with the same steps.
- **A read is sent again after a retryable failure** (HTTP 5xx, 429, a dropped connection), with the profile's pace
  and at most 60 s of waiting in all, through cli-base's `retrying`. A write is sent again only after a 429, which
  refused it. Any other failure of a write is still `outcome_unknown`.
