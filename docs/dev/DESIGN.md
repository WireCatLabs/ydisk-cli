# ydisk — design

## Answers

- **Category:** files and documents
- **Content languages:** ru, en.
- **Sign-in:** a Yandex OAuth token pasted on stdin (the owner's decision, 2026-11-17). Yandex ID's PKCE flow needs
  no app secret, but renewing a token does ([refresh](https://yandex.ru/dev/id/doc/en/tokens/refresh-client)), so a
  browser sign-in waits for an OAuth provider in cli-core.
- **Access:** read and write: `cloud_api:disk.read`, `cloud_api:disk.write`, `cloud_api:disk.info`. A pasted token
  carries what its app was registered with; the CLI asks for nothing more.
- **The API:** Yandex's official [Disk REST API](https://yandex.ru/dev/disk-api/doc/en/). Its Swagger 1.2
  description (`https://cloud-api.yandex.net/v1/schema`) generates the `api` group.
- **How people filter:** by time, by folder, by words in the text.
- **Never in the store, a log or the output:** the token; download and upload links (they carry their own grant);
  `public_url` and `public_key` are not kept by the sync.
- **Untrusted input:** file text, file and folder names, links.

## Reference CLI

[drive-cli](https://github.com/WireCatLabs/drive-cli) for the command tree and the words;
[notion-cli](https://github.com/WireCatLabs/notion-cli) for the sign-in by token and the source contracts. Both are
on cli-core's shared documents commands.

| ydisk | drive | Why it differs |
|---|---|---|
| `session start` reads a token | browser OAuth | Yandex renews a token only with an app secret |
| `files show`, `files create`, `files delete` | `files get`, `files mkdir`, `files trash` | the shared vocabulary's verbs; drive keeps its older words in a lint baseline |
| `--folder <path>`, `--name`, `--replace` | `--parent <id>`, `--overwrite` | the vocabulary's flags; the Disk API addresses by path |
| `files publish`, `files unpublish` | `permissions` | the Disk has public links, not per-person sharing |
| `mirrors add <folder> <path>` | `mirrors add <path> --parent <id>` | the Disk addresses a folder by path; the Disk side is `disk` in `--keep` and conflict reports |
| `mirrors versions list\|restore` | — | the whole-file engine keeps replaced versions from both sides; drive's document push merges text instead |
| no `sheets`, `comments`, `revisions` | — | Google-only |

## The source

- **Ids and paths.** Every operation of the API takes a path; none takes the `resource_id` it returns. The sync keeps
  `resource_id` as the document id, so a moved file keeps its tags and notes, and keeps the path in
  `providerMetadata.path`. cli-core passes the file it last listed to `metadata`, `children` and `content`, which read
  the path from it ([cli-core Documents](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/DOCUMENTS.md#a-source-without-a-change-feed)).
- **No change feed.** The API has none, so the source is a `FeedlessDocumentSource`: each sync walks the chosen
  folders in full, reads only files whose MD5 changed, and drops what the finished pass did not find. A chosen
  folder that moved answers 404 and is skipped as unavailable, its copies removed; adding it again under its new
  path brings it back (cli-core 0.690.0 and later).
- **Text** comes from cli-core's `fileText`; folders are walked a page of 200 at a time (`childrenPage`).
- **Links.** Downloads and uploads go through cli-core's `linkFetch` to the hosts in `src/identity.ts`, never with the
  token. The hosts come from Yandex's docs and are confirmed by the owner's live check.
- **Writes** (`files …`) go through the profile's guard and the send journal, and are never retried. An answer 202
  names the Disk's own operation; `api operations-get` follows it.

## Mirrors

Two-way folder sync on cli-core's whole-file engine (`syncFileMirrors`,
[cli-core Documents](https://github.com/WireCatLabs/cli-core/blob/main/docs/dev/DOCUMENTS.md#sync-plain-files-with-a-provider)).
ydisk holds no sync logic: `src/yandex/mirror-target.ts` is the Disk as a `FileTarget`, `src/commands/mirrors.ts`
the commands. Settled on 2026-11-18 by live probes, asserted by `scripts/live.sh`:

- The Disk's `sha256` is the plain sha256 of the content; files are compared by it.
- **Replace = check, then overwrite.** The API has no conditional upload. `upload` reads the file and compares its
  hash with what the listing saw, then asks for a link with `overwrite=true`. A change made in the seconds between
  is lost; in exchange the file keeps its `resource_id`, so tags and notes stay (an overwrite keeps the id, checked
  live). A new file asks with `overwrite=false`, and the Disk refuses one created meanwhile (409).
- **Trash passes the expected md5**: `DELETE ?permanently=false&md5=`, which the Disk refuses with 409 when the
  file changed. Deletions cross sides into both trashes, with the engine's guard: more than 10 deletions needs
  `--allow-deletions N`, more than 50 replacements of existing files `--replace`, however big the
  mirror (owner, 2026-11-19: many deletions are always agreed first). Both flags are owner-only and need the
  mirror's id when the profile has more than one mirror.
- **Renames:** a Disk-side move is found by `resource_id` (kept across a move, checked live) and applied locally. A
  local rename is a deletion and a new file.
- **Watch** polls `GET /v1/disk?fields=revision`, which moves with every write, and lists only when it moved.
- **The listing** walks the folder 200 entries a page without a `fields` filter (one mistyped field would drop
  `sha256` on the real Disk while the fake still sent it). A mirror of the whole Disk (`/`) reads the flat list
  (`GET /v1/disk/resources/files`, alphabetical, `limit` and `offset`, no total and no documented largest page): 1,000
  a page, the offset moved by what each page returned, ended by an empty page, a file met twice kept once. A folder or
  page that fails, or more than 100,000 files not excluded, makes the listing incomplete, so no file is taken as
  deleted. The listing is not walked again when the Disk's revision moves: a phone uploading photos would keep a
  whole Disk from ever standing still. Instead the engine asks for each file missing from the listing by its path
  (`exists`), after the listing, and deletes only what that read does not find.
- **Exclusions** (`--ignore`, `mirrors update --ignore|--clear`, stored as `exclude`) are globs kept on the pair in `mirrors.json`. An excluded
  path is absent by filter, never deleted; adding one trashes nothing, removing one is a first sync for those paths.
- **The local root** is never the home folder or a folder holding it, whatever folders the CLI uses, so a whole-Disk
  mirror goes into a folder of its own.
- **Storage:** `profiles/<profile>/mirrors.json` (the pairs with the account), `mirrors/<id>.json` (the engine's
  state; `add` pins the Disk folder's `resource_id`), `mirrors/<id>.versions/` (kept versions, local and the Disk's) and
  `mirrors/sync.lock`, one lock for sync, watch, restore and remove. `remove` deletes the state, so a pair added
  again starts with a first sync, which deletes nothing.
- **Permissions:** every write runs under `mirrors.sync` or `mirrors.watch`; a file put on the Disk also checks
  `files.upload`, a replace or trash on either side `files.delete`. Each set of keys has its own guard, so a deny on
  `files.delete` still lets new files through, and a key allowed once is not asked again in the run.
- **Preview:** `mirrors preview` runs the engine with `dryRun` and answers the plan. `sync` declares no `--dry-run`
  of its own: cli-core's preview names the permission keys, and the deny contract reads them from it (WC-PERM-22).
- **MCP:** `list`, `status`, `preview` and `sync`. `add`, `remove` and `versions` are `mcp: false`; `watch` is persistent;
  `--allow-deletions` and `--repin` are owner-only options.

## Read-only folder (`files serve`)

- **Read-only, by the owner's choice (2026-11-19).** A writable mount would let any program, or an `rm -rf`, delete
  Disk files and go around the mirrors' proven-deletion rule, versions and mass-deletion guard. Writes are a later,
  separate decision. The source handed to cli-core's mount (`src/yandex/mount.ts`) has no write method, and the server
  refuses every write method.
- **A local WebDAV bridge over the REST API, not Yandex's WebDAV.** `webdav.yandex.ru` works only on a Yandex 360
  plan, and an OS client signs in to it with an app password, which can also write
  ([docs](https://yandex.ru/dev/disk/doc/ru/concepts/quickstart)). The bridge uses the profile's OAuth token, any plan,
  and cannot write. The shared server is cli-core's `@wirecat/cli-core`, so drive and notion can mount the same
  way.
- **`files serve`, not `mount`.** A new root word needs a vocabulary change the owner approves first (WC-CMD-2,
  WC-CMD-4); `serve` is in the vocabulary. It is `lifetime: "persistent"` (WC-CMD-18), so it is never offered over MCP.
  It also checks `files.download`, since it reads every file it shows.
- **Ranges:** Yandex's docs do not say a download link serves a `Range`; it is forwarded, and a 200 answer is passed
  on whole. Download links are kept a minute per file and version.

## Editing files in place (2026-11-23)

- **The edit commands are cli-core's** (`addFileEditCommands`: `files update`, `sheets`, `documents`, `history`,
  `restore`). ydisk gives the write and read paths, the Disk's mirror target as the `FileTarget`, and its trash
  restore as `restoreFromTrash`, so `files restore` keeps the trash form beside the version form.
- **One version store per profile, `<state>/profiles/<profile>/files.versions`**, apart from each mirror's store:
  the edits, the update and the restore keep into it and `history` reads it. It is never inside a mirrored folder.
- **The Disk has no conditional upload.** The target reads the file again just before it sends, so a change landing
  between that read and the upload is not caught. The docs say "the file is checked just before the write and what it
  replaced is kept locally", never that a newer remote cannot be overwritten.
- **`files download` gives a `sha256` only beside the file's whole text:** null when it cut the text, or when the text
  is not the file's bytes read as UTF-8 (a PDF, docx or xlsx, another encoding). cli-core's RISK-4.
- **The whole-Disk listing goes on across runs** (cli-core 0.720): the flat listing's `next` is its offset. A folder's
  listing walks a queue of folders and keeps no place, so a stopped one still asks for a longer run.

## What is hand-written

`src/yandex/` (transport, source, mirror target), `src/commands/{library,files,mirrors,mount}.ts`, `src/context.ts` and the tests with their fakes
(`src/testing/fake-disk.ts`, an in-memory Disk; `src/testing/disk-api.ts`, cli-base's strict fake from the spec).
The documents commands, the sync engine, the store, search and MCP are cli-core's; the `api` group is generated.

## Open questions for the owner

- The download and upload host names (`downloader.disk.yandex.ru`, `*.disk.yandex.net`) are from Yandex's docs; the
  first live check got a link on `mds.storage.yandex.net`, which the docs do not name, so `*.storage.yandex.net` is
  allowed too.
- Yandex documents no rate limit; the pace is 120 requests a minute per profile until a 429 says otherwise.
