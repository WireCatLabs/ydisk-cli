import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it } from "vitest"
import { diskApi } from "./testing/disk-api.js"
import { runCli } from "./testing/harness.js"

const HASH = "a".repeat(64)
const configFile = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
afterEach(() => rmSync(configFile, { force: true }))

const CREATE = ["personal", "files", "create", "/New"]
const LIST = ["personal", "files", "list", "--json"]
const creates = (service: ReturnType<typeof diskApi>) =>
  service.calls.filter((call) => call.operation === "CreateResource")

it("creates a folder with one request, and answers with its operation_id", async () => {
  const service = diskApi()
  const created = await runCli([...CREATE, "--json"], { service })
  expect(created.code, created.err).toBe(0)
  expect(created.json().item).toMatchObject({ operation_id: expect.any(String), path: "disk:/New", status: "done" })
  expect(creates(service)).toHaveLength(1)
  expect(service.refusals).toEqual([])
})

it("--dry-run names the write's permission and sends nothing", async () => {
  const service = diskApi()
  const preview = await runCli([...CREATE, "--dry-run", "--json"], { service })
  expect(preview.code, preview.err).toBe(0)
  expect(preview.json().item).toMatchObject({ permission: { key: "files.create" } })
  expect(service.calls).toEqual([])
})

it("a deny on a read stops it before any request", async () => {
  withPermissions({ "files.list": "deny" })
  const service = diskApi()
  const { code, json } = await runCli(LIST, { service })
  expect(code).toBe(5)
  expect(json()).toMatchObject({ error: { code: "permission_error" } })
  expect(service.calls).toEqual([])
})

it("a deny on a write, or the read-only lock, stops it before any request", async () => {
  const service = diskApi()
  withPermissions({ "files.create": "deny" })
  const denied = await runCli([...CREATE, "--json"], { service })
  expect(denied.code).toBe(5)
  expect(denied.json()).toMatchObject({ error: { code: "permission_error" } })
  rmSync(configFile)
  const locked = await runCli([...CREATE, "--json"], { service, env: { YDISK_READ_ONLY: "1" } })
  expect(locked.code).toBe(5)
  expect(service.calls).toEqual([])
})

it("a write at ask asks once; no sends nothing, yes sends it", async () => {
  withPermissions({ "files.create": "ask" })
  const service = diskApi()
  const asked: string[] = []
  const answering = (reply: string) => (question: string) => {
    asked.push(question)
    return reply
  }
  const no = await runCli(CREATE, { service, answer: answering("n") })
  expect(no.code).not.toBe(0)
  expect(asked).toHaveLength(1)
  expect(service.calls).toEqual([])
  const yes = await runCli(CREATE, { service, answer: answering("y") })
  expect(yes.code, yes.err).toBe(0)
  expect(asked).toHaveLength(2)
  expect(creates(service)).toHaveLength(1)
})

it("a write whose answer is lost is outcome_unknown with its operation_id, and is sent once", async () => {
  const service = diskApi({ loseNextWriteAnswer: true })
  const lost = await runCli([...CREATE, "--json"], { service })
  expect(lost.json()).toMatchObject({
    error: { code: "outcome_unknown", details: { operation_id: expect.any(String) } },
  })
  expect(creates(service)).toHaveLength(1)
})

it("a write still in flight when --timeout ends the run is outcome_unknown, never a plain timeout", async () => {
  const service = diskApi({ hangWrites: true })
  const cut = await runCli(["--timeout", "50ms", ...CREATE, "--json"], { service })
  expect(cut.json()).toMatchObject({
    error: { code: "outcome_unknown", details: { operation_id: expect.any(String) } },
  })
  expect(creates(service)).toHaveLength(1)
})

it("a server failure is outcome_unknown for a write and retryable for a read", async () => {
  const service = diskApi({ failWith: 503 })
  const write = await runCli([...CREATE, "--json"], { service })
  expect(write.json()).toMatchObject({ error: { code: "outcome_unknown" } })
  const read = await runCli(LIST, { service })
  expect(read.json()).toMatchObject({ error: { code: "provider_unavailable", retry: { safe: true } } })
  expect(service.calls).toHaveLength(2)
})

it.each([
  [413, "validation_error"],
  [507, "validation_error"],
  [500, "outcome_unknown"],
])("an upload the upload host answers with HTTP %i is %s", async (status, code) => {
  const local = join(mkdtempSync(join(tmpdir(), "ydisk-writes-")), "notes.txt")
  writeFileSync(local, "some notes")
  const service = diskApi({ uploadStatus: status })
  const failed = await runCli(["personal", "files", "upload", local, "--json"], { service })
  expect(failed.json()).toMatchObject({ error: { code } })
  expect(service.refusals).toEqual([])
})

it("a --cursor that page.next did not give is refused before any request", async () => {
  const service = diskApi()
  const { code, json } = await runCli([...LIST, "--cursor", "-1"], { service })
  expect(code).toBe(2)
  expect(json()).toMatchObject({ error: { code: "validation_error" } })
  expect(service.calls).toEqual([])
})

it("an upload or a move with --replace asks files.delete and says overwrite; a 202 upload is in progress", async () => {
  const folder = mkdtempSync(join(tmpdir(), "ydisk-writes-"))
  const local = join(folder, "notes.txt")
  writeFileSync(local, "some notes")
  withPermissions({ "files.delete": "allow" })
  const service = diskApi({ uploadStatus: 202 })
  const uploaded = await runCli(["personal", "files", "upload", local, "--replace", "--json"], { service })
  expect(uploaded.json().item).toMatchObject({ path: "disk:/notes.txt", status: "in-progress" })
  const moved = await runCli(["personal", "files", "move", "/notes.txt", "--folder", "/Old", "--replace", "--json"], {
    service,
  })
  expect(moved.code, moved.err).toBe(0)
  expect(service.calls.filter((call) => call.query.overwrite === "true")).toHaveLength(2)
  expect(service.refusals).toEqual([])
  const notFile = await runCli(["personal", "files", "upload", folder, "--json"], { service })
  expect(notFile.json()).toMatchObject({ error: { code: "validation_error" } })
})

it.each([
  ["trash:/old.txt", "trash:/old.txt"],
  ["/old.txt", "trash:/old.txt"],
  ["old.txt", "trash:/old.txt"],
])("restore %s asks the trash for %s", async (path, sent) => {
  const service = diskApi()
  const restored = await runCli(["personal", "files", "restore", path, "--yes", "--json"], { service })
  expect(restored.code, restored.err).toBe(0)
  expect(service.calls[0]?.query).toMatchObject({ path: sent })
})

it.each([
  [["publish", "/plan.txt"], { key: "files.share" }],
  [["unpublish", "/plan.txt"], { key: "files.share" }],
  [["upload", "./plan.txt"], { key: "files.delete", when: "with --replace" }],
  [["update", "/plan.txt", "--text", "x"], { key: "files.delete", when: "with --expected-fingerprint" }],
  [
    ["restore", "/plan.txt", HASH, "--expected-fingerprint", HASH],
    { key: "files.delete", when: "with --expected-fingerprint" },
  ],
  [["sheets", "update", "/b.xlsx", "B2", "--values", "[[1]]", "--expected-fingerprint", HASH], { key: "files.delete" }],
  [["documents", "update", "/l.docx", "--payload", "[]", "--expected-fingerprint", HASH], { key: "files.delete" }],
  [["copy", "/plan.txt", "--folder", "/Archive"], { key: "files.delete", when: "with --replace" }],
  [["move", "/plan.txt", "--folder", "/Archive"], { key: "files.delete", when: "with --replace" }],
])("--dry-run of files %s shows %o, the key its run also checks", async (argv, also) => {
  const service = diskApi()
  const preview = await runCli(["personal", "files", ...argv, "--dry-run", "--json"], { service })
  expect(preview.code, preview.err).toBe(0)
  expect(preview.json().item).toMatchObject({ permission: { also: [expect.objectContaining(also)] } })
  expect(service.calls).toEqual([])
})

it("a token the service refuses says how to sign this profile in again", async () => {
  withPermissions({})
  const refused = await runCli(LIST, { service: diskApi({ failWith: 401 }) })
  expect(refused.json()).toMatchObject({ error: { code: "authentication_error" } })
  expect(JSON.stringify(refused.json())).toContain("ydisk personal session start")
})

it("a local file that changes while the owner is asked is refused before anything is sent", async () => {
  const local = join(mkdtempSync(join(tmpdir(), "ydisk-writes-")), "notes.txt")
  writeFileSync(local, "some notes")
  withPermissions({ "files.upload": "ask" })
  const service = diskApi()
  const changed = await runCli(["personal", "files", "upload", local], {
    service,
    answer: () => {
      writeFileSync(local, "some notes, and more written while the question waited")
      return "y"
    },
  })
  expect(changed.code).not.toBe(0)
  expect(changed.err).toContain("nothing was sent")
  expect(service.calls).toEqual([])
})
