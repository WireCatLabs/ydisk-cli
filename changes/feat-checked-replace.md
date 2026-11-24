### Changed — may break callers

- **A file without a public link is replaced under the Disk's own check.** `files update`, `files sheets update`,
  `files documents update`, `files restore <path> <version>` and a mirror's push of a changed file send the new content
  to a hidden file next to it, move the old file to the Disk's trash at the content that was read (the Disk refuses
  with 409 when the file changed since), and give the hidden file its name. Before, the file was read just before the
  upload, and a change in that moment was overwritten. The file now gets a new `resource_id`, and the Disk's own
  version history of it starts over; the old content is in the Disk's trash. A file with a public link is still
  overwritten in place after the read, so its link stays
  ([usage](../docs/usage.md#edit-a-file-on-the-disk), [mirrors](../docs/mirrors.md#how-a-file-on-the-disk-is-replaced)).
