### Fixed

- **A sync and `files read` read a file up to 10 GB, not 50 MB.** A larger PDF or document was kept by name only
  ("file is larger than 50 MB"). The limit is cli-core's shared file budget: `MESSAGING_ATTACHMENT_MAX_MIB` sets
  another one, in MiB ([usage](../docs/usage.md)). A file kept by name for its size is read on the next sync. A file
  is read whole into memory, so a large one needs that much free memory.

### Changed — may break callers

- **On cli-core 2.0.0.** An agent is `agent:<id>` and a sender bot `bot:<id>` in the JSON output, and the shared
  store moves to version 78 on first open. Upgrade every WireCat CLI and WireCat Desktop the same day: a CLI on
  cli-core 1.x refuses the store after that.
