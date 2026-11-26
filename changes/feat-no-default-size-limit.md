### Fixed

- **A sync and `files read` read a file up to 10 GB, not 50 MB.** A larger PDF or document was kept by name only
  ("file is larger than 50 MB"). The limit is cli-core's shared file budget: `MESSAGING_ATTACHMENT_MAX_MIB` sets
  another one, in MiB ([usage](../docs/usage.md)). A file kept by name for its size is read on the next sync. A file
  is read whole into memory, so a large one needs that much free memory.
