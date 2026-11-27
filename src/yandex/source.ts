import { createHash } from "node:crypto"
import { posix } from "node:path"
import { CliError } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import {
  attachmentMaxBytes,
  type FeedlessDocumentSource,
  fileText,
  readableFile,
  type SourceContent,
  type SourceFile,
  sizeText,
} from "@wirecat/cli-core/documents"
import * as v from "valibot"
import { IDENTITY } from "../identity.js"
import type { Transport } from "./transport.js"

export const FOLDER = "inode/directory"

export interface DiskFile extends SourceFile {
  providerMetadata: { path: string; md5?: string; sha256?: string }
}

// Only the fields the source reads; Yandex sends more (https://yandex.ru/dev/disk-api/doc/en/reference/response-objects).
const Resource = v.object({
  path: v.string(),
  name: v.string(),
  type: v.picklist(["dir", "file"]),
  resource_id: v.string(),
  created: v.optional(v.string()),
  modified: v.optional(v.string()),
  size: v.optional(v.number()),
  mime_type: v.optional(v.string()),
  md5: v.optional(v.string()),
  sha256: v.optional(v.string()),
  revision: v.optional(v.number()),
})
type Resource = v.InferOutput<typeof Resource>
const Listing = v.object({
  ...Resource.entries,
  _embedded: v.optional(
    v.object({ items: v.array(Resource), total: v.optional(v.number()), offset: v.optional(v.number()) }),
  ),
})
const Disk = v.object({
  user: v.object({ uid: v.string(), login: v.optional(v.string()), display_name: v.optional(v.string()) }),
})
const Link = v.object({ href: v.string() })

/** One listing page; the API's default is 20. */
export const PAGE = 200
/** One folder is read whole by `children`; past this many entries it is too large for one step. */
const MOST_CHILDREN = 10_000

/** A path in the trash as the API takes it: `trash:/old.pdf`, from `trash:/old.pdf`, `/old.pdf` or `old.pdf`. */
export const trashPath = (input: string) => diskPath(input.replace(/^trash:/u, "")).replace(/^disk:/u, "trash:")

/** A path as the API takes it: `disk:/Docs`, from `/Docs`, `Docs` or `disk:/Docs`. */
export const diskPath = (input: string) => {
  const bare = input.replace(/^disk:/u, "").trim()
  const absolute = posix.normalize(bare.startsWith("/") ? bare : `/${bare}`)
  return `disk:${absolute.length > 1 ? absolute.replace(/\/$/u, "") : absolute}`
}

const webUrl = (path: string, folder: boolean) => {
  const dir = folder ? path : posix.dirname(path.replace(/^disk:/u, "")) || "/"
  const shown = dir.replace(/^disk:/u, "")
  return `https://disk.yandex.ru/client/disk${shown === "/" ? "" : shown.split("/").map(encodeURIComponent).join("/")}`
}

/**
 * Yandex sends a time with an offset, `2026-01-02T03:00:00+03:00`; it leaves as UTC ending in `Z` (WC-TIME-2). A time
 * that does not parse is left out rather than guessed.
 */
const utc = (value: string | undefined) => {
  const ms = value === undefined ? Number.NaN : Date.parse(value)
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString()
}

const fileOf = (resource: Resource, parents: string[]): DiskFile => {
  const folder = resource.type === "dir"
  const modifiedAt = utc(resource.modified)
  const createdAt = utc(resource.created)
  return {
    id: resource.resource_id,
    name: resource.name || "Disk",
    mime: folder ? FOLDER : (resource.mime_type ?? "application/octet-stream"),
    parents,
    // md5 changes with the content; a folder has none, and its revision moves with any change below it.
    ...(resource.md5 ? { version: resource.md5 } : {}),
    ...(modifiedAt ? { modifiedAt } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(resource.size === undefined ? {} : { size: resource.size }),
    url: webUrl(resource.path, folder),
    trashed: false,
    canDownload: !folder,
    providerMetadata: {
      path: resource.path,
      ...(resource.md5 ? { md5: resource.md5 } : {}),
      ...(resource.sha256 ? { sha256: resource.sha256 } : {}),
    },
  }
}

export const isFolder = (file: SourceFile) => file.mime === FOLDER

/** Why a file is kept by name only; undefined when its text is read. */
export const skipReason = (file: SourceFile, env: NodeJS.ProcessEnv = process.env) => {
  const max = attachmentMaxBytes(env)
  return !readableFile(file)
    ? `unsupported type: ${file.mime}`
    : (file.size ?? 0) > max
      ? `file is larger than ${sizeText(max)}; configure MESSAGING_ATTACHMENT_MAX_MIB`
      : undefined
}

const pathOf = (id: string, known?: DiskFile) => {
  const path = known?.providerMetadata.path
  // The API takes a path, never a resource_id: an id the sync has not listed cannot be read.
  if (known?.id !== id || !path)
    throw new CliError("not_found", "Yandex Disk finds a file by its path; this one was not listed by a sync", {
      reason: "document.not-found",
    })
  return path
}

/**
 * Yandex Disk as a documents source. Files are addressed by path; their id is the stable `resource_id`, which keeps
 * a moved file's tags and notes. There is no change feed (https://yandex.ru/dev/disk-api/doc/en/llms.txt lists none),
 * so each sync walks the chosen folders in full.
 */
export const diskSource = (
  api: Transport,
  links: FetchLike,
  signal?: AbortSignal,
): FeedlessDocumentSource<DiskFile> & {
  download(id: string, file?: DiskFile): Promise<Response>
  account(): Promise<{ id: string; login: string | null; name: string | null }>
  byPath(path: string): Promise<DiskFile>
  page(path: string, offset: number): Promise<{ folder: DiskFile; files: DiskFile[]; more: boolean }>
} => {
  const page = async (path: string, offset: number) => {
    const answer = await api.send(
      { method: "GET", path: "disk/resources", query: { path, limit: PAGE, offset, sort: "name" } },
      Listing,
    )
    const folder = fileOf(answer, [])
    const items = answer._embedded?.items ?? []
    return {
      folder,
      files: items.map((item) => fileOf(item, [folder.id])),
      more: items.length === PAGE && (answer._embedded?.total ?? Number.POSITIVE_INFINITY) > offset + PAGE,
    }
  }
  const byPath = async (path: string) => {
    const answer = await api.send({ method: "GET", path: "disk/resources", query: { path, limit: 0 } }, Listing)
    return fileOf(answer, [])
  }
  const metadata = async (id: string, known?: DiskFile) => {
    const found = await byPath(pathOf(id, known))
    // Another file now at the old path is not this one.
    if (found.id !== id)
      throw new CliError("not_found", "the file is no longer at the path the last sync saw", {
        reason: "document.not-found",
      })
    return { ...found, parents: known?.parents ?? [] }
  }
  const download = async (id: string, file?: DiskFile) => {
    const { href } = await api.send(
      { method: "GET", path: "disk/resources/download", query: { path: pathOf(id, file) } },
      Link,
    )
    // The link carries its own grant; linkFetch refuses to send the token there.
    const response = await links(href, { redirect: "follow", ...(signal ? { signal } : {}) })
    if (!response.ok)
      throw new CliError(response.status === 404 ? "not_found" : "provider_error", "the Yandex Disk download failed", {
        status: response.status,
      })
    return response
  }
  const bytes = async (id: string, file?: DiskFile) => {
    const read = new Uint8Array(await (await download(id, file)).arrayBuffer())
    // Bytes other than the listed ones (the file edited, or another put at its path, since the listing) are not
    // saved; the error is retryable, so the sync keeps the copy it has and reads the file again next time.
    const md5 = file?.providerMetadata.md5
    if (md5 && createHash("md5").update(read).digest("hex") !== md5)
      throw new CliError("provider_error", "the file at this path changed since the sync listed it", {
        retryable: true,
      })
    return read
  }
  const user = async () => (await api.send({ method: "GET", path: "disk", query: { fields: "user" } }, Disk)).user
  return {
    // One folder's listing can take seconds; four at a time stay inside the transport's pace of 120 requests a minute.
    parallelListings: 4,
    download,
    account: async () => {
      const { uid, login, display_name } = await user()
      return { id: uid, login: login ?? null, name: display_name ?? null }
    },
    byPath,
    page,
    identity: async () => (await user()).uid,
    metadata,
    children: async (id, folder) => {
      const path = pathOf(id, folder)
      const files: DiskFile[] = []
      for (let offset = 0; ; offset += PAGE) {
        const one = await page(path, offset)
        for (const file of one.files) files.push({ ...file, parents: [id] })
        if (!one.more) return files
        if (files.length >= MOST_CHILDREN)
          throw new CliError("provider_error", `a folder holds more than ${MOST_CHILDREN} entries`, {
            reason: "listing.too-large",
          })
      }
    },
    childrenPage: async (id, cursor, folder) => {
      const offset = cursor === undefined ? 0 : Number(cursor)
      if (!Number.isSafeInteger(offset) || offset < 0)
        throw new CliError("not_found", "the listing cursor is not a Yandex Disk offset")
      const one = await page(pathOf(id, folder), offset)
      return {
        files: one.files.map((file) => ({ ...file, parents: [id] })),
        ...(one.more ? { cursor: String(offset + PAGE) } : {}),
      }
    },
    content: async (id, maxChars, file): Promise<SourceContent<DiskFile>> => {
      const current = file ?? (await metadata(id, file))
      if (isFolder(current)) throw new CliError("validation_error", "a folder has no text")
      const skipped = skipReason(current)
      if (skipped) return { metadata: current, markdown: "", text: "", tabs: [], notRead: skipped }
      const text = (await fileText(await bytes(id, current), current, IDENTITY.command)).slice(0, maxChars)
      return { metadata: current, markdown: text, text, tabs: [] }
    },
    bytes,
  }
}
