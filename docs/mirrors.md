# Keep a folder in step with the Disk

A mirror keeps a folder on your computer and a folder on Yandex Disk the same, both ways. Edit a file in your editor,
and the next sync puts it on the Disk. Change it on the Disk, on your phone or in the browser, and the sync brings it
down. A deleted file goes to a trash, never away, and the version a sync replaces is kept, on either side. A text file
changed on both sides in different places is merged; any other file changed on both sides is never overwritten
without you.

Use a mirror when you work on files with local tools, such as an editor, a script or an agent, and want them on the
Disk too, without installing the Yandex Disk app. The files stay as they are: a PDF stays a PDF, a note stays a
Markdown file. A mirror can also hold your whole Disk, as the Yandex Disk app does, with the folders you choose left
out.

**On this page:**

1. [Connect a folder](#connect-a-folder)
2. [The whole Disk](#the-whole-disk)
3. [Leave folders out](#leave-folders-out)
4. [The first sync](#the-first-sync)
5. [Everyday syncs](#everyday-syncs)
6. [A file changed on both sides](#a-file-changed-on-both-sides)
7. [Deleted or only missing](#deleted-or-only-missing)
8. [Many changes at once](#many-changes-at-once)
9. [Where deleted files go](#where-deleted-files-go)
10. [Earlier versions of a file](#earlier-versions-of-a-file)
11. [A folder that was replaced](#a-folder-that-was-replaced)
12. [Keep syncing in the background](#keep-syncing-in-the-background)
13. [What an agent may do](#what-an-agent-may-do)
14. [What is not synced](#what-is-not-synced)

## Connect a folder

Name the Disk folder first, then the local one:

```sh
ydisk personal mirrors add /Notes ~/notes
```

The tool checks that both are folders and saves the pair. It copies nothing yet. `mirrors list` shows your mirrors
with their ids; the commands below take an id when you have more than one mirror.

Some folders are never mirrored, because a sync would send every file in them to the Disk: your home folder itself,
credential folders such as `~/.ssh`, `~/.gnupg` and the keyrings, browser profiles, the WireCat apps' folders, and
any folder that holds `ydisk`'s own settings or state. `files upload` refuses the same places. Mirror a folder of
its own, such as `~/notes`.

A mirror belongs to the account the profile was signed in to when you added it. A sync signed in to another account
is refused.

## The whole Disk

Name `/` as the Disk folder, and a folder of its own on your computer:

```sh
ydisk personal mirrors add / ~/YandexDisk --ignore Photos --ignore "*.iso"
ydisk personal mirrors preview
ydisk personal mirrors sync
```

The sync reads the whole Disk with Yandex's flat file list, about one request per thousand files. A whole-Disk mirror
works like any other mirror: everything on this page holds for it. Two things matter more on a big Disk:

- **Free space.** Every sync, of any mirror, first adds up what it will download and the earlier versions it will
  keep. It stops with `mirror.no-space` when that would leave too little free on the drive (a tenth of what it
  writes, at least 100 MB and at most 1 GB), and says how much it needs. Leave big folders out to fit. The earlier
  versions stay for 30 days.
- **Size.** A mirror holds up to 100,000 files, not counting the ones you leave out.
- **Time.** One sync runs up to 15 minutes in a terminal and 45 seconds when an agent runs it. It stops before that on
  its own, keeps what it did, and says how far it got. Run `mirrors sync` again to go on: the next run lists the Disk
  from where the last one stopped, not from the start, so a first sync of a big Disk finishes over several runs of
  any length. Each mirror's `listed` shows how many Disk files this run listed (`files`), whether the listing is
  complete, whether it went on from an earlier run (`resumed`), and how many files all the runs have listed so far
  (`so_far`). The files listed so far sync at once; a deletion waits until the whole Disk is listed. A listing cut
  short deletes nothing: the Disk files it did not reach yet are only counted, under `unlisted`. A place kept for more
  than 7 days starts the listing over.

## Leave folders out

An ignored path is left alone on both sides: it is not sent, not brought down and never deleted. Give the paths
when you add the mirror (`--ignore`, repeated), or add more later. `mirrors list` shows the list. `--clear` empties
it first, so `--clear` with `--ignore` keeps only the paths you give: that is how one path stops being ignored.

```sh
ydisk personal mirrors update 1a2b3c4d --ignore Photos --ignore "*.iso"
ydisk personal mirrors update 1a2b3c4d --clear --ignore "*.iso"
```

- A pattern without `/` is a name at any depth: `node_modules`, `*.iso`, `Backups`.
- A pattern with `/` is a path from the mirror's folder: `/Photos` (only the top one), `Work/2019`,
  `Work/**/build`.
- `*` and `?` match within one name. `**` matches any number of folders.

Adding an exclusion deletes nothing on either side, now or later: the files stay where they are and the sync stops
looking at them. Removing an exclusion syncs the path like a new folder: one-sided files are copied, identical files
are taken as synced, and different files are conflicts. Nothing is deleted. `mirrors list` shows each mirror's
exclusions.

A file synced before, then moved on the Disk into an excluded folder, is moved here too, and then left alone. A file
moved here into an excluded folder looks deleted to the sync: the Disk's copy goes to the Disk's trash.

## The first sync

```sh
ydisk personal mirrors preview
ydisk personal mirrors sync
```

`mirrors preview` lists the Disk folder and shows what the sync would do, and changes nothing. `mirrors sync
--dry-run` shows the permissions the sync checks, without asking the Disk.

On the first sync:

- A file that exists on one side only is copied to the other side.
- A file with the same content on both sides is taken as already synced. Nothing is copied.
- A file with different content on both sides is a conflict. Neither copy is changed; see
  [a file changed on both sides](#a-file-changed-on-both-sides).
- Nothing is deleted.

## Everyday syncs

Each sync compares every file three ways: as it is here now, as it is on the Disk now, and as it was at the last
sync. A file changed on one side is copied to the other. A file changed on both sides to the same content is left
as it is. Files are compared by their SHA-256 hash, so a file that was only touched, with the same content, is not
sent again.

`mirrors status` shows which local files the next sync would send or delete on the Disk. It does not ask the Disk,
so it works offline.

## A file changed on both sides

A text file (`.md`, `.markdown`, `.txt`, `.csv` or `.tsv`, up to 1 MB) that changed here and on the Disk is merged
line by line, as Git merges: your edit of one section and an edit of another section on your phone both land, on
both sides. The answer lists the file under `merged`, and `mirrors preview` shows it as a `merge` step. Two changes
need at least one unchanged line between them. Changes on the same or neighbouring lines are a conflict, because two
edits that read fine alone can read wrong together. A Markdown checklist tick and an edit of the same item's text
still merge. The three contents of every merge (the last sync's, yours and the Disk's) and the result are kept on
this computer for good; [`versions list`](#earlier-versions-of-a-file) names each one's role.

Any other file changed on both sides, and a merge that conflicts, is left alone on both sides and reported under
`conflicts`, with the time and size of each side. The sync then ends with an error, so a script notices. See and
settle each conflict:

```sh
ydisk personal mirrors conflicts list
ydisk personal mirrors conflicts show 1a2b3c4d notes/plan.md
ydisk personal mirrors conflicts resolve 1a2b3c4d notes/plan.md --keep disk
ydisk personal mirrors conflicts resolve 1a2b3c4d notes/plan.md --file ~/plan-final.md
```

`conflicts show` gives the three versions and each stretch of lines that conflicts. Its `merged` is the whole file
with Git's conflict markers: edit it into the final text and give it to `resolve --file`. `resolve` writes one final
content to both sides at once: `--keep local`, `--keep disk`, `--keep both` (the Disk's copy beside yours), or
`--file`. It refuses, with nothing written, when either side changed since the sync found the conflict; sync again
and look at the new conflict. Every replaced version is kept.

You can also settle every conflict of a mirror with the next run:

| Command | What happens |
| --- | --- |
| `mirrors sync --keep local` | Your copy replaces the Disk's. The Disk's is kept as an [earlier version](#earlier-versions-of-a-file). |
| `mirrors sync --keep disk` | The Disk's copy replaces yours. Yours is kept as an [earlier version](#earlier-versions-of-a-file). |
| `mirrors sync --keep both` | The Disk's copy comes down beside yours as `name (conflict 2026-11-19 disk).ext`, and both go to the Disk. |

A file deleted on one side and changed on the other is a conflict too. `--keep` decides it the same way.

## Deleted or only missing

A sync deletes a file on one side only when it can prove you deleted it on the other side. A file counts as deleted
only when all of these hold:

- The last sync saw the file.
- The side where it is missing was read in full. A Disk folder the token cannot read, or more than 100,000 files,
  leaves the listing incomplete.
- On the Disk side, the file is still missing when the sync asks for it by its path, after the listing. A listing
  read page by page can skip a file when something else on the Disk changes meanwhile, as a phone uploading photos
  does all the time. Asking for the file directly cannot skip it, so a file that is only missing from a listing is
  never deleted. This also keeps deletions working on a Disk that never stands still.
- That side's folder is still the same folder: the Disk folder has the same id it had at the first sync, and the
  local folder exists, is the same folder and is not empty. An empty local folder may be a drive that is not
  mounted.

A file that is only missing, for any other reason, is reported under `unknown`, and nothing is deleted for it. A
missing Disk folder stops the whole mirror with an error, and nothing is deleted.

A file renamed or moved on the Disk is renamed here too: the Disk keeps a file's id across a move. A file renamed
here is sent as a new file, and the old name goes to the Disk's trash.

## Many changes at once

A sync stops before it changes anything, on either side, when it would:

- delete more than 10 files, or
- replace more than 50 files that already exist, as an editor rewriting every file or ransomware encrypting the
  folder would.

This holds however big the mirror is. The error names the counts and the exact command that allows them. Check the
list first:

```sh
ydisk personal mirrors preview 1a2b3c4d
ydisk personal mirrors sync 1a2b3c4d --allow-deletions 40 --allow-replacements 120
```

`--allow-deletions` allows up to that many deletions and `--allow-replacements` up to that many replacements, for that
one run. `--replace` allows any number of replacements. A merge counts as a replacement. Each replaced file is kept
as a version first. With more than one mirror, both need the mirror's id, so an approval never
covers another mirror. A stopped mirror does not hold up the others: they sync
as usual. `mirrors watch` reports the stop again at every cycle that syncs the mirror, until you allow the run or put
the files back.

## Where deleted files go

| Deleted on | The sync moves the other side's copy to | How to get it back |
| --- | --- | --- |
| Your computer | The Disk's trash | `ydisk personal files restore trash:/name.ext`, or the trash in the Disk's web page |
| The Disk | `.wirecat-trash/YYYY-MM-DD/` inside the local folder | Move it back; the next sync sends it |

The Disk refuses the deletion when its copy changed after the sync listed it, so a file someone edited a moment ago
is never deleted: it is reported as a conflict instead. The local trash folder is hidden, so it is never synced.

## Earlier versions of a file

Before a sync replaces or deletes a file on your computer, or replaces one on the Disk, it keeps the file's content
in the profile's state folder, outside the mirrored folder. The Disk's old content is downloaded first; when it cannot
be kept, or it changed since the listing, that file is not replaced. A file deleted on the Disk is in the Disk's
trash. The sync also logs every change it makes, both ways.

```sh
ydisk personal mirrors versions list 1a2b3c4d notes/plan.md
ydisk personal mirrors versions restore 1a2b3c4d notes/plan.md <sha256>
```

`versions list` shows each change, oldest first: when, which way, the content's hash before (`old`) and after
(`new`), and which side the old content came from (`from`: `local`, or `remote` for the Disk). A merge, a conflict
and a resolution (`event` `merged`, `conflict` or `resolved`, direction `both`) list their contents under `versions`,
each with its role: `base` (the last sync's), `local`, `remote` (the Disk's) and `result`. `available` says
whether that content is still kept. When the Disk's old content was not kept because the file went to the Disk's
trash, `old_in` is `remote-trash`: restore it from the Disk's trash. `versions restore` puts a kept version back into
the local folder; the file there now is kept first. The next sync sends the restored file to the Disk.

A version stays for 30 days. The last version of a file that was deleted, the contents of every merge and conflict,
and the last synced content of each text file (the next merge's starting point) stay for good. A version from the Disk is
restored into the local folder too, and the next sync sends it back.

## A folder that was replaced

If the Disk folder was deleted and created again, or the local folder is another folder now (a new drive, a folder
restored from a backup), the sync stops with `confirmation_required` and names `--repin`. When the new folder is the
right one:

```sh
ydisk personal mirrors sync 1a2b3c4d --repin
```

The sync records the new folder and runs as a first sync: identical files are taken, one-sided files are copied, and
different files are conflicts. That run deletes nothing.

## Keep syncing in the background

```sh
ydisk personal mirrors watch
```

`watch` syncs at start, then again a few seconds after you save a file, and when the Disk changed. It asks the Disk
for its revision every 60 seconds (`--every` to change it, at least 10 s): one small request, and the folder is read
again only when the revision moved. Stop it with Ctrl-C, or give it a `--timeout`. A mirror the guard stopped (see
[many changes at once](#many-changes-at-once)) is reported at every cycle that syncs it, never skipped in silence.

A replace or a deletion asks for `files.delete` first (see below). A watch left running without a terminal cannot
answer, so start it with `--yes`, or allow `files.delete` for the profile.

## What an agent may do

Each sync write checks the command's own permission, `mirrors.sync` or `mirrors.watch`, and also:

- `files.upload` for each file it puts on the Disk;
- `files.delete` for each file it replaces or moves to a trash, on either side. It asks at a terminal by default,
  once per run.

With `files.delete` set to `deny`, a sync still sends and brings down new files, and lists each replace or deletion
it skipped under `errors`. `YDISK_READ_ONLY=1` refuses a sync; `mirrors preview` and `mirrors status` still work.

Over MCP an agent may run `mirrors list`, `mirrors status`, `mirrors preview`, `mirrors sync` and `mirrors conflicts
list`, `show` and `resolve --keep`, but not `--allow-deletions`, `--allow-replacements`, `--replace`, `--repin` or
`resolve --file`: only you approve many changes at once, and only you give a file from this computer.
`mirrors conflicts resolve` checks the same keys as a sync. Over MCP nobody can
answer a question, so a level at `ask` lets the write through: set `files.delete` to `deny` for an agent that should
not replace or delete files. Adding, changing or removing a mirror, `versions` and `watch` are for you only. See [connect your agent](mcp.md#decide-what-the-agent-may-change).

## What is not synced

- Hidden files and folders (a name starting with `.`), `node_modules`, and editor leftovers (`~$name`, names
  ending in `~`, `.swp` or `.tmp`), on both sides. Such a Disk folder is not even listed.
- Symbolic links. A file under a link is never deleted because of it.
- Paths you [left out](#leave-folders-out).
- A mirror of more than 100,000 files.
- Empty folders.

`mirrors remove <id>` forgets the pair. Nothing on the Disk or in the local folder changes, and the kept versions
stay. Added again later, the pair starts with a first sync.

Next: [requests to try](recipes.md).
