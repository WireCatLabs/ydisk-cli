# Yandex Disk

Find any document on your Yandex Disk by what it says, and let your AI agent read it, file it and share it for you.
`ydisk` copies the text of the Disk folders you choose to your computer, so a search for "lease" or "договор аренды"
finds the PDF even when its file name is `scan_0042.pdf`, and even without the internet. When you need the Disk
itself, the same tool lists, downloads, uploads, moves and shares files there.

An agent with `ydisk` answers "where is the contract with the printing house, and what are its payment terms?" with
the quote and the file's path on the Disk. `ydisk` works with Claude Code, Codex, Gemini CLI and other agents that run
commands, with Claude Desktop and Cursor through MCP, and with ChatGPT and Claude in the browser through your own
tunnel.

You need Node.js and a Yandex OAuth token, a key that lets the tool use your Disk. Getting the token takes about five
minutes, once.

**On this page:**

1. [What you get](#what-you-get)
2. [How it works](#how-it-works)
3. [Try it in five commands](#try-it-in-five-commands)
4. [Ask your agent](#ask-your-agent)
5. [Where to go next](#where-to-go-next)

## What you get

- **Search inside your files, not only their names.** Search finds text inside PDFs, Word, Excel and PowerPoint
  files, and most other documents ([full list](usage.md#what-the-copy-holds)). Even scans and photos of paper are
  searchable: their text is recognized ([OCR](usage.md#scans-and-pictures)) on your computer by default. Search finds
  other forms of a word in Russian and English, and finds a document by meaning once its text is indexed.
- **Search without the internet.** Search reads the copy on your computer, so it is fast and costs no request to
  Yandex.
- **The whole Disk, live.** Find, move and share files on the Disk without a browser, and get a deleted one back from
  the trash.
- **Edit a file where it is.** You or your agent change a note, Excel cells or Word paragraphs on the Disk without
  downloading by hand. The rest of the file stays as it is, and what the edit replaced is kept on your computer. A
  file without a public link is checked by the Disk itself at the moment of the write; a shared one is checked just
  before it. See [edit a file on the Disk](usage.md#edit-a-file-on-the-disk).
- **A folder that keeps up with the Disk.** A mirror keeps a folder on your computer and one on the Disk the same both
  ways. A text file edited on both sides is merged; a real conflict waits for you with a diff. It stops before many
  deletions or replacements. See [mirrors](mirrors.md).
- **You decide what an agent may change.** At a terminal the tool asks before it deletes, overwrites or makes a
  public link. Over MCP nobody can answer, so an agent does these without asking until you set them to `deny` or
  allow reading only. See [connect your agent](mcp.md#decide-what-the-agent-may-change).
- **One search across your sources.** The copy sits in the same local store as your Telegram, WhatsApp, mail, notes
  and meetings from the other WireCat tools, so one search covers them all.
- **Free and open source.** Apache 2.0, on macOS, Linux and Windows. No WireCat account and no WireCat server: the
  tool talks to Yandex's official API from your computer.

## How it works

- **A profile for each account.** A profile is a name you choose for one Yandex account, such as `personal` or
  `work`. Every command that uses an account starts with it: `ydisk personal search budget`.
- **A copy of the text, not of the files.** `sync` reads the folders you chose and keeps their text in the local
  store, one database file on your computer. The files themselves stay on the Disk. Photos and other files without
  text are kept by name.
- **Only the folders you choose.** Yandex Disk does not tell a tool what changed, so each sync lists the chosen
  folders again and downloads only the files whose content changed. Choose the folders that matter, not the whole
  Disk.
- **Live commands go to the Disk.** `files` commands work on the Disk directly and need no sync.

## Try it in five commands

After you [install the tool and sign in](installation.md):

```sh
ydisk personal folders browse
ydisk personal folders add /Documents
ydisk personal sync
ydisk personal search "quarterly budget"
ydisk personal files list --folder /Documents
```

The first command lists the folders at the top of your Disk. The next two copy the text of `/Documents`. The search
answers from that copy, and the last command reads the folder live from the Disk.

## Ask your agent

Install the tool's skill once with `ydisk skill install`, then ask in plain words:

```text prompt
Use ydisk CLI with profile personal. Find the lease for the flat in my Disk folders.
Quote the notice period and give me the file's path on the Disk. Do not change any files.
```

The agent searches the copy first and reads a file outside the chosen folders live from the Disk. More requests are
in [recipes](recipes.md).

## Where to go next

- [Install and sign in](installation.md): Node.js, the Yandex token step by step, and the first check.
- [Folders and sync](usage.md): choose folders, keep the copy current, work with files live.
- [Find a document](search.md): words, word forms, meaning, file names.
- [Mirrors](mirrors.md): keep a folder on your computer and one on the Disk the same both ways.
- [Open the Disk as a folder](mount.md): see the Disk in your file manager, read-only.
- [Connect your agent](mcp.md): the skill, Claude Code, Codex, Claude Desktop, Cursor and browser apps.
- [Compared with other tools](compare.md): rclone, Yandex's own client and the Yandex Disk MCP servers.
