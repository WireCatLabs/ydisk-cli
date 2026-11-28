### Added

- **WireCat Desktop reads the MCP port and the sign-in from ydisk itself.** The manifest (`ydisk --wcat-describe`)
  now names the fixed MCP port 8760 and the OAuth token sign-in, with the token passed on stdin. Desktop reads them
  from the tool and keeps its own list only as a fallback. Built on cli-base 1.2.0.
