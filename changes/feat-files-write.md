### Added

- **`files show`, `files list` and `files download` give each file's `md5` and `sha256`**, so an agent can tell
  whether a file changed since it read it.
- **A cut text says so in the help and the terminal.** `files download` without `--output` still answers at most
  200,000 characters with `truncated: true`; its help, [usage](../docs/usage.md) and a terminal warning now say never
  to write a cut text back over the file.
