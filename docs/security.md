# Security

Know what `ydisk` keeps on your computer, what it sends and to whom, and how to remove it. What WireCat CLIs share,
such as the keyring, permissions, MCP and what never reaches a log, is on the
[shared security page](https://wirecat.dev/en/docs/security). This page keeps only what is particular to `ydisk`.

**On this page:**

1. [What stays on your computer](#what-stays-on-your-computer)
2. [What goes over the network](#what-goes-over-the-network)
3. [Agents and MCP](#agents-and-mcp)
4. [Run records](#run-records)
5. [File permissions](#file-permissions)

## What stays on your computer

| What | Where | How to remove it |
| --- | --- | --- |
| The Yandex token | The system keyring, or a private file where there is none | `ydisk personal session end`. The token stays valid at Yandex until you revoke it ([how to revoke it](#revoke-the-token-at-yandex)) |
| The text of the files in the chosen folders, with their names, paths, sizes, dates and MD5 checksums | The local store, `wirecat.db`, shared with the other WireCat tools | `folders remove` with the folder's id from `folders list`, then `sync` |
| Your tags, notes and memories about documents | The local store | `tags remove`, `notes remove` |
| Each mirror's folder pair, its last sync and the versions a sync replaced or deleted here | `profiles/<profile>/mirrors.json` and `profiles/<profile>/mirrors/` in the state folder, readable by you only | `mirrors remove <id>` forgets the pair; the versions stay until they expire ([mirrors](mirrors.md#earlier-versions-of-a-file)) |
| Files a mirror took off this computer because they were deleted on the Disk | `.wirecat-trash/` inside the mirrored folder | Delete the folder when you no longer need them |
| Settings and run records | The folders `ydisk doctor` shows | `ydisk runs list` shows them. They expire after the days in [settings](configuration.md#run-records) |

The files themselves stay on the Disk. A copy of a file is saved only when you run `files download --output`, or in
a folder you [mirror](mirrors.md).
Public links (`public_url`) are not kept by the sync. Nothing goes to WireCat: there is no WireCat server and no
account with us.

### Revoke the token at Yandex

`session end` only removes the token from this computer. Yandex keeps accepting it until it expires or you revoke it.
To revoke it, sign in to Yandex ID, open [Data access](https://id.yandex.ru/personal/data-access), and remove the app the token was issued for. Yandex
also revokes every token of the account when you change the password or choose "Log out on all devices"
([Yandex ID: revoking tokens](https://yandex.ru/dev/id/doc/en/tokens/token-invalidate)). Revoke it when the computer or the token may have leaked.

## What goes over the network

`ydisk` keeps its settings in `config.json` and its state in the folders `ydisk doctor` shows. It talks to one
service, Yandex Disk's API at `cloud-api.yandex.net`. `session start` keeps the Yandex OAuth token in the OS keyring,
or in a private file where no keyring works. The token goes only into the Authorization header of a request to
`cloud-api.yandex.net`, never into an address, an answer or a run record. Downloads and uploads go
to the link Yandex gives (`downloader.disk.yandex.ru`, `*.disk.yandex.net`, `*.storage.yandex.net`) without the token, and those links are
never printed.

Besides Yandex, `ydisk` asks the npm registry once a day whether a newer version exists, unless `update_check` is
`false`. Text goes to an AI provider only when you set one up, such as `embedding_provider` set to `openai` or
`memories extract`. By default search by meaning runs on your computer.

## Agents and MCP

Over MCP an agent reads a file's text with `files download` but cannot save it to a path: `--output` is the owner's
only. `files upload` refuses credential files, browser profiles and the WireCat folders unless the owner adds
`--allow-any-file`. `files delete`, `--replace` and the public-link commands ask first at a terminal. A
[mirror sync](mirrors.md#what-an-agent-may-do) checks `files.upload` for each file it sends and `files.delete` for
each file it replaces or moves to a trash, on either side; an agent cannot add or remove a mirror. Over MCP only
`deny` stops them, so set `files.delete=deny` and `files.share=deny` for an agent that should not, and `files.upload=deny` for one that
should put no local file on the Disk.

`ydisk personal mcp serve --http` listens on `127.0.0.1` only, for browser apps that reach it through your own
tunnel. Each app logs in with a one-time code, and the server keeps a hash of each login it gives, in the state
folder, readable by you only. `ydisk personal mcp revoke` forgets every one of them.

## Run records

A run record keeps the command line as you typed it, so `ydisk runs show` tells you what was run. A secret is still
stored as `[redacted]`, by the rules every WireCat tool shares, on the
[shared security page](https://wirecat.dev/en/docs/security). To keep none of the words you type, run
`ydisk personal config set record_input false`.

## File permissions

`config.json` is saved readable by you only (`0600`), and its folder is created for you only (`0700`). A file or
folder made by an older version may be open to other users of the computer: `ydisk doctor` lists each under
`files.problems` and prints the `chmod` that fixes it. Windows is not checked. Report a vulnerability as [SECURITY.md](https://github.com/WireCatLabs/ydisk-cli/blob/main/SECURITY.md)
says.
