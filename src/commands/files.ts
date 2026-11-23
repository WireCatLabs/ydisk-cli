import { randomUUID } from "node:crypto"
import { createWriteStream } from "node:fs"
import { link, rename, rm, stat } from "node:fs/promises"
import { basename, dirname, join, posix } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import {
  commandPath,
  FETCH,
  itemOf,
  listOf,
  nextUsually,
  outputFor,
  ownerOnlyOption,
  REMOTE_READ,
  REMOTE_WRITE,
  renderAnswer,
  writesFileOnlyWith,
} from "@wirecat/cli-core/cli"
import { fileText, fileVersions } from "@wirecat/cli-core/documents"
import { addFileEditCommands, type FileEditCommands, type FileUpdatePort } from "@wirecat/cli-core/documents/cli"
import { guardedWrite, newOperationId, readUpload, uploadBlob } from "@wirecat/cli-core/sends"
import { Command } from "commander"
import { DELETE_KEY, SHARE_KEY } from "../config.js"
import { contextOf, type Disk, diskFor, profileStateDir, tokenOf, withDisk, writeGuard } from "../context.js"
import { IDENTITY } from "../identity.js"
import { type DiskFile, diskPath, PAGE, skipReason, trashPath } from "../yandex/source.js"
import { WORDS } from "./library.js"
import { serveCommand } from "./mount.js"

const CLI = IDENTITY.command

const row = (file: DiskFile) => ({
  id: file.id,
  name: file.name,
  path: file.providerMetadata.path,
  kind: file.mime === "inode/directory" ? "folder" : "file",
  mime: file.mime,
  size: file.size ?? null,
  md5: file.providerMetadata.md5 ?? null,
  sha256: file.providerMetadata.sha256 ?? null,
  modified_at: file.modifiedAt ?? null,
  url: file.url,
})

/**
 * Every write's one path (WC-PERM-13): the profile's level for the command's key and for `extra` refuses or asks
 * once, the send journal records the attempt, and the answer carries the `operation_id` (WC-OUT-10).
 */
const write = async <T extends object>(command: Command, extra: readonly string[], act: (disk: Disk) => Promise<T>) => {
  const context = contextOf(command)
  // Read before any question: a profile with no sign-in fails before the owner is asked anything.
  const token = tokenOf(command)
  const key = commandPath(command).replaceAll(" ", ".")
  const operationId = newOperationId()
  const guard = writeGuard(command, extra)
  const request = { chatId: null, kind: "edit" as const, key, operationId }
  guard.refuse(request)
  try {
    const done = await guardedWrite(guard, request, () => context.run((events) => act(diskFor(command, events, token))))
    return { operation_id: operationId, ...done }
  } catch (error) {
    if (error instanceof CliError && error.code === "outcome_unknown")
      throw new CliError("outcome_unknown", error.message, { ...error.details, operation_id: operationId })
    throw error
  }
}

const written = async (command: Command, extra: readonly string[], act: (disk: Disk) => Promise<object>) =>
  renderAnswer(command, outputFor(command), itemOf(await write(command, extra, act)))

const read = withDisk

const PATH = "Disk path, like /Documents/plan.pdf or disk:/Documents/plan.pdf"

// A live Disk item is no synced document: the store's commands would answer not_found for it.
const listCommand = () =>
  nextUsually(
    annotate(new Command("list"), {
      effects: REMOTE_READ,
      offline: false,
      output: { entity: "disk_item" },
      examples: [`${CLI} personal files list`, `${CLI} personal files list --folder /Documents --json`],
    })
      .description("list what a Disk folder holds, live, a page at a time")
      .option("--folder <folder>", "the Disk folder to list, by its path; the top of the Disk without it")
      .option(
        "--cursor <cursor>",
        "go on from where the last page stopped; page.next_cursor gives it, with the same --folder",
      )
      .action(async function (this: Command, args: { folder?: string; cursor?: string }) {
        const path = diskPath(args.folder ?? "/")
        const offset = args.cursor === undefined ? 0 : Number(args.cursor)
        if (!Number.isSafeInteger(offset) || offset < 0)
          throw new CliError("validation_error", "--cursor takes the value page.next_cursor gave", {
            param: "--cursor",
          })
        const page = await read(this, (disk) => disk.page(path, offset))
        renderAnswer(
          this,
          outputFor(this),
          listOf("files list", {
            items: page.files.map(row),
            limit: PAGE,
            has_more: page.more,
            paging: "cursor",
            ...(page.more ? { cursor: String(offset + PAGE) } : {}),
            args: { folder: path },
          }),
        )
      }),
    { pin: ["files show", "files download"] },
  )

const showCommand = () =>
  nextUsually(
    annotate(new Command("show"), {
      effects: REMOTE_READ,
      offline: false,
      output: { entity: "disk_item" },
      examples: [`${CLI} personal files show /plan.pdf`],
    })
      .description("show one file or folder on the Disk, live")
      .argument("<path>", PATH)
      .action(async function (this: Command, path: string) {
        const file = await read(this, (disk) => disk.byPath(diskPath(path)))
        renderAnswer(this, outputFor(this), itemOf(row(file)))
      }),
    { pin: ["files download"] },
  )

/** The most text a download without --output answers with; the agent asks for a part of a longer file elsewhere. */
const TEXT_LIMIT = 200_000

const downloadCommand = () =>
  writesFileOnlyWith(
    annotate(new Command("download"), {
      effects: FETCH,
      offline: false,
      output: { entity: "disk_item", view: "text" },
      examples: [
        `${CLI} personal files download /notes.md --json`,
        `${CLI} personal files download /plan.pdf --output ./plan.pdf`,
      ],
    })
      .summary("read a Disk file's text, or save the file on this computer")
      .description(
        "read a Disk file's text (PDF, docx, xlsx, CSV, TSV, text, Markdown), or with --output save the file itself; " +
          `the token never goes to the download host. A text longer than ${TEXT_LIMIT.toLocaleString("en")} characters ` +
          "is cut there with truncated: true: never write a cut text back over the file, it would lose the rest",
      )
      .argument("<path>", PATH)
      .addOption(ownerOnlyOption("--output <file>", "save the file here instead of answering its text"))
      .addOption(ownerOnlyOption("--replace", "replace an existing output file")),
    "output",
  ).action(async function (this: Command, path: string, args: { output?: string; replace?: boolean }) {
    const { env } = contextOf(this)
    const { output } = args
    if (output !== undefined) {
      if (!args.replace && (await exists(output)))
        throw new CliError("validation_error", "output file already exists; add --replace or choose another path", {
          param: "--output",
        })
    }
    const answer = await read(this, async (disk) => {
      const file = await disk.byPath(diskPath(path))
      if (file.mime === "inode/directory") throw new CliError("validation_error", "a folder cannot be downloaded")
      if (output === undefined) {
        const reason = skipReason(file)
        if (reason) return { ...row(file), text: null, not_read: reason }
        const bytes = await disk.bytes(file.id, file)
        const text = await fileText(bytes, file, CLI, env)
        const truncated = text.length > TEXT_LIMIT
        // The sha256 promises the whole file: a cut text, or one read out of a PDF, docx or xlsx, written back with
        // files update would replace the file with less (cli-core's RISK-4).
        const whole = !truncated && Buffer.from(bytes).toString("utf8") === text
        return { ...row(file), ...(whole ? {} : { sha256: null }), text: text.slice(0, TEXT_LIMIT), truncated }
      }
      const bytes = await saveTo(output, await disk.download(file.id, file), args.replace === true)
      return { path: file.providerMetadata.path, output, bytes }
    })
    const shown = outputFor(this)
    // A person reading the text view would not see the flag; JSON carries it as truncated: true.
    if ("truncated" in answer && answer.truncated && shown.format !== "json" && shown.format !== "jsonl")
      shown.renderer.warn(`the text is cut at ${TEXT_LIMIT.toLocaleString("en")} characters; do not write it back`)
    renderAnswer(this, shown, itemOf(answer))
  })

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  )

const outputError = (error: unknown) => {
  const code = error instanceof Error && "code" in error ? error.code : undefined
  if (code === "EEXIST")
    return new CliError("validation_error", "output file already exists; add --replace or choose another path", {
      param: "--output",
    })
  if (code === "ENOENT" || code === "ENOTDIR" || code === "EACCES" || code === "EISDIR")
    return new CliError("validation_error", `--output cannot be written there (${code})`, { param: "--output" })
  return error
}

/**
 * Streams the body beside the target and then puts it in place, so a cut download leaves no half file. Without
 * `replace` the file is linked in, which fails if one appeared at the path during the download, instead of a rename
 * that would overwrite it.
 */
const saveTo = async (path: string, response: Response, replace: boolean): Promise<number> => {
  if (!response.body) throw new CliError("invalid_response", "the download answered with no file")
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.part`)
  let size = 0
  try {
    await pipeline(
      // The DOM's ReadableStream type and node's are the same object at run time, but TypeScript keeps them apart.
      Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>),
      async function* (chunks: AsyncIterable<Uint8Array>) {
        for await (const chunk of chunks) {
          size += chunk.length
          yield chunk
        }
      },
      createWriteStream(temporary, { flags: "wx", mode: 0o600 }),
    )
    if (replace) await rename(temporary, path)
    else await link(temporary, path)
    return size
  } catch (error) {
    throw outputError(error)
  } finally {
    await rm(temporary, { force: true })
  }
}

const uploadCommand = () =>
  annotate(new Command("upload"), {
    effects: REMOTE_WRITE,
    offline: false,
    examples: [`${CLI} personal files upload ./plan.pdf --folder /Documents`],
  })
    .summary("put a local file on the Disk")
    .description(
      "put a local file on the Disk; --replace replaces one already there and asks as files.delete does. Credential " +
        "files, browser profiles and the WireCat folders are refused",
    )
    .argument("<file>", "local file to upload")
    .option("--folder <folder>", "the Disk folder to put it in, by its path; the top of the Disk without it")
    .option("--name <name>", "its name on the Disk; the local name without it")
    .option("--replace", "replace a file already at that path")
    .addOption(ownerOnlyOption("--allow-any-file", "send a file from a place that is otherwise refused"))
    .action(async function (
      this: Command,
      local: string,
      args: { folder?: string; name?: string; replace?: boolean; allowAnyFile?: boolean },
    ) {
      const { env } = contextOf(this)
      // A path an agent was talked into naming (an SSH key, a browser profile) is refused here, as messengers do.
      const upload = await readUpload("file", local, { app: IDENTITY, env, anyFile: args.allowAnyFile === true })
      const target = diskPath(
        posix.join(diskPath(args.folder ?? "/").replace(/^disk:/u, ""), args.name ?? basename(local)),
      )
      await written(this, args.replace ? [DELETE_KEY] : [], async (disk) => {
        // Built after the owner answered and before any request: a local file that changed size while the question
        // waited fails here, with nothing sent, instead of during the upload.
        const body = await uploadBlob(upload.source)
        return { path: target, ...(await disk.upload(target, body, args.replace === true)) }
      })
    })

const transfer = (name: "copy" | "move") =>
  annotate(new Command(name), {
    effects: REMOTE_WRITE,
    offline: false,
    examples: [`${CLI} personal files ${name} /plan.pdf --folder /Archive`],
  })
    .summary(`${name} a file or folder on the Disk`)
    .description(
      `${name} a file or folder on the Disk into --folder, under --name or its own; --replace replaces what is there ` +
        "and asks as files.delete does",
    )
    .argument("<path>", PATH)
    .requiredOption("--folder <folder>", "the Disk folder it goes into, by its path")
    .option("--name <name>", "its name there; its own without it")
    .option("--replace", "replace what is already there")
    .action(async function (this: Command, from: string, args: { folder: string; name?: string; replace?: boolean }) {
      const source = diskPath(from)
      const target = diskPath(
        posix.join(
          diskPath(args.folder).replace(/^disk:/u, ""),
          args.name ?? posix.basename(source.replace(/^disk:/u, "")),
        ),
      )
      await written(this, args.replace ? [DELETE_KEY] : [], async (disk) => ({
        from: source,
        path: target,
        ...(await disk.transfer(name, source, target, args.replace === true)),
      }))
    })

/** A write of one path: the command turns the argument into the API's path, then asks the Disk to act on it. */
const simple = (
  name: string,
  description: string,
  {
    example,
    extra = [],
    act,
  }: {
    example: string
    extra?: readonly string[]
    act: (disk: Disk, path: string) => Promise<object>
  },
) =>
  annotate(new Command(name), {
    effects: REMOTE_WRITE,
    offline: false,
    examples: [`${CLI} personal files ${name} ${example}`],
  })
    .description(description)
    .argument("<path>", PATH)
    .action(async function (this: Command, input: string) {
      const path = diskPath(input)
      await written(this, extra, async (disk) => ({ path, ...(await act(disk, path)) }))
    })

/** What `files update`, `sheets`, `documents`, `history` and `restore` keep: one store, so history lists every edit. */
const versionsOf = (command: Command) => fileVersions(join(profileStateDir(command), "files.versions"))

/** The port cli-core's file edits write and read through, for the run `disk` was built in. */
const portOf = (command: Command, disk: Disk): FileUpdatePort => {
  const { signal } = contextOf(command).environment
  return { target: disk.target, versions: versionsOf(command), ...(signal ? { signal } : {}) }
}

/** cli-core's file edits over the Disk; `files` is the group, for the helpers cli-core hands no command. */
const editHelpers = (files: Command): FileEditCommands => ({
  words: WORDS,
  output: (body, command) => renderAnswer(command, outputFor(command), body),
  path: diskPath,
  reread: (input) => `${CLI} ${contextOf(files).profile} files show ${input}`,
  stdin: () => contextOf(files).environment.stdin ?? process.stdin,
  write: (extra, act, command) => write(command, extra, (disk) => act(portOf(command, disk))),
  read: (act, command) => withDisk(command, (disk) => act(portOf(command, disk))),
  restoreFromTrash: (input, command) => {
    const path = trashPath(input)
    return write(command, [], async (disk) => ({ path, ...(await disk.restore(path)) }))
  },
  deleteKey: DELETE_KEY,
})

export const filesCommand = (): Command => {
  const files = annotate(new Command("files"), { effects: REMOTE_READ })
    .description("the files on Yandex Disk, live: list, read, download, upload, change, serve")
    .addCommand(listCommand())
    .addCommand(showCommand())
    .addCommand(downloadCommand())
    .addCommand(uploadCommand())
    .addCommand(transfer("copy"))
    .addCommand(transfer("move"))
    .addCommand(
      simple("create", "create a folder on the Disk at this path", {
        example: "/Documents/Reports",
        act: (disk, path) => disk.createFolder(path),
      }),
    )
    .addCommand(
      simple("delete", "move a file or folder to the Disk's trash; files restore brings it back", {
        example: "/Documents/old.pdf",
        act: (disk, path) => disk.trash(path),
      }),
    )
    .addCommand(
      simple("publish", "open a file or folder to anyone with its public link; asks as files.share does", {
        example: "/Documents/plan.pdf",
        extra: [SHARE_KEY],
        // The owner asked for the link to hand it on; it is answered once and never kept. When it cannot be read
        // back, the key is left out: the link exists, but its address is not known (WC-OUT-13).
        act: async (disk, path) => {
          const done = await disk.publish(path)
          const url = await disk.publicUrl(path)
          return { ...done, ...(url === undefined ? {} : { public_url: url }) }
        },
      }),
    )
    .addCommand(
      simple("unpublish", "close a file's or folder's public link; asks as files.share does", {
        example: "/Documents/plan.pdf",
        extra: [SHARE_KEY],
        act: (disk, path) => disk.unpublish(path),
      }),
    )
    .addCommand(serveCommand())
  addFileEditCommands(files, editHelpers(files))
  return files
}
