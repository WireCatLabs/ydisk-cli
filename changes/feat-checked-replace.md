### Changed — may break callers

- **A file without a public link is replaced under the Disk's own check.** `files update`, `files sheets update`,
  `files documents update`, `files restore <path> <version>` and a mirror's push of a changed file send the new content
  to a hidden file next to it, move the old file to the Disk's trash at the content that was read (the Disk refuses
  with 409 when the file changed since), and give the hidden file its name. Before, the file was read just before the
  upload, and a change in that moment was overwritten. The file now gets a new `resource_id`, and the Disk's own
  version history of it starts over; the old content is in the Disk's trash, which Yandex's help says takes up space
  for 30 days. Its synced copy moves to the new id, so its tags, the notes about it and its links follow it; when the
  local store cannot be reached the write still happens, with a warning. A file with a public link is still
  overwritten in place after the read, so its link stays ([usage](../docs/usage.md#edit-a-file-on-the-disk), [mirrors](../docs/mirrors.md#how-a-file-on-the-disk-is-replaced)).

### Added

- **More formats are read** (cli-core 0.739.0, was 0.737.0): Word 97–2003 `.doc`, PowerPoint `.pptx`, OpenDocument
  `.odt`, `.ods` and `.odp`, RTF, HTML and EPUB, beside PDF, `.docx`, `.xlsx`, CSV, TSV, plain text and Markdown. A
  file an earlier version kept by name only is read on the next sync ([usage](../docs/usage.md#what-the-copy-holds)).
- **A sync lists four Disk folders at once**, so a sync of many folders takes less time. It stays within the 120
  requests a minute ydisk sends to Yandex.

