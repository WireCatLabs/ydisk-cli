# Changelog

Notable changes to `@wirecat/yandex-disk-cli`. One section per version, newest first.

## 0.8.0 — 24.11.2026

### Added

- **A sync reads the text of scans and pictures** (cli-core 0.740.0, was 0.739.0). A PDF with no text layer and a
  JPEG, PNG or WebP picture are read by OCR, chosen by the profile's `read_scans`: `local` by default (the
  `tesseract` program on your computer, Russian and English, nothing downloaded), `anthropic` or `openai` (the
  `ai set` model at that provider's own address, with pictures allowed, each page sent to it and paid per page), or
  `off`. At most 20 pages a file and 100 a sync. A scan an older ydisk kept by name is read on the next sync, and a
  sync with no `tesseract` says how to install it ([scans and pictures](docs/usage.md#scans-and-pictures)).

## 0.7.0 — 24.11.2026

### Added

- **More formats are read** (cli-core 0.739.0, was 0.737.0): Word 97–2003 `.doc`, PowerPoint `.pptx`, OpenDocument
  `.odt`, `.ods` and `.odp`, RTF, HTML and EPUB, beside PDF, `.docx`, `.xlsx`, CSV, TSV, plain text and Markdown. A
  file an earlier version kept by name only is read on the next sync ([usage](docs/usage.md#what-the-copy-holds)).
- **A sync lists four Disk folders at once**, so a sync of many folders takes less time. It stays within the 120
  requests a minute ydisk sends to Yandex.
- **`files sheets create` makes several sheets, formulas and bold cells.** `--values` also takes
  `[{"name": "Budget", "header": true, "rows": [...]}]`, and a cell may be `{"formula": "SUM(B2:B3)"}` or
  `{"value": "Total", "bold": true}`. A text that starts with `=` stays text. Rows as before keep working
  ([commands](docs/commands.md)).
- **`files documents create` makes bold and italic text and tables.** `--payload` also takes
  `{"text", "bold", "italic"}`, `{"runs": [...]}` and `{"table": [["Item", "Cost"], ["Rent", "950"]], "header": true}`.
  `[{"text", "style"}]` keeps working ([commands](docs/commands.md)).

### Changed — may break callers

- **A file without a public link is replaced under the Disk's own check.** `files update`, `files sheets update`,
  `files documents update`, `files restore <path> <version>` and a mirror's push of a changed file send the new content
  to a hidden file next to it, move the old file to the Disk's trash at the content that was read (the Disk refuses
  with 409 when the file changed since), and give the hidden file its name. Before, the file was read just before the
  upload, and a change in that moment was overwritten. The file now gets a new `resource_id`, and the Disk's own
  version history of it starts over; the old content is in the Disk's trash, which Yandex's help says takes up space
  for 30 days. Its synced copy moves to the new id, so its tags, the notes about it and its links follow it; when the
  local store cannot be reached the write still happens, with a warning. A file with a public link is still
  overwritten in place after the read, so its link stays ([usage](docs/usage.md#edit-a-file-on-the-disk), [mirrors](docs/mirrors.md#how-a-file-on-the-disk-is-replaced)).

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

## 0.6.0 — 24.11.2026

### Added

- **New Excel and Word files** (cli-core 0.737.0, was 0.724.0). `files sheets create <path> --values <json rows>`
  makes a new `.xlsx`, and `files documents create <path> --payload <json paragraphs>` a new `.docx`. Each writes a new
  file only, refuses a path that is already there (`office.file-exists`), and answers the `sha256` that `update` takes
  next ([usage](docs/usage.md#edit-a-file-on-the-disk)).

### Fixed

- **`mirrors conflicts resolve` runs inside the command's run.** `--timeout` now bounds it, `--record` keeps a run for
  it, and its Disk requests are in that run. Before, it reached the Disk outside any run.
- **Synced and edited files keep their earlier versions for `keep_versions_for_days`.** The mirrors' version stores,
  and the one `files update`, `history` and `restore` use, dropped versions after 30 days, whatever the setting said.
  They now keep them for the profile's `keep_versions_for_days`, one year by default, as
  [configuration](docs/configuration.md#other-settings) says.
- **An Office edit that is refused says why.** A formula cell, a wrong format or a missing sheet now answers its own
  reason, such as `office.formula-cell`, in place of `input.invalid`.
- **The docs say where to revoke the Yandex token.** `session end` removes the token from this computer only, and it
  stays valid at Yandex. [Security](docs/security.md#revoke-the-token-at-yandex), the
  [installation guide](docs/installation.md) and [troubleshooting](docs/troubleshooting.md) now name Yandex ID's
  [Data access](https://id.yandex.ru/personal/data-access) page, where you remove the app to revoke it.
- **`changes --since <time>` and `--until <time>` in help** (cli-core 0.724.0, was 0.722.0, and cli-base 0.130.0, was
  0.128.0). `--until` said `<when>`. The flags take the same values as before. The vocabulary now knows `changes`,
  `--since` and `--event`, so the command lint needs no exceptions for them.
- **`session end` says where to revoke the token.** Its help said the token stays valid at Yandex but not where to
  revoke it. It now names Yandex ID's [Data access](https://id.yandex.ru/personal/data-access) page, where you remove
  the app the token was issued for.

## 0.5.0 — 23.11.2026

### Added

- **Earlier versions of every synced file, and a change log** (cli-core 0.722.0, was 0.711.0; cli-base 0.128.0, was
  0.122.0). Sync keeps a document's text, title and front matter before each change and before it leaves the copy.
  `documents history <document>` lists the versions and `--revision <n>` shows one. `changes --since 1d` lists what
  was added, changed, no longer visible or came back. Both read the copy, so agents get them over MCP too
  ([usage](docs/usage.md#earlier-versions-and-what-changed)).
- **`keep_versions_for_days`, 365 by default**, for a profile or `defaults`. A sync that finishes its pass drops older
  versions and change log rows ([configuration](docs/configuration.md#other-settings)).
- **Edit a file on the Disk where it is.** `files update` replaces a text file's whole text, `files sheets show` and
  `files sheets update` read and write an `.xlsx`'s cells, and `files documents show` and `files documents update`
  read and change a `.docx`'s paragraphs, keeping the rest of the file as it is. Each edit takes the file's `sha256`
  as `--expected-fingerprint` and asks as `files.delete` does. The file is checked just before the write, and what it
  replaced is kept on this computer; a file changed since it was read is a `conflict`, with nothing uploaded.
  `files history` lists what the edits replaced, and `files restore <path> <version>` puts one back. See
  [edit a file on the Disk](docs/usage.md#edit-a-file-on-the-disk) and
  [edit a file with your agent](docs/recipes.md#edit-a-file-with-your-agent).
- **A mirror merges a text file changed on both sides.** A `.md`, `.markdown`, `.txt`, `.csv` or `.tsv` file up to
  1 MB edited here and on the Disk in different places is merged line by line and written to both sides; the answer
  lists it under `merged`. Changes on the same or neighbouring lines stay a conflict. See
  [a file changed on both sides](docs/mirrors.md#a-file-changed-on-both-sides).
- **`mirrors conflicts list|show|resolve`.** See each conflict a sync left, its three versions and the lines that
  conflict, and settle it on both sides at once with `--keep local|disk|both` or the final file (`--file`, for you
  only). A side that changed since is refused with nothing written.
- **`mirrors sync --allow-replacements <count>`** lets one run replace up to that many existing files when the guard
  stops it; `--replace` still allows any number.
- **A whole-Disk sync goes on listing where the last run stopped.** A Disk too big to list in one run is listed over
  several, so each run is the usual length; the stopped answer says to run it again instead of asking for more
  time, and `listed` shows `resumed` and `so_far`. A folder's mirror still lists from the start each run.
- **`files restore`** takes a version from `files history` as well as a path in the trash.
- Requires `@wirecat/cli-core` 0.722.0 and `@wirecat/cli-base` 0.127.0.
- **`files show` and `files list` give each file's `md5` and `sha256`**, so an agent can tell whether a file changed
  since it read it. `files download` gives the `sha256` beside the file's whole text only: a text it cut or read out
  of a PDF, docx or xlsx has `sha256: null`, so it cannot be written back over the file.
- **A cut text says so in the help and the terminal.** `files download` without `--output` still answers at most
  200,000 characters with `truncated: true`; its help, [usage](docs/usage.md) and a terminal warning now say never
  to write a cut text back over the file.

### Fixed

- **A file sync no longer finds keeps its text.** It leaves lists and search, is marked no longer visible, and comes
  back as it was when the Disk shows it again. Before, sync blanked its text as if it were deleted, though the Disk
  cannot tell sync a deletion from a move or a lost share.

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
