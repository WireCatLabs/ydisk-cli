import { createHash } from "node:crypto"
import { fakeApi } from "@wirecat/cli-base/codegen"
import { manifestBaseUrl } from "@wirecat/cli-core"
import { API } from "../config.js"
import { definitions } from "../generated/definitions.js"
import * as manifest from "../generated/manifest.js"
import { FAKE_TOKEN } from "./fake-disk.js"

// The spec's strict fake (cli-base fakeApi) with the answers the files commands need. A download or upload host
// refuses a call that carries the token. Visibly fake data only (WC-TEST-8).

const resource = (path: string, type: "dir" | "file") => ({
  path,
  name: path.split("/").at(-1) || "disk",
  type,
  resource_id: `fake-${path}`,
  created: "2026-01-01T00:00:00+00:00",
  modified: "2026-01-02T00:00:00+00:00",
  ...(type === "file"
    ? {
        size: 5,
        mime_type: "text/plain",
        md5: createHash("md5").update("hello").digest("hex"),
        sha256: createHash("sha256").update("hello").digest("hex"),
      }
    : {}),
})

export interface DiskApiOptions {
  /** The next write lands, then its answer is lost, as a dropped connection loses it. */
  loseNextWriteAnswer?: boolean
  /** Every call is checked by the fake, then answered with this status. */
  failWith?: number
  /** A write lands but is never answered; it fails only when the caller stops waiting. */
  hangWrites?: boolean
  /** The status the upload host answers. */
  uploadStatus?: number
  /** What the download host answers in place of the listed file's bytes. */
  downloadBody?: string
  /** Fields every resource in an answer also carries. */
  resourceExtra?: Record<string, unknown>
  /** The read of a public link after a publish fails, as a dropped connection would. */
  publicUrlFails?: boolean
}

/** The spec's strict fake with the answers these commands need; a download or upload host refuses the token. */
export const diskApi = ({
  loseNextWriteAnswer = false,
  failWith,
  hangWrites = false,
  uploadStatus = 201,
  downloadBody = "hello",
  resourceExtra = {},
  publicUrlFails = false,
}: DiskApiOptions = {}) => {
  const uploaded: Uint8Array[] = []
  const service = fakeApi({
    // The whole spec: the files commands use the link operations the api group leaves out.
    operations: manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    auth: { header: "authorization", value: `OAuth ${FAKE_TOKEN}` },
    answers: {
      GetResource: (call) => {
        const path = String(call.query.path)
        const one = (at: string, type: "dir" | "file") => ({
          ...resource(at, type),
          ...resourceExtra,
          ...(call.query.fields === "public_url" ? { public_url: "https://yadi.sk/d/fake-public" } : {}),
        })
        return path.endsWith(".txt")
          ? { body: one(path, "file") }
          : {
              body: {
                ...one(path, "dir"),
                _embedded: { path, items: [one(`${path}/plan.txt`, "file")], limit: 200, offset: 0, total: 1 },
              },
            }
      },
      GetResourceDownloadLink: () => ({
        body: { href: "https://downloader.disk.yandex.ru/disk/fake-link", method: "GET", templated: false },
      }),
      GetResourceUploadLink: () => ({
        body: { href: "https://uploader1.disk.yandex.net/upload-target/fake", method: "PUT", operation_id: "fake-op" },
      }),
      CopyResource: () => ({
        status: 202,
        body: { href: "https://cloud-api.yandex.net/v1/disk/operations/fake-op-1", method: "GET", templated: false },
      }),
      DeleteResource: () => ({ status: 204 }),
      PublishResource: () => ({
        body: {
          href: "https://cloud-api.yandex.net/v1/disk/resources?path=disk%3A%2Fplan.txt",
          method: "GET",
          templated: false,
        },
      }),
    },
    hosts: {
      "downloader.disk.yandex.ru": () => ({ body: downloadBody }),
      "*.disk.yandex.net": (call) => {
        if (call.bytes) uploaded.push(call.bytes)
        return { status: uploadStatus }
      },
    },
  })
  let lose = loseNextWriteAnswer
  const fetch: typeof service.fetch = async (input, init) => {
    const writes = (init?.method ?? "GET") !== "GET"
    const answer = await service.fetch(input, init)
    if (writes && hangWrites)
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
    if (failWith) return new Response("{}", { status: failWith })
    if (publicUrlFails && new URL(String(input)).searchParams.get("fields") === "public_url")
      throw new TypeError("fetch failed")
    if (writes && lose) {
      lose = false
      throw new TypeError("fetch failed")
    }
    return answer
  }
  return { ...service, fetch, uploaded }
}
