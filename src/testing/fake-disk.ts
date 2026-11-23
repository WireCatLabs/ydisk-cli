import { createHash } from "node:crypto"
import { posix } from "node:path"

// A strict fake of the Yandex Disk REST API, from https://yandex.ru/dev/disk-api/doc/en/reference/meta (listing),
// …/content (download link), …/upload (upload link), …/delete, …/create-folder, …/capacity (the disk's revision) and
// …/all-files (the flat listing: every file, alphabetical, `items` with `limit` and `offset`, no total).
// It refuses an unknown path, method or parameter, a call without `OAuth <token>`, and a download or upload that
// carries the token. Visibly fake data only (WC-TEST-8).

/** Spelled so gitleaks lets it through; never a real token. */
export const FAKE_TOKEN = "wirecatfake0token42"

const API = "cloud-api.yandex.net"
const DOWNLOADS = "downloader.disk.yandex.ru"
const UPLOADS = "uploader1.disk.yandex.net"

interface Node {
  path: string
  type: "dir" | "file"
  resource_id: string
  text?: string
  /** The file's content; `text` is it read as UTF-8, for the tests of text files. */
  bytes?: Buffer
  mime_type?: string
  md5?: string
  sha256?: string
  modified: string
}

export interface FakeDisk {
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  nodes: Map<string, Node>
  /** What a delete moved to the trash, by its old Disk path. */
  trash: Map<string, Node>
  calls: { method: string; url: URL; auth: string | null }[]
  refusals: string[]
  put(path: string, text?: string | Uint8Array, mime?: string): string
  remove(path: string): void
  move(from: string, to: string): void
  /** Makes a file answer this status from now on. */
  deny(path: string, status: 403 | 404): void
  /** Runs before each write reaches the fake, as another device's change between a sync's listing and its write. */
  beforeWrite?: (method: string, path: string) => void
  /** Runs before each page of a folder is read, as another device's change in the middle of a listing. */
  beforePage?: (path: string, offset: number) => void
  /** Runs before each page of the flat listing is read. */
  beforeFilesPage?: (offset: number) => void
  /** The flat listing returns at most this many files a page, whatever `limit` asks: Yandex documents no maximum. */
  filesPageCap?: number
  /** Uploads answer 202 and land only once their operation is polled this many times more. */
  acceptUploads?: number
  revision(): number
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const ALLOWED: Record<string, readonly string[]> = {
  "GET /v1/disk": ["fields"],
  "GET /v1/disk/resources": ["path", "limit", "offset", "sort", "fields"],
  "GET /v1/disk/resources/files": ["limit", "offset", "fields", "media_type"],
  "GET /v1/disk/resources/download": ["path"],
  "GET /v1/disk/resources/upload": ["path", "overwrite"],
  "PUT /v1/disk/resources": ["path"],
  "DELETE /v1/disk/resources": ["path", "permanently", "md5"],
}

const hash = (algorithm: "md5" | "sha256", bytes: Buffer) => createHash(algorithm).update(bytes).digest("hex")
const parentOf = (path: string) => `disk:${posix.dirname(path.replace("disk:", ""))}`

export const fakeDisk = (): FakeDisk => {
  let ids = 0
  let revision = 1
  let links = 0
  const nodes = new Map<string, Node>()
  const trash = new Map<string, Node>()
  const uploads = new Map<string, string>()
  const operations = new Map<string, { polls: number; land: () => void }>()
  const denied = new Map<string, 403 | 404>()
  const calls: FakeDisk["calls"] = []
  const refusals: string[] = []
  const at = (path: string, type: Node["type"], content?: string | Uint8Array, mime?: string) => {
    const known = nodes.get(path)
    const bytes = Buffer.from(content ?? "")
    const node: Node = {
      path,
      type,
      resource_id: known?.resource_id ?? `fake-${++ids}`,
      modified: `2026-01-0${(ids % 9) + 1}T00:00:00+00:00`,
      ...(type === "file"
        ? {
            text: bytes.toString("utf8"),
            bytes,
            mime_type: mime ?? known?.mime_type ?? "text/plain",
            md5: hash("md5", bytes),
            sha256: hash("sha256", bytes),
          }
        : {}),
    }
    nodes.set(path, node)
    revision++
    return node.resource_id
  }
  const resource = (node: Node) => ({
    path: node.path,
    name: node.path === "disk:/" ? "disk" : posix.basename(node.path),
    type: node.type,
    resource_id: node.resource_id,
    created: "2026-01-01T00:00:00+00:00",
    modified: node.modified,
    ...(node.type === "file"
      ? {
          size: node.bytes?.length ?? 0,
          mime_type: node.mime_type,
          md5: node.md5,
          sha256: node.sha256,
          revision: 1,
        }
      : {}),
  })
  const childrenOf = (path: string) =>
    [...nodes.values()]
      .filter(
        (node) => node.path !== path && posix.dirname(node.path.replace("disk:", "")) === path.replace("disk:", ""),
      )
      .sort((a, b) => a.path.localeCompare(b.path))
  at("disk:/", "dir")
  const refuse = (why: string) => {
    refusals.push(why)
    return json(400, { error: "FakeRefused", description: why })
  }
  const remove = (path: string) => {
    for (const key of [...nodes.keys()]) if (key === path || key.startsWith(`${path}/`)) nodes.delete(key)
    revision++
  }
  const disk: FakeDisk = {
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      const method = init?.method ?? "GET"
      const auth = new Headers(init?.headers).get("authorization")
      calls.push({ method, url, auth })
      if (url.host === DOWNLOADS) {
        if (auth) return refuse("the download link was sent the token")
        const node = nodes.get(url.searchParams.get("path") ?? "")
        return node?.type === "file" ? new Response(node.bytes ?? "") : json(404, { error: "DiskNotFoundError" })
      }
      if (url.host === UPLOADS) {
        if (auth) return refuse("the upload link was sent the token")
        const path = uploads.get(url.pathname)
        if (method !== "PUT" || !path) return refuse(`no such upload ${url.pathname}`)
        uploads.delete(url.pathname)
        disk.beforeWrite?.("PUT", path)
        const body = new Uint8Array(await new Response(init?.body).arrayBuffer())
        if (disk.acceptUploads === undefined) {
          at(path, "file", body)
          return new Response(null, { status: 201 })
        }
        operations.set(`op-${links}`, { polls: disk.acceptUploads, land: () => at(path, "file", body) })
        return new Response(null, { status: 202 })
      }
      if (url.host !== API) return refuse(`unknown host ${url.host}`)
      if (auth !== `OAuth ${FAKE_TOKEN}`) return json(401, { error: "UnauthorizedError" })
      const operation = url.pathname.match(/^\/v1\/disk\/operations\/([^/]+)$/u)?.[1]
      if (method === "GET" && operation !== undefined) {
        const pending = operations.get(operation)
        if (!pending) return json(404, { error: "DiskNotFoundError" })
        if (pending.polls-- > 0) return json(200, { status: "in-progress" })
        operations.delete(operation)
        pending.land()
        return json(200, { status: "success" })
      }
      const allowed = ALLOWED[`${method} ${url.pathname}`]
      if (!allowed) return refuse(`no such operation ${method} ${url.pathname}`)
      for (const key of url.searchParams.keys()) if (!allowed.includes(key)) return refuse(`unknown parameter ${key}`)
      if (url.pathname === "/v1/disk")
        return url.searchParams.get("fields") === "revision"
          ? json(200, { revision })
          : json(200, { total_space: 1, used_space: 0, user: { uid: "1000", login: "test-person" } })
      if (url.pathname === "/v1/disk/resources/files") {
        const offset = Number(url.searchParams.get("offset") ?? 0)
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), disk.filesPageCap ?? Infinity)
        disk.beforeFilesPage?.(offset)
        const files = [...nodes.values()]
          .filter((node) => node.type === "file")
          .sort((a, b) => a.path.localeCompare(b.path))
        return json(200, { items: files.slice(offset, offset + limit).map(resource), limit, offset })
      }
      const path = url.searchParams.get("path") ?? ""
      const status = denied.get(path)
      if (status) return json(status, { error: status === 403 ? "DiskForbiddenError" : "DiskNotFoundError" })
      if (method !== "GET") disk.beforeWrite?.(method, path)
      const node = nodes.get(path)
      if (url.pathname === "/v1/disk/resources/upload") {
        if (node && url.searchParams.get("overwrite") !== "true")
          return json(409, { error: "DiskResourceAlreadyExistsError" })
        if (nodes.get(parentOf(path))?.type !== "dir") return json(409, { error: "DiskPathDoesntExistsError" })
        const target = `/upload-target/${++links}`
        uploads.set(target, path)
        return json(200, {
          href: `https://${UPLOADS}${target}`,
          method: "PUT",
          templated: false,
          operation_id: `op-${links}`,
        })
      }
      if (method === "PUT") {
        if (node) return json(409, { error: "DiskPathPointsToExistentDirectoryError" })
        if (nodes.get(parentOf(path))?.type !== "dir") return json(409, { error: "DiskPathDoesntExistsError" })
        at(path, "dir")
        return json(201, { href: `https://${API}/v1/disk/resources?path=${encodeURIComponent(path)}`, method: "GET" })
      }
      if (!node) return json(404, { error: "DiskNotFoundError" })
      if (method === "DELETE") {
        if (url.searchParams.get("permanently") !== "false") return refuse("a test deletes only into the trash")
        const md5 = url.searchParams.get("md5")
        if (md5 !== null && md5 !== node.md5) return json(409, { error: "MD5DoesntMatchError" })
        trash.set(path, node)
        remove(path)
        return new Response(null, { status: 204 })
      }
      if (url.pathname === "/v1/disk/resources/download") {
        const href = new URL(`https://${DOWNLOADS}/disk/fake`)
        href.searchParams.set("path", path)
        return json(200, { href: href.toString(), method: "GET", templated: false })
      }
      const limit = Number(url.searchParams.get("limit") ?? 20)
      const offset = Number(url.searchParams.get("offset") ?? 0)
      if (node.type === "dir") disk.beforePage?.(path, offset)
      const all = node.type === "dir" ? childrenOf(path) : []
      return json(200, {
        ...resource(node),
        ...(node.type === "dir"
          ? {
              _embedded: {
                path,
                items: all.slice(offset, offset + limit).map(resource),
                limit,
                offset,
                total: all.length,
              },
            }
          : {}),
      })
    },
    nodes,
    trash,
    calls,
    refusals,
    put: (path, text, mime) => {
      for (let dir = posix.dirname(path.replace("disk:", "")); dir !== "/"; dir = posix.dirname(dir))
        if (!nodes.has(`disk:${dir}`)) at(`disk:${dir}`, "dir")
      return text === undefined ? at(path, "dir") : at(path, "file", text, mime)
    },
    remove,
    move: (from, to) => {
      for (const [key, node] of [...nodes.entries()])
        if (key === from || key.startsWith(`${from}/`)) {
          nodes.delete(key)
          const moved = `${to}${key.slice(from.length)}`
          nodes.set(moved, { ...node, path: moved })
        }
      revision++
    },
    deny: (path, status) => {
      denied.set(path, status)
    },
    revision: () => revision,
  }
  return disk
}
