### Changed — may break callers

- **Built on cli-core 2.0.0 and cli-base 1.1.0.** Store version 78 comes with cli-core 2.0: once a 2.0 tool opens the
  store, a 1.x tool refuses it, so upgrade every WireCat CLI together. In the shared store an AI agent is now
  `agent:<id>` and a sender bot `bot:<id>`. ydisk's own commands and output do not change.
