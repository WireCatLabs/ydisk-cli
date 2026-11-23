### Added

- **Edit a file on the Disk where it is.** `files update` replaces a text file's whole text, `files sheets show` and
  `files sheets update` read and write an `.xlsx`'s cells, and `files documents show` and `files documents update`
  read and change a `.docx`'s paragraphs, keeping the rest of the file as it is. Each edit takes the file's `sha256`
  as `--expected-fingerprint` and asks as `files.delete` does. The file is checked just before the write, and what it
  replaced is kept on this computer; a file changed since it was read is a `conflict`, with nothing uploaded.
  `files history` lists what the edits replaced, and `files restore <path> <version>` puts one back. See
  [edit a file on the Disk](../docs/usage.md#edit-a-file-on-the-disk) and
  [edit a file with your agent](../docs/recipes.md#edit-a-file-with-your-agent).
- **A mirror merges a text file changed on both sides.** A `.md`, `.txt`, `.csv` or `.tsv` file up to 1 MB edited
  here and on the Disk in different places is merged line by line and written to both sides; the answer lists it
  under `merged`. Changes on the same or neighbouring lines stay a conflict. See
  [a file changed on both sides](../docs/mirrors.md#a-file-changed-on-both-sides).
- **`mirrors conflicts list|show|resolve`.** See each conflict a sync left, its three versions and the lines that
  conflict, and settle it on both sides at once with `--keep local|disk|both` or the final file (`--file`, for you
  only). A side that changed since is refused with nothing written.
- **`mirrors sync --allow-replacements <count>`** lets one run replace up to that many existing files when the guard
  stops it; `--replace` still allows any number.

- **A whole-Disk sync goes on listing where the last run stopped.** A Disk too big to list in one run is listed over
  several, so each run is the usual length; the stopped answer says to run it again instead of asking for more
  time, and `listed` shows `resumed` and `so_far`. A folder's mirror still lists from the start each run.
- **`files restore`** takes a version from `files history` as well as a path in the trash.

### Changed — may break callers

- **`files download` gives no `sha256` for a text it cut or read out of a PDF, docx or xlsx** (`sha256: null`), so
  such a text cannot be written back over the file. `files show` still gives the file's hash.
- Requires `@wirecat/cli-core` 0.722.0 and `@wirecat/cli-base` 0.127.0.
