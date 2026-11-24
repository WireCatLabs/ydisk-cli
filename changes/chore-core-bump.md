### Added

- **New Excel and Word files** (cli-core 0.737.0, was 0.724.0). `files sheets create <path> --values <json rows>`
  makes a new `.xlsx`, and `files documents create <path> --payload <json paragraphs>` a new `.docx`. Each writes a new
  file only, refuses a path that is already there (`office.file-exists`), and answers the `sha256` that `update` takes
  next ([usage](../docs/usage.md#edit-a-file-on-the-disk)).

### Fixed

- **`mirrors conflicts resolve` runs inside the command's run.** `--timeout` now bounds it, `--record` keeps a run for
  it, and its Disk requests are in that run. Before, it reached the Disk outside any run.
- **Synced and edited files keep their earlier versions for `keep_versions_for_days`.** The mirrors' version stores,
  and the one `files update`, `history` and `restore` use, dropped versions after 30 days, whatever the setting said.
  They now keep them for the profile's `keep_versions_for_days`, one year by default, as
  [configuration](../docs/configuration.md#other-settings) says.
- **An Office edit that is refused says why.** A formula cell, a wrong format or a missing sheet now answers its own
  reason, such as `office.formula-cell`, in place of `input.invalid`.
