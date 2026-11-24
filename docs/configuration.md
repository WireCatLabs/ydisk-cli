# Settings

Change how `ydisk` behaves for one profile or for all of them: what an agent may change on your Disk, how long run
records are kept, and how search orders its hits. Settings live in one file, `config.json`, in the folder
`ydisk doctor` shows. Each profile has its own part, and `defaults` apply to every profile.

**On this page:**

1. [Permissions](#permissions)
2. [Run records](#run-records)
3. [Other settings](#other-settings)
4. [Environment variables](#environment-variables)

```sh
ydisk personal config show
ydisk personal config set limit 50
ydisk personal config unset limit
```

`config show` lists each setting and where it came from: the file, a variable or the default.

## Permissions

`permissions` decides what a command may do for this profile. Each command has its own key, named after it, such as
`files.move` or `files.upload`, and each key has one of four levels:

| Level | What happens |
| --- | --- |
| `allow` | The command runs. |
| `ask` | At a terminal the tool asks first. Over MCP there is no one to ask, so the command runs. |
| `readonly` | A read runs. A change is refused. |
| `deny` | The command is refused, with exit code 5. |

Two keys guard the changes that are hard to undo. They are `ask` until you change them. The other `files` keys are
`allow`:

| Key | What it guards |
| --- | --- |
| `files.delete` | `files delete`, and an upload, a copy or a move with `--replace`, which overwrites a file. In the `api` group: a delete, emptying the trash, and any overwrite. |
| `files.share` | `files publish` and `files unpublish`: a link anyone who has it can open. In the `api` group: the public-link operations. |

```sh
ydisk personal config set permissions.files.delete deny
ydisk personal config set permissions.files.share deny
ydisk personal config set permissions.files.upload deny
```

An `api` command that does what a `files` command does also checks that command's key: `files.move` set to `deny`
stops `api resources-move` too. `--dry-run` on any change shows each key it checks and its level, without doing the
change.

`YDISK_READ_ONLY=1` refuses every change, whatever the permissions say. For one MCP server only, `--permission
files.delete=deny` makes a key stricter. See [connect your agent](mcp.md#decide-what-the-agent-may-change).

## Run records

A command that fails is kept as a run, for `ydisk runs list` and `runs show`. A command that reaches Yandex Disk, such
as `files list`, `sync` or `session status --check`, is kept when it succeeds too, unless `record` is `false` (then
only failures) or it ran with `--no-record`. `record_input` decides whether a run keeps the words you typed. It is
`true` unless you set it to `false`. Secrets are masked either way. See [Security](security.md).

| Setting | Default | What it does |
| --- | --- | --- |
| `record` | `true` | Keep every run. `false` keeps failed runs only. |
| `record_input` | `true` | Keep the words typed on the command line: `true`, `false`, or `failed`. |
| `keep_runs_for_days` | `30` | Days a run is kept. |
| `keep_successful_runs_for_days` | `7` | Days a successful run is kept. |
| `runs_size_limit_mb` | `200` | The most megabytes all runs may take. |

## Other settings

| Setting | Default | What it does |
| --- | --- | --- |
| `limit` | `20` | How many items a list shows at once. |
| `keep_versions_for_days` | `365` | Days earlier versions of synced files, and the change log, are kept. A sync that finishes its pass drops older ones. A profile or `defaults`. |
| `read_scans` | `local` | Who reads scans and pictures by OCR. `local` uses the `tesseract` program on your computer, which must be installed, for example `sudo apt install tesseract-ocr tesseract-ocr-rus`. `anthropic` or `openai` send each page as a picture to that provider, at the model chosen with `ai set`, and cost per page. `off` keeps them by name only. See [scans and pictures](usage.md#scans-and-pictures). A profile or `defaults`. |
| `search_reranker` | `mmarco` | The model that orders search's first hits, or `off`. |
| `embedding_provider` | `local` | `local` or `openai`: what turns text into vectors for search by meaning. `openai` sends the text to OpenAI. |
| `update_check` | `true` | Check once a day for a newer version. |
| `skill_hint` | `true` | Tell an agent once a day that `skill install` would give it this tool's skill. |

## Environment variables

| Variable | What it does |
| --- | --- |
| `YDISK_PROFILE` | The profile for commands that name none. |
| `YDISK_READ_ONLY` | `1` refuses every change. |
| `YDISK_TOKEN` | A Yandex OAuth token that every profile uses instead of its saved one, for a CI job or a container with no keyring. `session status` then names it as the token's source. |
