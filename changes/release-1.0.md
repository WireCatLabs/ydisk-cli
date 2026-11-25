### Changed — may break callers

- **Built on cli-core 1.0.0 and cli-base 1.0.0.** The generated API files read their types from
  `@wirecat/cli-base/codegen/runtime`. Store version 73 comes with cli-core 1.0: once a 1.0 tool opens the store, a 0.x
  tool refuses it, so upgrade every WireCat CLI together.

### Fixed

- **Over MCP, a Disk path stays a Disk path.** `files` paths and `--folder`, `mirrors add`'s Disk folder, `--ignore`
  and `mirrors versions`' path are marked as not local, so the server no longer makes them absolute against the
  client's folder or checks them as files on this computer. A local file, like `files upload <file>` or
  `files download --output`, is still checked.
