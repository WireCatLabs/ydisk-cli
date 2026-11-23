<p align="center">
  <img src="https://raw.githubusercontent.com/WireCatLabs/ydisk-cli/main/docs/images/social-preview.png" alt="Yandex Disk for your AI agents: search the folders you choose, and work with the files live" width="100%">
</p>

# ydisk: Yandex Disk CLI for AI agents

<p align="center">
  Your Yandex Disk from the terminal, for you and for Claude Code, Codex, Cursor or any AI agent. Search the text of
  the folders you choose on your computer, and work with the files live.
</p>

<p align="center">
  <a href="https://wirecat.dev/en/docs/ydisk">Docs</a> ·
  <a href="https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/installation.md">Install</a> ·
  <a href="https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/usage.md">Usage</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@wirecat/yandex-disk-cli"><img src="https://img.shields.io/npm/v/@wirecat/yandex-disk-cli" alt="npm"></a>
  <a href="https://github.com/WireCatLabs/ydisk-cli/actions/workflows/main.yml"><img src="https://github.com/WireCatLabs/ydisk-cli/actions/workflows/main.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@wirecat/yandex-disk-cli"><img src="https://img.shields.io/npm/dm/@wirecat/yandex-disk-cli" alt="npm downloads"></a>
  <a href="https://github.com/WireCatLabs/ydisk-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache 2.0"></a>
</p>

- **Your documents, searchable on your computer.** Choose the Disk folders that matter. Their text is copied into
  WireCat's local store, and one search finds it by words and word forms, and by meaning once indexed.
- **The whole Disk, live.** List, read, download, upload, copy, move, delete to the trash, restore and share files
  without opening a browser.
- **Edit a file where it is.** An agent changes a Markdown note, cells of an Excel workbook or paragraphs of a Word
  document on the Disk, at the content it read. The file is checked just before the write, and what it replaced is
  kept on your computer.
- **Safe to give to an agent.** Deleting and public links ask first at a terminal, and one setting turns either off
  for an agent.

## What you get

- **Find a document by what is in it.** "Where is the lease for the flat?" finds the PDF by its text, not by its
  file name.
- **Read a file without saving it.** An agent reads the text of a PDF, docx, xlsx, CSV or Markdown file on the Disk
  and answers from it.
- **Change a note, a spreadsheet or a letter in place.** `files update` writes a text file, `files sheets update`
  writes cells and keeps the workbook's formatting and formulas, `files documents update` replaces paragraphs and
  keeps their style. Each takes the file's `sha256` from when it was read and is refused when someone changed the
  file since; `files history` and `files restore` put an earlier version back.
- **Keep the Disk tidy.** Move, copy, rename into a folder, and delete to the trash, where `files restore` brings a
  file back.
- **Share on request.** A public link for a file or folder, and close it again when you are done.
- **A folder on your computer that stays in step with the Disk.** Edit files with your own tools; a mirror sends
  your changes up and brings the Disk's down. Mirror one folder or the whole Disk, and leave out the folders you
  choose. A note edited here and on your phone in different places is merged; a real conflict waits for you in
  `mirrors conflicts`. A deleted file goes to a trash, never away, and many deletions at once wait for your approval.
- **The Disk as a folder in your file manager, read-only.** `ydisk personal files serve` shows a Disk folder next
  to your own, on Linux, macOS and Windows, with nothing to install. Open and read any file there; nothing can delete
  or change the Disk through it ([mount](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/mount.md)).
- **See the whole picture.** The copies sit next to your messages, mail, notes and meetings from the other WireCat
  tools, so one search covers all of them.

```text
You:    Find the lease for the flat and send Bob a link to it.
Agent:  (runs ydisk personal search "lease flat")
        /Documents/Flat/lease-2026.pdf, signed by Alice Example on 12.03.
        A public link lets anyone who has it open the file. Make one?
You:    Yes.
Agent:  (runs ydisk personal files publish /Documents/Flat/lease-2026.pdf --yes)
        Here is the link. Say "close it" when Bob has the file.
```

*Invented people, illustrative output.*

## Why ydisk

- **No WireCat server.** `ydisk` talks to Yandex Disk's API from your computer. There is no account with us, and the
  copies of your folders stay in a local store on your computer.
- **The official Disk API, with your own token.** `ydisk` uses Yandex's
  [Disk REST API](https://yandex.ru/dev/disk-api/doc/en/) with an OAuth token from an app you register. The token
  stays in your system keyring and only goes to Yandex's API.
- **Search that understands the text.** Text is read from PDF, docx, xlsx, CSV, TSV, plain text and Markdown files.
  Search finds other forms of a word, and matches by meaning once the text is indexed.
- **Safe to give to an agent.** You decide what an agent may do: read only, or no deleting and no public links. The
  agent's instructions say that text from files is data, never an instruction to follow.
- **Ready for any agent.** A skill for agents with a terminal, an MCP server for Claude Desktop and Cursor, and a
  secure link for ChatGPT and Claude in the browser.
- **Free and open source.** Apache 2.0, on macOS, Linux and Windows. It works with a free Yandex account.

How it compares with rclone, Yandex's own apps and the Yandex Disk MCP servers:
[compared with other tools](https://wirecat.dev/en/docs/ydisk/compare).

## Quick start

```sh
npm install -g @wirecat/yandex-disk-cli
ydisk doctor                              # what is set up, with no network
```

You need Node.js 22.16 or a later 22.x, or 24 or later. Try it without installing:
`npx @wirecat/yandex-disk-cli --help`.

Sign in once with a Yandex OAuth token. The token is kept in the system keyring, or in a private file only you can
read where no keyring works. It is never in an argument or the output.

1. Register an app at [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new/) ("For API access or
   debugging"), with the Yandex Disk access `cloud_api:disk.read`, `cloud_api:disk.write` and `cloud_api:disk.info`
   (only `disk.read` and `disk.info` for a read-only token). Copy its ClientID.
2. Open `https://oauth.yandex.ru/authorize?response_type=token&client_id=` with your app's ClientID added at the end,
   allow access and copy the token. Every step, with Yandex's own labels:
   [get a Yandex token](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/installation.md#get-a-yandex-token).
3. Sign in under a profile name you choose, then copy a folder and search it:

```sh
ydisk personal session start          # paste the token when asked, or pipe it on stdin
ydisk personal session status --check
ydisk personal folders add /Documents
ydisk personal sync
ydisk personal search "quarterly budget"
```

`personal` is a name you choose for this account. You can add `work` or any other later. No profile is ever assumed.
Yandex says a token lasts several months and is extended while it is used
([Yandex ID](https://yandex.ru/dev/id/doc/en/concepts/ya-oauth-intro)). When Yandex stops accepting it, sign in
again.

More: [installation](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/installation.md)

## Use it with your agent

Ask in plain words. The agent picks the commands.

> *"Use ydisk. Find the contract with the printing house and tell me the payment terms."*
> *"Use ydisk. What did I upload to /Photos/Trips this month?"*
> *"Use ydisk. Move last year's invoices to /Archive."*

- **Claude Code, Codex, Gemini CLI** and other agents with a terminal run `ydisk` themselves.
  `ydisk skill install` teaches them how.
- **Claude Desktop, Cursor** and other MCP apps connect to `ydisk personal mcp serve`.
- **ChatGPT or Claude in the browser** reach it through your own tunnel, after a login with a one-time code.

```sh
ydisk skill install                                # Claude Code, Codex, Gemini CLI and OpenClaw
ydisk personal mcp add claude-code --allow-writes  # or: codex
ydisk personal mcp config                          # the entry for Claude Desktop, Cursor and others
```

More: [connect your agent](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/mcp.md) ·
[recipes](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/recipes.md)

## What it can do

### Search the folders you choose

```sh
ydisk personal folders browse                     # the Disk's folders, one level at a time
ydisk personal folders add /Documents
ydisk personal sync                               # read what changed since the last sync
ydisk personal search "quarterly budget" --json
ydisk personal documents list
ydisk personal changes --since 7d                 # what sync added, changed or no longer finds
```

To read one document in full, pass an id from `documents list` or `search` to `ydisk personal documents show`.
Tags, notes and memories stay attached to a document, and `documents export` writes it to a Markdown file.
`documents history <id>` lists the earlier versions sync kept, and `--revision <n>` shows one.

Choose folders rather than the whole Disk: each sync lists every one of their subfolders.

### Work with the files live

```sh
ydisk personal files list --folder /Documents
ydisk personal files download /Documents/notes.md                  # its text
ydisk personal files download /Documents/plan.pdf --output ./plan.pdf
ydisk personal files upload ./notes.md --folder /Documents
ydisk personal files move /Documents/old.pdf --folder /Archive
ydisk personal files delete /Documents/old.pdf       # to the Disk's trash, files restore brings it back
ydisk personal files publish /Documents/plan.pdf     # a public link: anyone with it can open the file
ydisk personal files unpublish /Documents/plan.pdf
ydisk personal files update /Notes/plan.md --text "# Plan" --expected-fingerprint <sha256>
ydisk personal files sheets update /Work/budget.xlsx "Sheet1!B3" --values '[[1300]]' --expected-fingerprint <sha256>
ydisk personal files history /Work/budget.xlsx      # what this computer's edits replaced; files restore puts it back
```

`files show`, `files copy`, `files create` (a new folder), `files sheets show` and `files documents show|update` are
commands too. More: [edit a file on the Disk](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/usage.md#edit-a-file-on-the-disk)

### Keep a local folder in step

```sh
ydisk personal mirrors add /Notes ~/notes
ydisk personal mirrors preview                        # what a sync would copy, and nothing else
ydisk personal mirrors sync                           # both ways; text edits on both sides merge
ydisk personal mirrors conflicts list                 # what could not merge; show and resolve settle it
ydisk personal mirrors watch                          # keep syncing until Ctrl-C
```

More: [mirrors](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/mirrors.md)

### Open the Disk as a read-only folder

```sh
ydisk personal files serve /Documents                 # prints the address and how to mount it; Ctrl-C ends it
```

More: [mount](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/mount.md)

### The whole Disk API

`ydisk personal api list` lists the 20 operations of the Disk API, each as its own command, such as the trash, the
public links and the Disk's own operations that run in the background. `ydisk personal api show resources-list` shows
an operation's parameters without calling Yandex.

More: [commands](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/commands.md)

### With your other sources

`ydisk` keeps what it reads in the same local store as the other WireCat tools, such as Telegram, WhatsApp, mail,
Google Drive and Notion. `memo context` shows one person across all of them.

More: [WireCat](https://wirecat.dev)

## How it works

- **A local copy of the folders you choose.** Yandex Disk has no change feed, so each `sync` lists the chosen folders
  again and reads only the files that changed since the last one (by MD5). A stop loses nothing: the next sync goes
  on from where it stopped.
- **Stable ids.** A file moved inside the chosen folders keeps its id (Yandex's `resource_id`), its tags and its
  notes. A file deleted on the Disk leaves the copy at the end of the pass.
- **Renamed folders.** A chosen folder renamed or moved on the Disk is unavailable, and its copies leave the store,
  until you add it again under its new path.
- **Files go straight to Yandex.** Downloads and uploads go to the address Yandex gives, without the token.
- **Made for scripts.** `--json` gives the same shape for every command, and each kind of failure has its own exit
  code.

## Settings and permissions

Each profile has its own settings. `files.delete` (a delete, and an upload, copy or move with `--replace`) and
`files.share` (a public link) ask first at a terminal. Over MCP there is no one to ask, so turn them off for an agent
that should not do them:

```sh
ydisk personal config set permissions.files.delete deny
ydisk personal mcp serve --permission files.share=deny   # stricter for this server only
```

`YDISK_READ_ONLY=1` refuses every change.

More: [settings](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/configuration.md#permissions)

## Security

The token is in the system keyring, and no command takes it as an argument. It goes only to Yandex's API, never into
a link, the output or a log. Over MCP an agent reads a file's text but cannot save a file to a path, and an upload
refuses credential files and the WireCat folders unless you allow it.

More: [security](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/security.md) · Report a vulnerability:
[SECURITY.md](https://github.com/WireCatLabs/ydisk-cli/blob/main/SECURITY.md)

## When something goes wrong

```sh
ydisk doctor                            # what is set up, without connecting
ydisk personal doctor --online          # check that the token works
```

More: [troubleshooting](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/troubleshooting.md) · Bugs go to
[this repository's issues](https://github.com/WireCatLabs/ydisk-cli/issues).

## Documentation

Every page is in [docs/](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/index.md).

## Development

```sh
pnpm install && pnpm test
```

More: [design](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/dev/DESIGN.md) ·
[testing](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/dev/TESTING.md) · `pnpm docs:images` renders the banner
from [docs/images/src/banner.html](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/images/src/banner.html).

Pull requests, bug reports and ideas go to [issues](https://github.com/WireCatLabs/ydisk-cli/issues).

## Part of WireCat

`ydisk` is one of the [WireCat](https://wirecat.dev) tools: open-source, local-first command-line tools that give AI
agents your context from messengers, mail, calendars and documents. Each one works on its own.

## License

[Apache 2.0](https://github.com/WireCatLabs/ydisk-cli/blob/main/LICENSE)
