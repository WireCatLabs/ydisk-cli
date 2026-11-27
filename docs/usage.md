# Folders and sync

Choose the Disk folders whose text you want to search, keep their copy current, and work with any file on the Disk
live. After this page your agent can answer from the folders you chose and change files only where you allow it. It
assumes you have [signed in](installation.md).

**On this page:**

1. [The profile comes first](#the-profile-comes-first)
2. [Choose folders](#choose-folders)
3. [Sync](#sync)
4. [What the copy holds](#what-the-copy-holds)
5. [Read a synced document](#read-a-synced-document)
6. [Earlier versions and what changed](#earlier-versions-and-what-changed)
7. [Work with files live](#work-with-files-live)
8. [Edit a file on the Disk](#edit-a-file-on-the-disk)
9. [Output for scripts](#output-for-scripts)

## The profile comes first

A profile is a name you choose for one account. It is the first word of every command that uses an account:

```sh
ydisk personal status
```

`YDISK_PROFILE=personal` does the same for one shell session. No profile is ever assumed, not even the only one: a
command without one stops with exit code 2 and lists the profiles on this computer.

## Choose folders

`folders browse` lists the Disk one level at a time, live, so you can find a folder by its path:

```sh
ydisk personal folders browse
ydisk personal folders browse --folder /Documents
ydisk personal folders add /Documents/Contracts
```

A chosen folder brings in everything under it, subfolders included. `folders list` shows the folders you chose, and
`folders remove` takes one out. The next sync drops its documents from the copy.

Choose a few folders that hold documents, not the whole Disk. Yandex Disk does not tell a tool what changed, so each
sync lists every chosen folder and its subfolders again. A folder of photos adds listing time and no searchable text.

## Sync

```sh
ydisk personal sync
ydisk personal status
```

`sync` downloads the files that are new or whose content changed since the last sync, and reads their text. A file
moved inside the chosen folders keeps its tags and notes.

A file sync no longer finds on the Disk leaves lists and search, but its text stays in the copy, marked no longer
visible. The Disk does not tell sync whether the file was deleted, moved out or lost to a share, so sync never treats
it as deleted. When the file shows again, it comes back as it was.

One sync reads up to 200 files (`--limit`) and lists up to about 10,000 entries, then saves where it stopped. A large
folder takes several runs: run `sync` again until `status` shows no pending work. A stop loses nothing, and the next
sync goes on from where the last one stopped.

Run `sync` whenever you want the copy to catch up, for example before you ask your agent about recent files. Nothing
runs in the background. `sync --rescan` reads every chosen folder from the start. Run it once, then go on with a plain
`sync`.

A chosen folder that you rename or move on the Disk is no longer found, and its documents leave the copy. Add it
again under its new path.

## What the copy holds

| On the Disk | In the copy |
| --- | --- |
| PDF with a text layer, Word `.docx` and `.doc`, Excel `.xlsx`, PowerPoint `.pptx`, OpenDocument `.odt`, `.ods` and `.odp`, RTF, HTML, EPUB, CSV, TSV, plain text, Markdown | The text, the name, the path, the size and the dates |
| A scanned PDF (no text layer), a JPEG, PNG or WebP picture | The text read by OCR, as `read_scans` says: on your computer by default. A scan over 20 pages, a picture over 25 MB, or any of them with `read_scans` set to `off`: the name, the path and the dates. See [scans and pictures](#scans-and-pictures) |
| Any other file, and any file over 10 GB (`MESSAGING_ATTACHMENT_MAX_MIB` sets another limit) | The name, the path and the dates |

`status` lists each file kept by name only, with the reason. The files themselves stay on the Disk. The copy holds
their text. Times are kept and shown in UTC.

### Scans and pictures

A sync reads the text of a scanned PDF and of a JPEG, PNG or WebP picture by OCR. The profile's `read_scans` setting
chooses who reads it:

| `read_scans` | Who reads the text | What it needs |
| --- | --- | --- |
| `local` (default) | The `tesseract` program on your computer, in Russian and English. Nothing leaves the computer and nothing is downloaded | `tesseract` installed, for example `sudo apt install tesseract-ocr tesseract-ocr-rus` on Debian or Ubuntu, `brew install tesseract tesseract-lang` on macOS |
| `anthropic` or `openai` | The model chosen with `ydisk ai set`, at that provider's own address. Each page is sent to the provider as a picture, and the provider charges for every page | `ydisk ai set` with that provider, and pictures allowed (`ydisk ai set --images`) |
| `off` | No one | Scans and pictures are kept by name only |

`ydisk personal config set read_scans '"anthropic"'` switches one profile. One file is read up to 20 pages, and one
sync reads at most 100 pages. The pages over that wait for the next sync. A scan an older ydisk kept by name is read
on the next sync. When `tesseract` is missing, the sync still finishes, and each scan's reason in `status` says how
to install it. `local` turns a page lying on its side before it reads it, with `tesseract`'s orientation data
(`sudo apt install tesseract-ocr-osd` where it is not installed with `tesseract`). Without that data such a page reads
as garbled text, and the sync's `warnings` say `document.scan-unturned`.

## Read a synced document

```sh
ydisk personal documents list
ydisk personal documents show 1a2b3c --json
ydisk personal documents export 1a2b3c --output ./contract.md
```

`documents show` prints the whole text of one document, found by its id from `search` or `documents list`. The id
above is an example. `documents export` writes it to a new Markdown file. Tags, notes and memories stay with a
document and never reach the Disk. See [find a document](search.md).

## Earlier versions and what changed

```sh
ydisk personal documents history 1a2b3c
ydisk personal documents history 1a2b3c --revision 2
ydisk personal changes --since 7d
ydisk personal changes --since 1d --event unavailable
```

Each sync keeps a document's text, title and front matter before it changes or leaves the copy.
`documents history` lists those versions, and `--revision` shows one. `changes` lists what was added, changed, no
longer visible, left the chosen folders or came back, newest first. Both read the copy only, so they work offline and
over MCP. Versions and the change log are kept for `keep_versions_for_days`, one year by default.

## Work with files live

The `files` commands go to the Disk directly and need no sync. Paths are Disk paths, such as `/Documents/plan.pdf`.

```sh
ydisk personal files list --folder /Documents
ydisk personal files show /Documents/plan.pdf
ydisk personal files download /Documents/plan.pdf --json
ydisk personal files download /Documents/plan.pdf --output ./plan.pdf
ydisk personal files upload ./notes.md --folder /Documents
ydisk personal files copy /Documents/plan.pdf --folder /Archive
ydisk personal files move /Documents/old.pdf --folder /Archive
ydisk personal files create /Projects/2026
ydisk personal files delete /Documents/old.pdf
ydisk personal files restore trash:/old.pdf
ydisk personal files update /Notes/plan.md --text "# Plan" --expected-fingerprint <sha256>
ydisk personal files sheets show /Work/budget.xlsx "Sheet1!A1:C10"
ydisk personal files documents show /Work/report.docx
ydisk personal files history /Notes/plan.md
ydisk personal files publish /Documents/plan.pdf
ydisk personal files unpublish /Documents/plan.pdf
```

- `files download` without `--output` answers the file's text, up to 200,000 characters, so an agent can read a file
  outside the chosen folders without saving it. A longer text is cut there and the answer says `truncated: true`.
  Never write a cut text back over the file: the rest of it would be lost.
- `files show` and `files list` give each file's `md5` and `sha256`, so an agent can tell whether a file changed
  since it read it. `files download` gives the `sha256` only beside the file's whole text: a cut text, or the text
  read out of a PDF, a .docx or an .xlsx, has `sha256: null`, so an agent has no hash to write it back with.
- `files delete` moves a file to the Disk's trash, and `files restore` brings it back by its path in the trash.
- `files publish` makes a public link that anyone who has it can open. `files unpublish` closes it.
- `--replace` on an upload, a copy or a move overwrites a file already at that path.

At a terminal the tool asks before a delete, an overwrite, an edit and a public link. Over MCP there is no one to
ask, so set those permissions for an agent. See [settings](configuration.md#permissions). Add `--dry-run` to any
change to see what it would do without doing it.

Every operation of Yandex's Disk API is a command too: `ydisk personal api list` lists them, and
`ydisk personal api show resources-list` shows one operation's parameters without calling Yandex.

## Edit a file on the Disk

An edit replaces a file only at the content it was read at. Read the file's `sha256` first and pass it as
`--expected-fingerprint`. What the edit replaced is kept on this computer, in the profile's state folder. If the file
changed since it was read, the answer is a `conflict` that names the command to read it again.

How the file is checked depends on whether it has a public link:

- **A file without a public link is checked by the Disk itself at the moment of the write.** The new content goes to
  a hidden file next to it (`.name.ext.ydisk-…`). Then the old file goes to the Disk's trash, and the Disk refuses
  that when the file's content is not the one read. Then the hidden file takes the file's name. The file gets a new
  id (Yandex's `resource_id`), and the Disk's own version history of it starts over. The old file is in the trash,
  and [Yandex's help](https://yandex.ru/support/yandex-360/customers/disk/web/ru/actions-files/spec-folders/trash)
  says files there still take up space on the Disk and are deleted automatically after 30 days.
  If the file changed, the hidden file is removed and nothing is replaced. If a new file appeared at the path in the
  moment between the two steps, the answer is a `conflict` (`upload.replace-interrupted`) that names the hidden file,
  which keeps your new content.
- **A file with a public link is checked just before the write**, and what it replaced is kept on your computer. It
  is overwritten in place, so its id and its link stay. The Disk has no conditional upload, so a change that lands in
  the moment between that check and the upload is not caught; the replaced content is still kept.

| Command | What it changes |
| --- | --- |
| `files update <path> --text <text>` (or the text on stdin) | the whole text of a plain-text file, such as `.md`, `.txt` or `.csv`; a new file needs no fingerprint |
| `files sheets update <path> <range> --values <json>` | cells of an `.xlsx`, from `files sheets show`; the rest of the workbook stays as it is |
| `files documents update <path> --payload <json>` | paragraphs of a `.docx`, by the indexes `files documents show` gives |
| `files sheets create <path> --values <json>` | a new `.xlsx` with one sheet of these rows from A1; `--name` names the sheet |
| `files documents create <path> --payload <json>` | a new `.docx` from paragraphs, each with an optional style such as `Title` or `Heading1` |
| `files restore <path> <version>` | puts back a version `files history` lists |

`files update` refuses a `.pdf`, `.docx` or `.xlsx`: their text is extracted, and writing it back would replace the
document. `sheets update` writes a text as text, even one that starts with `=`, and refuses to overwrite a formula
unless `--replace`. `documents update` refuses a paragraph with a tracked change, a field, an image, a comment, a
link or a footnote, and says why. `sheets create` and `documents create` write a new file only and refuse a path
that is already there; they answer the `sha256` that `update` takes next. Every edit of an existing file asks as
`files.delete` does. `files history` lists what this profile's
edits replaced, newest last; each `version` is the sha256 of the replaced content, and `available` says whether it is
still kept. See [edit a file with your agent](recipes.md#edit-a-file-with-your-agent).

## Output for scripts

Every command except `mcp serve` takes `--json` and prints one JSON value on stdout. Errors are JSON on stderr, with
a `code` to branch on, and each kind of failure has its own exit code. The
[command reference](commands.md) lists them.

Next: [find a document](search.md), or [connect your agent](mcp.md).
