# Install and sign in

Connect your Yandex Disk once, and from then on your AI agent finds any document on it by what it says. Yandex lets a
program use your Disk only with an OAuth token, a key that Yandex gives you for your own account. Getting the token
takes about five minutes, once.

After these steps your Disk is connected under a profile name you choose, and the first search works. You can do it
all in [WireCat Desktop](https://wirecat.dev/en/docs/desktop), an app that installs the tools for you, or in a terminal with npm.

**On this page:**

1. [In WireCat Desktop](#in-wirecat-desktop)
2. [Install the tool](#install-the-tool)
3. [Get a Yandex token](#get-a-yandex-token)
4. [Sign in](#sign-in)
5. [Check that it works](#check-that-it-works)
6. [A computer with no keyring](#a-computer-with-no-keyring)
7. [Update](#update)
8. [Remove](#remove)

## In WireCat Desktop

1. Get a token, as [get a Yandex token](#get-a-yandex-token) shows.
2. On the **Tools** page, click **Install** on the Yandex Disk row.
3. Click **Manage**, type an account name, such as `personal`, and click **Sign in here**.
4. Paste the token. Then choose the folders to copy.

Desktop also gives your AI agents the tool's skill, so the terminal steps are not needed.

## Install the tool

You need Node.js 22.16 or a later 22.x, or 24 or later. Node 23 is not supported. Check your version with
`node --version`, and get Node.js from [nodejs.org](https://nodejs.org/) if it is missing or older.

```sh
npm install -g @wirecat/yandex-disk-cli
ydisk --version
ydisk doctor
```

`doctor` needs no network and opens no keyring. It shows the version, where the settings and the local store live,
the profiles that exist, and whether other users of the computer can read the settings. To try the tool without
installing it, run `npx @wirecat/yandex-disk-cli --help`.

## Get a Yandex token

Yandex gives a token to an app that you register for yourself. The app is only a name and a list of access rights in
your Yandex account. Nothing is published. These steps follow Yandex's own guides:
[register an app for API access](https://yandex.ru/dev/id/doc/en/register-api) and
[the Disk API quick start](https://yandex.ru/dev/disk-api/doc/en/concepts/quickstart). Yandex's pages are in
Russian, so the labels below are given in Russian too.

1. Open [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new/) and sign in to Yandex with the account
   whose Disk you want to use. If Yandex shows a choice of app type, choose **For API access or debugging** («Для
   доступа к API или отладки»).
2. Enter any name for the app («Название вашего сервиса»), such as `My laptop`, and your email («Контактная
   почта»).
3. Under data access («Доступ к данным»), add the Yandex Disk rights the tool needs:
   - `cloud_api:disk.read`, read the whole Disk («Чтение всего Диска»).
   - `cloud_api:disk.info`, read information about the Disk («Доступ к информации о Диске»). The tool uses it to
     check whose token it is.
   - `cloud_api:disk.write`, write anywhere on the Disk («Запись в любом месте на Диске»), for uploads, moves, deletes
     and public links. Leave it out for a token that can only read. Every change then fails.
4. Create the app («Создать приложение»). Its page shows a **ClientID**, a string of letters and digits. Copy it.
5. Open this address in the browser, with your ClientID added at the very end, after `client_id=`:
   `https://oauth.yandex.ru/authorize?response_type=token&client_id=`
6. Yandex asks whether to allow the app access to your Disk. Allow it, and Yandex shows the token on its page. Copy
   it.

Yandex may ask to confirm your identity before it lets you create apps. Without the confirmation it shows a warning
and limits how many apps you can create, which does not stop you here. See
[Yandex's page on it](https://yandex.ru/dev/id/doc/en/confirm-account).

Keep the token like a password. Anyone who has it can use your Disk with the rights you chose.

## Sign in

Choose a profile name for this account, such as `personal`, and sign in under it. The tool asks for the token with
hidden input. Paste it and press Enter.

```sh
ydisk personal session start
```

The tool checks the token with Yandex first, and keeps it only if Yandex accepts it. It is kept in the system keyring
(Keychain on macOS, Credential Manager on Windows, Secret Service on Linux). The token is never a command argument and
never appears in the output or a log.

`session start` also reads the token from stdin, so a script can pipe it in from a password manager. A second account
gets its own profile: `ydisk work session start`.

## Check that it works

```sh
ydisk personal session status --check
ydisk personal folders browse
```

`session status --check` asks Yandex whose token it is and shows the account. `folders browse` lists the folders at
the top of your Disk. Both answer from Yandex, so a working answer means the sign-in is done.

Yandex keeps a token valid for months and extends it while it is used
([Yandex ID](https://yandex.ru/dev/id/doc/en/concepts/ya-oauth-intro)). When Yandex stops accepting it, the commands
fail with exit code 4: get a new token the same way and run `session start` again.

`ydisk personal session end` removes the token from this computer. The token itself stays valid at Yandex: to revoke
it, open [Data access](https://id.yandex.ru/personal/data-access) in Yandex ID and remove the app the token was issued for. Changing your Yandex password
or "Log out on all devices" also revokes it, together with every other token of the account
([Yandex ID](https://yandex.ru/dev/id/doc/en/tokens/token-invalidate)).

## A computer with no keyring

On a server or a container without a keyring, the tool keeps the token in a private file only you can read, and says
so. To skip the keyring on purpose:

```sh
ydisk personal session start --credential-storage file
```

## Update

```sh
ydisk upgrade
```

`ydisk upgrade --check` only says whether a newer version exists. After an update, run `ydisk skill install` again so
your agent's instructions match the new version.

## Remove

To forget one account on this computer, remove its profile:

```sh
ydisk personal account remove --keep-data
```

It deletes the profile's token and its settings. Choose what happens to the text it copied: `--keep-data` leaves it
in the store, where search still finds it, and `--delete-data` deletes it together with your list of chosen folders.
Nothing on your Disk changes. At a terminal the command asks first. In a script, `--yes` answers for you, and
`--dry-run` lists what would go without removing it. The token stays valid at Yandex: revoke it in
[Data access](https://id.yandex.ru/personal/data-access) in Yandex ID.

`ydisk personal session end` forgets only the token and keeps the profile. To remove the tool itself:

```sh
npm uninstall -g @wirecat/yandex-disk-cli
```

The settings and the local store stay in the folders `ydisk doctor` showed, for the other WireCat tools that share
the store. Delete them by hand if you no longer need them.

Next: [choose folders and sync them](usage.md).
