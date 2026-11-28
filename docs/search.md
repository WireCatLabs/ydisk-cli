# Find a document

Find a contract, a figure or a decision in your Disk folders by what the document says, even when you do not remember
its name. Search reads the copy on your computer, so it answers without the internet and costs no request to Yandex.
It covers the folders you chose and synced. See [folders and sync](usage.md).

```text prompt
Use ydisk CLI with profile personal. Find the document where we agreed the budget for the spring campaign.
Quote the passage and give me the file's path on the Disk.
```

**On this page:**

1. [Search by words](#search-by-words)
2. [Search by meaning](#search-by-meaning)
3. [Find a file by its name](#find-a-file-by-its-name)
4. [Tags and notes](#tags-and-notes)
5. [Across your other sources](#across-your-other-sources)
6. [When search finds nothing](#when-search-finds-nothing)

## Search by words

```sh
ydisk personal search "quarterly budget"
ydisk personal search "договор аренды" --limit 5
ydisk personal search "invoice 2026" --exact
```

Search finds other forms of a word: "договор" also finds "договора" and "договоре", and "budgets" finds "budget".
`--exact` matches the words as written. Each hit has the document's id, its path on the Disk and an excerpt. Pass the
id to `documents show` for the whole text.

A field narrows the hits: `tag:` finds documents with a tag of yours, and `date:` by the last change on the Disk.

```sh
ydisk personal search "budget tag:follow-up"
ydisk personal search "budget date>=30d"
```

## Search by meaning

Search by meaning finds a document that answers a question in other words, such as "what did we agree to spend?"
for a text that says "the budget is approved at 2 million". It uses a text model on your computer, shared by every
WireCat tool. Download the model once with a WireCat tool that has the `models` command, such as
[`wcat`](https://wirecat.dev/en/docs/wcat), then index the copy:

```sh
wcat models download embeddinggemma
ydisk personal sync --embed
ydisk personal search "what did we agree to spend?"
```

The download uses the network. Indexing and search run on your computer. Without the model, word search works as
before.

## Find a file by its name

`catalog` searches the names and types of the files and folders that sync listed, including photos and other files
without text. `catalog import` puts what sync listed into the local store. Run it after a sync:

```sh
ydisk personal catalog import
ydisk personal catalog search "passport"
ydisk personal catalog tree
```

A file outside the chosen folders is found live: `files list --folder /Documents` lists a folder on the Disk.

## Tags and notes

Tags and notes are yours and stay on your computer. The Disk never sees them. They stay with a document when the
file moves.

```sh
ydisk personal tags add 1a2b3c follow-up
ydisk personal notes add 1a2b3c "Signed copy is with Anna"
ydisk personal documents context 1a2b3c
```

The id above is an example. Take a real one from `search` or `documents list`. `documents context` shows a document
with its tags, notes and memories.

## Across your other sources

The copy lives in the local store that the other WireCat tools share. With [`wcat`](https://wirecat.dev/en/docs/wcat),
one search finds a Disk document next to the Telegram chat or the email where it was discussed.

## When search finds nothing

Empty results mean nothing matched in the copy, not that the Disk has no such file. Check, in this order:

1. `ydisk personal folders list`: is the file's folder chosen?
2. `ydisk personal status`: is the sync finished, and is the file listed as kept by name only?
3. Run `ydisk personal sync` if the file is new.
4. Search the name with `catalog search`, or list the folder live with `files list`.

A scanned PDF or a picture is searched by the text OCR read from it. With `read_scans` set to `off`, or with no
`tesseract` installed for the default `local`, only its name is searchable. See
[scans and pictures](usage.md#scans-and-pictures).
