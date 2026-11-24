### Fixed

- **A scheduled agent reads other people's Disk names, paths and text marked.** In a run locked read-only with a mark
  (`YDISK_READ_ONLY=1` and `YDISK_UNTRUSTED_MARK`), `files list`, `files show` and `files download` mark each name,
  path and read text, `mirrors preview` each planned path and rename target, and the `api` group's operations the
  names and paths in the raw answer. A shared folder's files are named and written by whoever shares it. cli-core's
  shared commands (`documents`, `search`, `folders list|browse`, `catalog`, `files sheets|documents show`, `mirrors
  conflicts show`) already marked theirs. Outside such a run no answer changes. A marked path is passed back to a
  `files` command without the markers. Not marked yet: `mirrors conflicts list` (cli-core's), and `files serve`,
  which shows the Disk as a folder rather than an answer.
- Requires `@wirecat/cli-core` 0.739.0 and `@wirecat/cli-base` 0.132.0.
