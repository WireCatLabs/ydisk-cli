import { CliError, isCliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { listOf, nextUsually, REMOTE_READ } from "@wirecat/cli-core/cli"
import { documentIngestion } from "@wirecat/cli-core/documents"
import { type DocumentWords, documentLibraryCommands } from "@wirecat/cli-core/documents/cli"
import type { Command } from "commander"
import { configuration } from "../config.js"
import { type Disk, diskFor, PACE, tokenOf } from "../context.js"
import { IDENTITY, SERVICE } from "../identity.js"
import { type DiskFile, diskPath, isFolder, PAGE, skipReason } from "../yandex/source.js"

export const PROVIDER = {
  name: "yandex-disk",
  kind: "documents",
  aliases: [],
  command: IDENTITY.command,
  opens: { document: "documents show" },
} as const

export const WORDS: DocumentWords = {
  app: IDENTITY.command,
  remote: "disk",
  provider: SERVICE,
  source: PROVIDER.name,
  text: {
    documents: "read the Yandex Disk files synced to this computer",
    documentsList: "list the synced files with their Disk paths",
    documentArgument: "file id (resource_id) or a search hit's document: ref",
    folders: "choose the Disk folders sync copies",
    folderArgument: "Disk path to add, like /Documents; its id to remove",
    folderToAdd: "/Documents",
    syncLimit: "how many files to read from Yandex Disk in this run",
  },
}

/** Whether a folder holds a folder; null when its first page has none and more pages exist, so it is not known. */
const hasFolders = async (disk: Disk, folder: DiskFile) => {
  try {
    const first = await disk.page(folder.providerMetadata.path, 0)
    return first.files.some(isFolder) ? true : first.more ? null : false
  } catch (error) {
    // One folder the token cannot list, or a busy moment, leaves only its own answer unknown; a refused token ends all.
    if (isCliError(error) && error.code === "authentication_error") throw error
    return null
  }
}

const external = (id: string) => `${id}.md`

/** cli-core's shared documents set over Yandex Disk: folders, sync, status, documents, search, catalog, knowledge. */
export const libraryCommands = (): Command[] =>
  documentLibraryCommands<DiskFile>({
    app: IDENTITY,
    resolveSettings: configuration.resolveSettings,
    provider: PROVIDER,
    words: WORDS,
    service: SERVICE,
    source: (command, events) => diskFor(command, events, tokenOf(command)),
    // cli-core hands back the source that `source` above built, typed only as its documents part.
    folder: (source, input) => (source as Disk).byPath(diskPath(input)),
    folderPath: (file) => file.providerMetadata.path,
    ingestion: (store) =>
      documentIngestion<DiskFile>(store, {
        provider: PROVIDER.name,
        externalId: external,
        catalogInput: (file) => ({
          externalId: external(file.id),
          kind: isFolder(file) ? "folder" : "file",
          name: file.name,
          parents: file.parents.map(external),
          url: file.url,
          mime: file.mime,
          ...(file.createdAt ? { createdAt: file.createdAt } : {}),
          ...(file.modifiedAt ? { modifiedAt: file.modifiedAt } : {}),
          metadata: { path: file.providerMetadata.path },
        }),
        frontMatter: ({ metadata }) => ({
          source: PROVIDER.name,
          sourceUrl: metadata.url,
          resourceId: metadata.id,
          path: metadata.providerMetadata.path,
          modifiedAt: metadata.modifiedAt ?? null,
        }),
      }),
    idOf: (input) => input.trim(),
    isFolder,
    skipReason,
    row: (file, reference) => ({
      id: file.id,
      name: file.name,
      path: file.providerMetadata.path,
      url: file.url,
      size: file.size ?? null,
      modified_at: file.modifiedAt ?? null,
      reference,
    }),
    browse: (folders, tools) => {
      // A browsed folder is chosen with folders add; the store's commands do not know it yet.
      nextUsually(
        annotate(folders.command("browse"), {
          effects: REMOTE_READ,
          offline: false,
          output: { entity: "disk_item", view: "folder" },
          examples: [
            `${IDENTITY.command} personal folders browse`,
            `${IDENTITY.command} personal folders browse --folder /Work --json`,
          ],
        })
          .summary("list Disk folders one level at a time, live, to choose one for folders add")
          .description(
            "list Disk folders one level at a time, live, to choose one for folders add; has_children says whether a " +
              `folder holds a folder, or is null when the level has more than ${PACE.burst} folders and it is not looked up`,
          )
          .option("--folder <folder>", "the Disk folder to list inside, by its path; the top of the Disk without it")
          .option(
            "--cursor <cursor>",
            "go on from where the last page stopped; page.next_cursor gives it, with the same --folder",
          )
          .action(async (args: { folder?: string; cursor?: string }) => {
            const path = diskPath(args.folder ?? "/")
            const offset = args.cursor === undefined ? 0 : Number(args.cursor)
            if (!Number.isSafeInteger(offset) || offset < 0)
              throw new CliError("validation_error", "--cursor takes the value page.next_cursor gave", {
                param: "--cursor",
              })
            const chosen = new Set(tools.roots())
            // The source `source` above built, typed by cli-core only as its documents part.
            const { page, inside } = await tools.withSource(async (source) => {
              const disk = source as Disk
              const level = await disk.page(path, offset)
              const folders = level.files.filter(isFolder)
              // Yandex gives no child count: each folder costs one listing, so a level with more folders than the
              // pace's burst leaves has_children unknown rather than wait on hundreds of requests.
              const inside = new Map<string, boolean | null>()
              if (folders.length <= PACE.burst)
                await Promise.all(folders.map(async (folder) => inside.set(folder.id, await hasFolders(disk, folder))))
              return { page: level, inside }
            })
            tools.output(
              listOf("folders browse", {
                items: page.files.filter(isFolder).map((file) => ({
                  id: file.id,
                  name: file.name,
                  path: file.providerMetadata.path,
                  kind: "folder",
                  has_children: inside.get(file.id) ?? null,
                  added: chosen.has(file.id),
                })),
                limit: PAGE,
                has_more: page.more,
                paging: "cursor",
                ...(page.more ? { cursor: String(offset + PAGE) } : {}),
                args: { folder: path },
              }),
            )
          }),
        { pin: ["folders add"] },
      )
    },
    textLimit: 1_000_000,
    maxEntries: 10_000,
    coverage: "files in the chosen folders: PDF, docx, xlsx, CSV, TSV, text and Markdown are read; others by name",
  })
