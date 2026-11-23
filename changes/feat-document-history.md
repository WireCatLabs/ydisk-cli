### Added

- **Earlier versions of every synced file, and a change log** (cli-core 0.722.0, was 0.711.0; cli-base 0.128.0, was
  0.122.0). Sync keeps a document's text, title and front matter before each change and before it leaves the copy.
  `documents history <document>` lists the versions and `--revision <n>` shows one. `changes --since 1d` lists what
  was added, changed, no longer visible or came back. Both read the copy, so agents get them over MCP too
  ([usage](../docs/usage.md#earlier-versions-and-what-changed)).
- **`keep_versions_for_days`, 365 by default**, for a profile or `defaults`. A sync that finishes its pass drops older
  versions and change log rows ([configuration](../docs/configuration.md#other-settings)).

### Fixed

- **A file sync no longer finds keeps its text.** It leaves lists and search, is marked no longer visible, and comes
  back as it was when the Disk shows it again. Before, sync blanked its text as if it were deleted, though the Disk
  cannot tell sync a deletion from a move or a lost share.
