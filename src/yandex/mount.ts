import { posix } from "node:path"
import { CliError } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import type { ByteRange, MountEntry, MountSource } from "@wirecat/cli-core"
import * as v from "valibot"
import { type DiskFile, diskPath, diskSource, isFolder, PAGE } from "./source.js"
import type { Transport } from "./transport.js"

const Link = v.object({ href: v.string() })
/** The documentation gives a download link "a limited lifetime" and no number; a link older than this is asked again. */
const LINK_MS = 60_000
const MOST_LINKS = 500
/** Each page of 200 counts against the profile's pace, so a folder larger than this shows its first entries only. */
export const MOST_SHOWN = 10_000

const entryOf = (file: DiskFile): MountEntry => ({
  name: file.name,
  folder: isFolder(file),
  ...(file.size === undefined ? {} : { size: file.size }),
  ...(file.modifiedAt ? { modifiedAt: file.modifiedAt } : {}),
  ...(file.createdAt ? { createdAt: file.createdAt } : {}),
  ...(isFolder(file) ? {} : { mime: file.mime }),
  ...(file.version ? { version: file.version } : {}),
})

const rangeHeader = (range?: ByteRange): Record<string, string> =>
  range ? { range: `bytes=${range.start}-${range.end}` } : {}

/**
 * A Disk folder for cli-core's read-only mount. It reads through the REST API with the profile's OAuth token, the one
 * `session start` keeps; the bytes come from the download link, which never gets the token.
 */
export const diskMount = (options: {
  api: Transport
  links: FetchLike
  /** The mounted folder, as `diskPath` gives it. */
  root: string
  signal?: AbortSignal | undefined
  now?: () => number
  onTruncated?: (path: string) => void
}): MountSource => {
  const { api, links, root, signal, now = Date.now } = options
  const source = diskSource(api, links, signal)
  const at = (path: string) => diskPath(posix.join(root.replace(/^disk:/u, ""), path))
  const hrefs = new Map<string, { href: string; at: number }>()

  const linkOf = async (key: string, path: string) => {
    const known = hrefs.get(key)
    if (known && now() - known.at < LINK_MS) return { href: known.href, fresh: false }
    const { href } = await api.send({ method: "GET", path: "disk/resources/download", query: { path: at(path) } }, Link)
    if (hrefs.size >= MOST_LINKS) hrefs.delete(hrefs.keys().next().value as string)
    hrefs.set(key, { href, at: now() })
    return { href, fresh: true }
  }
  const fetchFrom = (href: string, range?: ByteRange) =>
    links(href, { redirect: "follow", headers: rangeHeader(range), ...(signal ? { signal } : {}) })

  return {
    stat: async (path) => entryOf(await source.byPath(at(path))),
    list: async (path) => {
      const entries: MountEntry[] = []
      for (let offset = 0; ; offset += PAGE) {
        const one = await source.page(at(path), offset)
        for (const file of one.files) entries.push(entryOf(file))
        if (!one.more) return entries
        if (entries.length >= MOST_SHOWN) {
          options.onTruncated?.(at(path))
          return entries
        }
      }
    },
    read: async (path, entry, range) => {
      const key = `${path}\n${entry.version ?? ""}`
      const link = await linkOf(key, path)
      let response = await fetchFrom(link.href, range)
      // A kept link may have run out; a new one is asked once.
      if (!link.fresh && [403, 404, 410].includes(response.status)) {
        hrefs.delete(key)
        response = await fetchFrom((await linkOf(key, path)).href, range)
      }
      if (!response.ok || !response.body)
        throw new CliError(
          response.status === 404 ? "not_found" : "provider_error",
          "the Yandex Disk download failed",
          {
            status: response.status,
          },
        )
      const ranged =
        range !== undefined &&
        response.status === 206 &&
        (response.headers.get("content-range") ?? "").startsWith(`bytes ${range.start}-${range.end}/`)
      if (response.status === 206 && !ranged) {
        await response.body.cancel()
        throw new CliError("provider_error", "the Yandex Disk download answered another part of the file")
      }
      return { body: response.body as ReadableStream<Uint8Array>, ranged }
    },
  }
}
