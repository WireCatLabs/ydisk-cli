# Recipes

Whole tasks you can hand to your agent, each with a request to copy and the commands the agent runs for it. They
assume you have [signed in](installation.md), chosen folders and [connected your agent](mcp.md). Change the profile,
paths and names to yours. The ones here are examples.

**On this page:**

1. [Find a contract and quote its terms](#find-a-contract-and-quote-its-terms)
2. [Answer from a file outside the chosen folders](#answer-from-a-file-outside-the-chosen-folders)
3. [Tidy last year's invoices into an archive](#tidy-last-years-invoices-into-an-archive)
4. [Share a file and close the link later](#share-a-file-and-close-the-link-later)
5. [Put a report the agent wrote on the Disk](#put-a-report-the-agent-wrote-on-the-disk)
6. [Edit a file with your agent](#edit-a-file-with-your-agent)
7. [Undo a delete](#undo-a-delete)
8. [Keep the copy current every morning](#keep-the-copy-current-every-morning)

## Find a contract and quote its terms

```text prompt
Use ydisk CLI with profile personal. Find the contract with Harbour Ltd in my Disk folders.
Quote the payment terms and the notice period, and give me the file's path on the Disk. Do not change any files.
```

```sh
ydisk personal search "Harbour Ltd contract" --json
ydisk personal documents show 1a2b3c --json
```

The agent searches the copy, then reads the whole text of the best hit. If the copy is old, it runs
`ydisk personal sync` first.

## Answer from a file outside the chosen folders

```text prompt
Use ydisk CLI with profile personal. Open /Work/Q3/report.xlsx on my Disk and tell me the total for September.
```

```sh
ydisk personal files download /Work/Q3/report.xlsx --json
```

`files download` without `--output` answers the file's text, so nothing is saved on your computer. A text longer than
200,000 characters is cut and says `truncated: true`. For the cells themselves, with their formulas,
`ydisk personal files sheets show /Work/Q3/report.xlsx` answers them by address.

## Tidy last year's invoices into an archive

```text prompt
Use ydisk CLI with profile personal. Move every invoice from 2025 in /Documents/Invoices to /Archive/Invoices-2025.
Show me the list before you move anything.
```

```sh
ydisk personal files list --folder /Documents/Invoices --json
ydisk personal files create /Archive/Invoices-2025
ydisk personal files move /Documents/Invoices/2025-03.pdf --folder /Archive/Invoices-2025 --dry-run
ydisk personal files move /Documents/Invoices/2025-03.pdf --folder /Archive/Invoices-2025
```

`--dry-run` shows what a move would do without doing it. A move keeps the file's tags and notes in the copy.

## Share a file and close the link later

```text prompt
Use ydisk CLI with profile personal. Make a public link to /Documents/Flat/lease-2026.pdf so I can send it to Bob.
```

```sh
ydisk personal files publish /Documents/Flat/lease-2026.pdf
ydisk personal files unpublish /Documents/Flat/lease-2026.pdf
```

Anyone who has a public link can open the file. At a terminal the tool asks first. Over MCP the link is made without
asking unless `files.share` is `deny`, see [connect your agent](mcp.md#decide-what-the-agent-may-change).

## Put a report the agent wrote on the Disk

```text prompt
Use ydisk CLI with profile personal. Save the summary you just wrote as summary.md in /Reports on my Disk.
```

```sh
ydisk personal files upload ./summary.md --folder /Reports
```

An upload refuses credential files, browser profiles and the WireCat folders, so an agent cannot send them to the
Disk by mistake.

## Edit a file with your agent

The agent reads the file, edits it, and writes it back with the `sha256` it read. If someone changed the file in the
meantime, the write is refused and nothing is uploaded: the agent reads it again and redoes the edit. What each edit
replaced is kept on this computer. In the commands here, `9f86d081…` stands for the real `sha256` that the download
or `show` answers.

A Markdown note:

```text prompt
Use ydisk CLI with profile personal. In /Notes/plan.md on my Disk, tick "send the invoice" and add
"call the bank" under Friday. Keep everything else as it is.
```

```sh
ydisk personal files download /Notes/plan.md --json
ydisk personal files update /Notes/plan.md --expected-fingerprint 9f86d081… < plan.md
```

The download answers the whole text and its `sha256`. The update reads the edited text on stdin, here from the local
file `plan.md`. A text cut at 200,000 characters has no `sha256`, so it can
never be written back.

A spreadsheet:

```text prompt
Use ydisk CLI with profile personal. In /Work/budget.xlsx, set the March rent to 1300 and mark it paid.
```

```sh
ydisk personal files sheets show /Work/budget.xlsx "Sheet1!A1:D20" --json
ydisk personal files sheets update /Work/budget.xlsx "Sheet1!B3:C3" --values '[[1300, "paid"]]' --expected-fingerprint 9f86d081…
```

Only those cells change; the formatting, the other sheets and the formulas stay. A formula cell is refused unless the
agent adds `--replace`.

A Word document:

```text prompt
Use ydisk CLI with profile personal. In /Work/letter.docx, replace the second paragraph with
"The pond opens on Monday." and add "Kind regards, Anna" at the end.
```

```sh
ydisk personal files documents show /Work/letter.docx --json
ydisk personal files documents update /Work/letter.docx --payload '[{"index": 1, "text": "The pond opens on Monday."}, {"insert_after": 5, "text": "Kind regards, Anna"}]' --expected-fingerprint 9f86d081…
```

The paragraphs keep their style. A paragraph with a tracked change, an image, a comment or a link is refused with the
reason, so the agent can tell you instead.

To undo an edit, take the `version` to put back from `files history` (here `5d41402a…`), and the `sha256` the file
has now:

```sh
ydisk personal files history /Work/letter.docx
ydisk personal files restore /Work/letter.docx 5d41402a… --expected-fingerprint 9f86d081…
```

## Undo a delete

```text prompt
Use ydisk CLI with profile personal. I deleted old.pdf from my Disk by mistake. Bring it back.
```

```sh
ydisk personal api trash-resources-list --json
ydisk personal files restore trash:/old.pdf
```

`files delete` moves a file to the Disk's trash, so it can come back until the trash is emptied.

## Keep the copy current every morning

Nothing syncs in the background. To have a fresh copy each morning, run `sync` from your system's scheduler, such as
cron on Linux and macOS:

```text
0 8 * * * ydisk personal sync --quiet
```

The line runs the sync at 8:00 every day. If cron cannot find `ydisk`, use the full path that `which ydisk` prints. Run `ydisk personal status` to see when the last sync finished.
