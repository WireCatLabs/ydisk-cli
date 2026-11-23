# Changelog

Notable changes to `@wirecat/yandex-disk-cli`. One section per version, newest first.

## 0.5.0 — 24.11.2026

## 0.4.0 — 19.11.2026

### Added

- **Mirror the whole Disk.** `mirrors add / ~/YandexDisk` keeps the whole Disk in a folder of its own, read with
  Yandex's flat file list, up to 100,000 files. See [the whole Disk](docs/mirrors.md#the-whole-disk).
- **Leave folders out of a mirror.** `mirrors add --ignore <path>` (repeated, a path or a glob) and
  `mirrors update <id> --ignore <path>…` adds to the list, and `--clear` empties it first. An ignored path is never deleted on either side: ignoring one
  trashes nothing, and one no longer ignored syncs as a new folder. See [leave folders out](docs/mirrors.md#leave-folders-out).
- **A sync checks free space first.** It stops with `mirror.no-space` when its downloads and the versions it keeps
  would leave too little free: a tenth of what it writes, at least 100 MB and at most 1 GB.
- **`ydisk <profile> files serve [path]` shows a Disk folder, or the whole Disk, as a read-only folder on this
  computer.** It serves the folder over WebDAV on 127.0.0.1 behind a random address made for each run, and the
  system's own client mounts it: `gio mount` on Linux, Finder on macOS, `net use` on Windows. Nothing can write,
  rename or delete on the Disk through it. It runs until Ctrl-C, is never offered to agents over MCP, and is refused
  where `files.download` is denied ([mount](docs/mount.md)).

### Changed — may break callers

- **Many changes at once always wait for your approval.** A sync stops before more than 10 deletions or more than 50
  replacements of existing files, however big the mirror (40 deletions out of 1,000 files used to pass). The error
  names the counts and the exact command; `--replace` joins `--allow-deletions`, both for you only, never
  for an agent over MCP, and both need the mirror's id when you have more than one. A stopped mirror no longer holds
  up the others, and `mirrors watch` reports the stop at every cycle that syncs the mirror. See
  [many changes at once](docs/mirrors.md#many-changes-at-once).
- **A deletion on a busy Disk is still proven.** A file missing from the listing is deleted here only once the Disk,
  asked for it by its path after the listing, has nothing there. The listing is no longer read up to three times
  while the Disk changes, so a phone uploading photos no longer blocks every deletion.
- **The home folder is never mirrored**, even when the CLI's own folders are moved out of it.
- Requires `@wirecat/cli-core` 0.711.0.

### Fixed

- `mirrors add` refuses a drive root on Windows, such as `D:\`, even on a drive that holds no home folder.
- `mirrors sync` no longer fails after 30 seconds on a big Disk. It may run 15 minutes in a terminal and 45 seconds
  for an agent, stops before that on its own, keeps what it did and answers partial: each mirror says how many Disk
  files it listed and whether the listing was complete, and `next` names the run that goes on. A listing cut short
  deletes nothing: the Disk files it did not reach are counted in `unlisted`.
- `mirrors preview` may list for 5 minutes in a terminal and 45 seconds for an agent, and fails with `timeout` and
  the cut plan when the listing does not fit.
- A page of the whole-Disk listing may take 2 minutes instead of 30 seconds.

## 0.3.0 — 19.11.2026

### Added

- **Mirrors: a local folder and a Disk folder kept the same, both ways.** `mirrors add <disk folder> <local folder>`,
  then `mirrors sync`, or `mirrors watch` to keep syncing. A change on one side is copied to the other; a file
  changed on both sides is reported and settled with `--keep local|disk|both`. A deletion goes to the other side's
  trash, the Disk's or `.wirecat-trash/` in the folder, and only when the sync can prove it: a file missing from an
  incomplete listing, or from a folder that was replaced, is never deleted. `mirrors preview` shows the plan, and a run that
  would delete many files waits for `--allow-deletions`. See [mirrors](docs/mirrors.md).
- `mirrors versions list|restore`: the version a sync replaced or deleted, on your computer or on the Disk, is kept for
  30 days and can be put back.

### Fixed

- `folders list` names each chosen folder and gives its Disk path, not only its id.
- `api public-settings-update` no longer reports a write it could not confirm when the Disk answers with no body.
- The token steps suggest an app name like `My laptop`.

## 0.2.0 — 18.11.2026

### Added

- `ydisk store info` shows the shared store's file, size, format and row counts, so WireCat Desktop can say whether
  Yandex Disk reads it.
- `ydisk <profile> account remove --keep-data|--delete-data` signs the profile out and forgets it on this computer. It
  keeps or deletes the chosen folders and the synced files.
- `folders browse` gives each folder a `kind` and a `has_children`. Yandex gives no child count, so it looks inside each
  folder, one request each, when the level has 20 folders or fewer; with more, `has_children` is `null`.

### Fixed

- Published from GitHub Actions with npm provenance, so WireCat Desktop installs it: Desktop refuses a built-in tool's
  release that its own repository's workflow did not build, and 0.1.0 was published from a computer.
- **The guides cover what the tool does, step by step.** New pages: [find a document](docs/search.md) (words,
  word forms, meaning, file names), [connect your agent](docs/mcp.md) (the skill, `mcp add`, `mcp config`, browser
  apps and what an agent may change), [recipes](docs/recipes.md) and [compared with other tools](docs/compare.md).
  [Install and sign in](docs/installation.md) walks through getting the Yandex token with Yandex's own labels,
  [troubleshooting](docs/troubleshooting.md) is by symptom with the exit codes, and [security](docs/security.md)
  says what stays on your computer and how to remove it. The token steps now name the app type "For API access or
  debugging", as Yandex's pages do.
- The help and the error of `--cursor` in `folders browse` and `files list` name `page.next_cursor`, the key the answer
  has, not `page.next`.

## 0.1.0 — 17.11.2026

### Added

- Started from `@wirecat/cli-template` 0.25.0.
- **Sign in with a Yandex OAuth token** pasted once: `session start` reads it hidden or from stdin, checks it with
  `GET /v1/disk` and keeps it in the system keyring; `session status --check` and `doctor --online` say whose it is.
- **Chosen Disk folders as searchable text**: `folders add <path>`, `sync`, `status`, `documents list|show|export`,
  `search`, `catalog`, tags, notes and memories, cli-core's shared documents commands. Each sync walks the chosen
  folders again (the Disk API has no change feed) and reads only files whose MD5 changed; a moved file keeps its id,
  tags and notes. Text from PDF, docx, xlsx, CSV, TSV, text and Markdown. Times are kept and answered in UTC.
- **The files live**: `files list|show|download|upload|copy|move|create|delete|restore|publish|unpublish`, by Disk
  path. `files delete` moves to the trash. `--replace` and `files delete` ask as `files.delete` does, `files publish`
  as `files.share` does, and `--dry-run` shows each key the write checks. `files publish` answers the public link, or
  leaves `public_url` out when it cannot read it back. Downloads and uploads go to the address Yandex gives, without
  the token.
- **`api`**: one command per operation of Yandex's Swagger 1.2 description, 20 in all. The three that answer a
  download or upload link are left out, and a resource's `file`, `preview` and `sizes` links are taken out of every
  answer. `--all` pages where the API pages. A permanent delete, `overwrite=true` and a public link ask by
  `files.delete` and `files.share`. An operation that does what a `files` command does also checks that command's
  key: `files.move: deny` stops `api resources-move` too, in the run and in `--dry-run`.
