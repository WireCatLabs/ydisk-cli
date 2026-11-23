import { createWriteStream, openAsBlob } from "node:fs"
import { posix } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream } from "node:stream/web"
import { setTimeout as sleep } from "node:timers/promises"
import { CliError, isCliError } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { type Expect, type FileTarget, type RemoteFile, skippedName } from "@wirecat/cli-core/documents"
import * as v from "valibot"
import { SERVICE } from "../identity.js"
import { PAGE } from "./source.js"
import type { Transport } from "./transport.js"
import { diskWrites } from "./writes.js"

// The fields a mirror reads; Yandex sends them on every file by default
// (https://yandex.ru/dev/disk-api/doc/en/reference/response-objects). No `fields` filter: one spelled wrong would
// drop sha256 on the real Disk while the fake still sent it.
const Resource = v.object({
  path: v.string(),
  type: v.picklist(["dir", "file"]),
  resource_id: v.string(),
  modified: v.optional(v.string()),
  size: v.optional(v.number()),
  md5: v.optional(v.string()),
  sha256: v.optional(v.string()),
})
type Resource = v.InferOutput<typeof Resource>
const Listing = v.object({
  ...Resource.entries,
  _embedded: v.optional(v.object({ items: v.array(Resource), total: v.optional(v.number()) })),
})
const FlatList = v.object({ items: v.array(Resource) })
const Link = v.object({ href: v.string() })
const User = v.object({ user: v.object({ uid: v.string() }) })
const Revision = v.object({ revision: v.number() })
const Operation = v.object({ status: v.string() })

/** How long an upload the Disk answered 202 is waited for, polling its operation from 250 ms up to 5 s apart. */
const UPLOAD_WAIT_MS = 120_000

/**
 * A mirror holds at most this many files, excluded ones not counted; past it the listing is incomplete and proves no
 * deletion. Its state is about 300 bytes a file, so 100,000 files keep a 30 MB state.
 */
export const MAX_MIRROR_FILES = 100_000
/**
 * Files asked for per page of the flat listing. Yandex documents no maximum (https://yandex.ru/dev/disk-api/doc/ru/
 * reference/all-files), so the offset moves by what a page returned and only an empty page ends the listing.
 */
const FLAT_PAGE = 1_000
/**
 * A page of the flat listing may take this long: one of 1,000 took Yandex more than 30 s on 2026-11-21. The run's
 * stop before its deadline still ends it.
 */
const FLAT_PAGE_MS = 120_000
const ROOT = "disk:/"

const statusOf = (error: unknown) => (isCliError(error) ? error.details?.status : undefined)

const changed = (path: string) =>
  new CliError("conflict", `the ${SERVICE} file ${path} is not the one the sync listed`, {
    reason: "mirror.remote-changed",
  })
const unproven = (path: string) =>
  new CliError("conflict", `${SERVICE} gives no hash for ${path}, so the sync cannot prove it is the file it listed`, {
    reason: "mirror.remote-changed",
  })

/**
 * Yandex Disk as the file mirror's remote (cli-core `FileTarget`). Paths are the API's own, `disk:/Notes/a.md`. The
 * API has no conditional write, so a replace reads the file just before it and an upload keeps the `resource_id`
 * (checked live, scripts/live.sh); a delete passes the expected md5, which the Disk itself checks (HTTP 409).
 */
export const diskTarget = (api: Transport, links: FetchLike, signal?: AbortSignal): FileTarget => {
  const writes = diskWrites(api, links, signal)
  const read = async (path: string) => {
    try {
      return await api.send({ method: "GET", path: "disk/resources", query: { path, limit: 0 } }, Listing)
    } catch (error) {
      if (isCliError(error) && error.code === "not_found") return undefined
      throw error
    }
  }
  const remoteFile = (resource: Resource, root: string): RemoteFile => {
    const modified = resource.modified === undefined ? Number.NaN : Date.parse(resource.modified)
    return {
      path: resource.path.slice(root.length),
      id: resource.resource_id,
      size: resource.size ?? 0,
      ...(resource.sha256 ? { sha256: resource.sha256 } : {}),
      ...(resource.md5 ? { md5: resource.md5 } : {}),
      modifiedAt: Number.isNaN(modified) ? new Date(0).toISOString() : new Date(modified).toISOString(),
    }
  }
  const prefixOf = (root: string) => (root.endsWith("/") ? root : `${root}/`)
  /**
   * The file as it is now, checked against what the sync listed; refuses with `conflict` when it is not, or when no
   * hash on both sides can show that it is.
   */
  const check = async (path: string, expect: Exclude<Expect, { absent: true }>) => {
    const now = await read(path)
    if (now?.type !== "file") throw changed(path)
    if (now.sha256 !== undefined) {
      if (now.sha256 !== expect.sha256) throw changed(path)
    } else if (now.md5 === undefined || expect.md5 === undefined) throw unproven(path)
    else if (now.md5 !== expect.md5) throw changed(path)
    return now
  }
  const revisionOf = async () =>
    (await api.send({ method: "GET", path: "disk", query: { fields: "revision" } }, Revision)).revision

  /**
   * A failed page leaves the listing incomplete; a refused token or the rate limit ends the sync. A stop (`stop`, the
   * engine's signal, which fires before the run's deadline) ends the listing incomplete, so it proves no deletion.
   */
  const fatal = (error: unknown) =>
    !isCliError(error) || ["authentication_error", "cancelled", "rate_limited"].includes(error.code)

  /**
   * Every file under `top`, by offset pages: an entry that moves while the pages are read can be missed, so the
   * engine checks each file missing from it by its path before it deletes anything.
   */
  const walk = async (top: Resource, excluded: (path: string) => boolean, stop?: AbortSignal) => {
    const prefix = prefixOf(top.path)
    const files: RemoteFile[] = []
    let counted = 0
    const folders = [top.path]
    while (folders.length) {
      const folder = folders.shift() as string
      for (let offset = 0; ; offset += PAGE) {
        if (stop?.aborted) return { files, complete: false }
        let answer: v.InferOutput<typeof Listing>
        try {
          answer = await api.send(
            {
              method: "GET",
              path: "disk/resources",
              query: { path: folder, limit: PAGE, offset, sort: "name" },
              ...(stop ? { signal: stop } : {}),
            },
            Listing,
          )
        } catch (error) {
          if (stop?.aborted) return { files, complete: false }
          if (fatal(error)) throw error
          return { files, complete: false }
        }
        const items = answer._embedded?.items ?? []
        for (const item of items) {
          if (skippedName(posix.basename(item.path))) continue
          if (item.type === "dir") folders.push(item.path)
          else {
            const file = remoteFile(item, prefix)
            files.push(file)
            if (!excluded(file.path)) counted++
          }
        }
        if (counted > MAX_MIRROR_FILES) return { files, complete: false }
        if (items.length < PAGE || (answer._embedded?.total ?? Number.POSITIVE_INFINITY) <= offset + PAGE) break
      }
    }
    return { files, complete: true }
  }

  /**
   * Every file on the Disk from its flat, alphabetical listing: one request per thousand files instead of one per
   * folder. A file met twice, as a page shifts while the Disk changes, is kept once. A listing a stop or a failed page
   * cut short answers `next`, its offset, and the next run goes on from there (`from`); one past the cap answers none,
   * since the engine starts such a listing over.
   */
  const flat = async (excluded: (path: string) => boolean, stop?: AbortSignal, from?: string) => {
    const found = new Map<string, RemoteFile>()
    let counted = 0
    let offset = from === undefined ? 0 : Number(from)
    // A saved position this code did not write lists from the start rather than from a guess.
    if (!Number.isSafeInteger(offset) || offset < 0) offset = 0
    const listing = (complete: boolean, next?: number) => ({
      files: [...found.values()],
      complete,
      ...(next === undefined ? {} : { next: String(next) }),
    })
    for (;;) {
      if (stop?.aborted) return listing(false, offset)
      let items: Resource[]
      try {
        const page = {
          method: "GET" as const,
          path: "disk/resources/files",
          query: { limit: FLAT_PAGE, offset },
          timeoutMs: FLAT_PAGE_MS,
          ...(stop ? { signal: stop } : {}),
        }
        items = (await api.send(page, FlatList)).items
      } catch (error) {
        if (stop?.aborted) return listing(false, offset)
        if (fatal(error)) throw error
        return listing(false, offset)
      }
      if (!items.length) return listing(true)
      offset += items.length
      for (const item of items) {
        const file = remoteFile(item, ROOT)
        if (item.type !== "file" || found.has(file.path) || file.path.split("/").some(skippedName)) continue
        found.set(file.path, file)
        if (!excluded(file.path) && ++counted > MAX_MIRROR_FILES) return listing(false)
      }
    }
  }

  /** Waits for an upload the Disk took with 202 to land, so the read after it sees the new file. */
  const landed = async (path: string, operation: string) => {
    const until = Date.now() + UPLOAD_WAIT_MS
    for (let pause = 250; ; pause = Math.min(pause * 2, 5_000)) {
      const { status } = await api.send({ method: "GET", path: `disk/operations/${operation}` }, Operation)
      if (status === "success") return
      if (status === "failed") throw new CliError("provider_error", `${SERVICE} could not store the upload of ${path}`)
      if (Date.now() + pause > until)
        throw new CliError("outcome_unknown", `${SERVICE} is still storing ${path}; the next sync checks it`, {
          retryable: false,
        })
      await sleep(pause, undefined, signal ? { signal } : {})
    }
  }

  const ensureFolder = async (path: string): Promise<void> => {
    try {
      await writes.createFolder(path)
    } catch (error) {
      if (statusOf(error) !== 409) throw error
      const there = await read(path)
      if (there?.type === "dir") return
      if (there) throw new CliError("conflict", `${path} is a file on ${SERVICE}, not a folder`)
      // 409 with nothing at the path: its parent is missing.
      const parent = `disk:${posix.dirname(path.replace(/^disk:/u, ""))}`
      if (parent === path) throw error
      await ensureFolder(parent)
      await writes.createFolder(path)
    }
  }

  return {
    identity: async () => (await api.send({ method: "GET", path: "disk", query: { fields: "user" } }, User)).user.uid,

    list: async (root, stop, options) => {
      const top = await read(root)
      if (!top) return undefined
      if (top.type !== "dir")
        throw new CliError("validation_error", `${root} is a file on ${SERVICE}, not a folder`, {
          reason: "mirror.not-folder",
        })
      const excluded = options?.excluded ?? (() => false)
      // A folder's own listing keeps no position: it walks a queue of folders, and starts again each run.
      const listed = top.path === ROOT ? await flat(excluded, stop, options?.from) : await walk(top, excluded, stop)
      return { rootId: top.resource_id, ...listed }
    },

    exists: async (path) => (await read(path)) !== undefined,

    download: async (path, into) => {
      const { href } = await api.send({ method: "GET", path: "disk/resources/download", query: { path } }, Link)
      // The link carries its own grant; linkFetch refuses to send the token there.
      const response = await links(href, { redirect: "follow", ...(signal ? { signal } : {}) })
      if (!response.ok || !response.body)
        throw new CliError(response.status === 404 ? "not_found" : "provider_error", `the ${SERVICE} download failed`, {
          status: response.status,
        })
      await pipeline(
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
        createWriteStream(into, { flags: "wx" }),
      )
    },

    upload: async (path, from, expect) => {
      // A new file asks for its upload link with overwrite=false, and the Disk refuses the link (409) when a file is
      // there by then; nothing checks one created between the link and the bytes. A replace is checked by the read
      // just before it.
      if (!("absent" in expect)) await check(path, expect)
      let sent: Awaited<ReturnType<typeof writes.upload>>
      try {
        sent = await writes.upload(path, await openAsBlob(from), !("absent" in expect))
      } catch (error) {
        if (statusOf(error) === 409) throw changed(path)
        throw error
      }
      if (sent.status === "in-progress") await landed(path, sent.disk_operation)
      const now = await read(path)
      if (!now) throw new CliError("outcome_unknown", `${SERVICE} does not list the file it took`)
      return remoteFile(now, prefixOf(posix.dirname(now.path)))
    },

    trash: async (path, expect) => {
      const md5 = expect.md5 ?? (await check(path, expect)).md5
      // Without an md5 the Disk would trash whatever is at the path now.
      if (md5 === undefined) throw unproven(path)
      try {
        await writes.trash(path, md5)
      } catch (error) {
        if (statusOf(error) === 409) throw changed(path)
        throw error
      }
    },

    ensureFolder: (path) => ensureFolder(path),

    revision: async () => String(await revisionOf()),
  }
}
