# When something goes wrong

A sign-in that fails, a sync that stops, a search that finds nothing: find your symptom here and fix it in a minute
or two. Every error says what to do in its message, and its exit code tells a script what kind of failure it was.

**On this page:**

1. [First check](#first-check)
2. [By symptom](#by-symptom)
3. [Exit codes](#exit-codes)
4. [If it still fails](#if-it-still-fails)

## First check

```sh
ydisk doctor
ydisk personal doctor --online
```

`doctor` reads no keyring and uses no network. It shows what is set up and any problem with the settings file.
`doctor --online` also asks Yandex whether the profile's token works.

## By symptom

| Symptom | What to do |
| --- | --- |
| `ydisk` is not found | Open a new terminal, and check that npm's global folder is on `PATH`. |
| "name a profile" | Put the profile first, as in `ydisk personal status`, or set `YDISK_PROFILE`. |
| "refused the token", exit code 4 | The token is wrong, revoked or expired. [Get a new token](installation.md#get-a-yandex-token) and run `ydisk personal session start` again. |
| The token may have leaked, or you stopped using `ydisk` | `session end` removes it from this computer only. Revoke it at Yandex: [Data access](https://id.yandex.ru/personal/data-access) in Yandex ID, then remove the app ([security](security.md#revoke-the-token-at-yandex)). |
| A change fails with exit code 5 | The token has no `cloud_api:disk.write` right, or the profile's permissions or `YDISK_READ_ONLY` refuse it. Check [settings](configuration.md#permissions). For the right, register the app again with it and get a new token. |
| "the OS keyring did not answer" on Linux | The session bus restarted. Log out and back in, or sign in with `session start --credential-storage file`. |
| "no such item, or this token cannot see it", exit code 6 | Check the path with `files list --folder` on its parent folder. A Disk path starts with `/`, as in `/Documents/plan.pdf`. |
| "asked to slow down", exit code 8 | Yandex received too many requests from this account. Wait a minute and run the command again. |
| A sync stops before the end | One sync reads up to 200 files. Run `sync` again until `status` shows no pending work. |
| A chosen folder's documents are gone | The folder was renamed or moved on the Disk. Add it again under its new path with `folders add`. |
| Search does not find a file you know is there | See [when search finds nothing](search.md#when-search-finds-nothing). |
| A PDF or a picture is found by name but not by its text | It is larger than 10 GB (`MESSAGING_ATTACHMENT_MAX_MIB` raises it), a scan over 20 pages, or a scan that OCR did not read: `read_scans` is `off`, or `tesseract` is not installed for the default `local` (`sudo apt install tesseract-ocr tesseract-ocr-rus`). `status` lists such files with the reason. See [scans and pictures](usage.md#scans-and-pictures). |
| An upload fails because the Disk is full | Free space on the Disk or empty its trash. A retry does not help until there is room. |
| A large upload is refused | Yandex limits one file's size by plan: 1 GB without a Yandex 360 plan, more with one ([Yandex's limits](https://yandex.ru/support/yandex-360/customers/disk/web/ru/uploading)). |
| A change ended with "outcome_unknown", exit code 14 | Yandex failed during the change, so it may or may not have happened. Check with `files show` before you run it again. |
| An agent changed a file you did not want changed | Over MCP the ask level lets a command run. Deny `files.delete` and `files.share`, or set `YDISK_READ_ONLY=1`. See [connect your agent](mcp.md#decide-what-the-agent-may-change). A deleted file is in the Disk's trash: `files restore`. An edited file's old content is kept here: `files history`, then `files restore <path> <version>`. |
| The settings file does not read | `doctor` lists every problem in the file under `config.issues`. Run the `config unset` each one gives, `config repair`, or fix the file by hand. |
| `doctor` lists `files.problems` | Other users of the computer can read `config.json` or enter its folder. Run each `chmod` that `doctor` prints after "to make it private:". |

## Exit codes

| Code | Meaning |
| --- | --- |
| 2 | The command was given wrong: a missing profile, argument or option. |
| 3 | The settings or the keyring are not usable. |
| 4 | Yandex refused the token. |
| 5 | Not allowed: the token's rights or the profile's permissions. |
| 6 | No such file or folder, or the token cannot see it. |
| 7 | A change needs your confirmation and there was no terminal to ask. |
| 8 | Yandex asked to slow down. |
| 14 | A change may or may not have happened. |

Every code is in the [command reference](commands.md).

## If it still fails

`ydisk runs list` shows the recent runs, and `ydisk runs show` one of them with every step it took. Secrets are
hidden. `ydisk doctor reports create` writes a report file for a bug report and says what it holds. Open an issue at
[github.com/WireCatLabs/ydisk-cli/issues](https://github.com/WireCatLabs/ydisk-cli/issues) with the error code and
the command. Never paste a token or private content into an issue.
