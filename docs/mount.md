# Open the Disk as a folder

See your Yandex Disk in your file manager, next to your own folders. Open a PDF in your viewer, play a video,
search a folder with `grep` or point any program at a file, with nothing to download first and nothing to install.
The folder is read-only: no program, script or slip of the hand can change, rename or delete a file on the Disk
through it.

```sh
ydisk personal files serve /Documents
```

**On this page:**

1. [Mount a folder](#mount-a-folder)
2. [Linux](#linux)
3. [macOS](#macos)
4. [Windows](#windows)
5. [Why it is read-only](#why-it-is-read-only)
6. [Who can reach it](#who-can-reach-it)
7. [Speed and limits](#speed-and-limits)

## Mount a folder

Name the profile, then the Disk folder. Leave the folder out to show the whole Disk:

```sh
ydisk personal files serve             # the whole Disk
ydisk personal files serve /Documents  # one folder
ydisk personal files serve /Photos --port 8090
```

The command prints an address such as `http://127.0.0.1:41234/Xy…/` and the way to mount it on your system, then
keeps running. Leave it open while you use the folder. Ctrl-C stops it, and the folder goes away. Each run makes a
new address, so mount it again after a restart. `--port` keeps the port the same between runs; the rest of the
address still changes.

It uses the sign-in you made with `ydisk personal session start`. No other password, no app password and no paid
plan are needed.

## Linux

GNOME Files and the other file managers built on GIO mount it with one command:

```sh
gio mount dav://127.0.0.1:41234/Xy…/
```

The folder then shows in the file manager's side bar, and programs reach it under
`/run/user/$(id -u)/gvfs/dav:host=127.0.0.1,port=…,ssl=false/<secret>/`. A program that writes a file there may
report success, but nothing reaches the Disk: GNOME's layer drops the refusal when the file closes.
`gio mount -u dav://…` unmounts it. In a file manager you can also type the `dav://…` address in "Other Locations" >
"Connect to Server".

## macOS

In Finder, choose Go > Connect to Server (Cmd+K), paste the `http://127.0.0.1:…/` address and press Connect. The
folder appears under Locations and in `/Volumes/`. Eject it as any disk.

## Windows

Windows mounts it with its WebClient service, which `net use` usually starts itself (`sc start webclient` starts it
by hand):

```bat
net use * http://127.0.0.1:41234/Xy…/
```

Windows names the drive letter it chose. `net use Z: /delete` unmounts it. Windows' WebDAV client refuses files
larger than about 50 MB unless its `FileSizeLimitInBytes` setting is raised, as Microsoft's
[WebDAV Redirector](https://learn.microsoft.com/en-us/iis/publish/using-webdav/using-the-webdav-redirector) page
describes.

## Why it is read-only

A writable folder would let any program on your computer, or a mistaken `rm -rf`, delete files on the Disk at once.
[Mirrors](mirrors.md) protect you from that with a trash, earlier versions and a stop on mass deletions; a mounted
folder would go around all of them. So the mount only reads: it answers listing and reading, and refuses saving,
renaming, moving, deleting, new folders and locks. A program that tries to save gets an error, and the Disk is not
touched.

To change files, use `ydisk personal files …` or a [mirror](mirrors.md).

## Who can reach it

- It listens on 127.0.0.1, this computer only. Nothing on your network or the internet can reach it.
- The address holds a random secret, new on each run. A program on this computer that does not have the address gets
  "not found". Treat the address as you would a password while the command runs.
- A web page cannot reach it, even one that tricks the browser into calling 127.0.0.1: requests that name another
  site are refused.
- The address holds no token. Your Yandex sign-in stays in the keyring and is sent only to Yandex's API.
- Agents never get `files serve` over MCP: it runs until it is stopped, and an agent's call must end.
- A profile whose `files.download` is set to `deny` cannot mount either, because a mount reads every file it shows.

## Speed and limits

- A folder's listing is kept for 10 seconds, so a file manager that looks at a folder many times asks the Disk once.
  A file changed on the Disk shows up after that.
- Opening a file reads it from the Disk. A video player or a viewer that jumps around a big file may wait while the
  file is read from its start.
- A folder with more than 10,000 entries shows its first 10,000, sorted by name, and the command warns.
- Each listing counts against the same pace as the other `ydisk` commands of the profile. When Yandex asks to slow
  down, the file manager gets "service unavailable" for a moment, and the command keeps running.

### Why not Yandex's own WebDAV

Yandex runs a WebDAV server at `webdav.yandex.ru`, but its
[documentation](https://yandex.ru/dev/disk/doc/ru/concepts/quickstart) says it works only with a Yandex 360 plan, and
a file manager signs in to it with an app password, which can also write and delete. `files serve` works on any plan,
uses the sign-in you already have, and cannot write.
