import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brokenKeyring, memoryKeyring } from "@wirecat/cli-base"
import { ProfileTokenStore, type RunOptions } from "@wirecat/cli-core"
import { mcpOverStdio } from "@wirecat/cli-core/testing"
import { afterEach, expect, it } from "vitest"
import type { ServiceEnvironment } from "./context.js"
import { IDENTITY } from "./identity.js"
import { run } from "./program.js"
import { diskApi } from "./testing/disk-api.js"
import { FAKE_TOKEN, fakeDisk } from "./testing/fake-disk.js"
import { runCli, signedIn } from "./testing/harness.js"

const configFile = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
afterEach(() => rmSync(configFile, { force: true }))

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())

const LIST = ["personal", "files", "list", "--json"]

// These two run first: a session start below makes this computer know the profile.
it("a profile never signed in is unknown, lists the profiles here, says how to sign in and sends nothing", async () => {
  const service = fakeDisk()
  const { json } = await runCli(LIST, { service, keyring: memoryKeyring() })
  expect(json()).toMatchObject({ error: { code: "not_found", reason: "profile.unknown", details: { profiles: [] } } })
  expect(JSON.stringify(json())).toContain("session start")
  expect(service.calls).toEqual([])
})

it("a profile this computer knows, with no sign-in, says how to sign in and sends nothing", async () => {
  withPermissions({})
  const service = fakeDisk()
  const { json } = await runCli(LIST, { service, keyring: memoryKeyring() })
  expect(json()).toMatchObject({ error: { code: "authentication_error", reason: "session.missing" } })
  expect(JSON.stringify(json())).toContain("session start")
  expect(service.calls).toEqual([])
})

it("--offline refuses a command that needs the service, and a sign-in", async () => {
  const service = fakeDisk()
  expect((await runCli(["--offline", ...LIST], { service })).code).toBe(5)
  const start = await runCli(["--offline", "personal", "session", "start", "--json"], { service, stdin: FAKE_TOKEN })
  expect(start.code).toBe(5)
  expect(service.calls).toEqual([])
})

it("a recorded run is named after the command and holds its request", async () => {
  const listed = await runCli(["--record", ...LIST])
  const runId = String((listed.json().meta as Record<string, unknown>).run_id)
  expect(runId).toContain("files")
  expect(runId).not.toContain("-process-")
  expect((await runCli(["runs", "show", runId, "--json"])).out).toContain("GET /disk/resources")
})

it("session start reads the token from stdin and checks it before keeping it; status, list and end", async () => {
  const keyring = memoryKeyring()
  const service = fakeDisk()
  const started = await runCli(["personal", "session", "start", "--json"], { keyring, service, stdin: FAKE_TOKEN })
  expect(started.json().item).toMatchObject({
    verified: true,
    stored_in: "keyring",
    id: "1000",
    login: "test-person",
  })
  expect(service.calls.map((call) => call.url.pathname)).toEqual(["/v1/disk"])
  const status = await runCli(["personal", "session", "status", "--check", "--json"], { keyring, service })
  expect(status.json().item).toMatchObject({ state: "saved", token_from: "keyring", verified: true })
  const unchecked = await runCli(["personal", "session", "status", "--json"], { keyring, service })
  expect(unchecked.json().item).toMatchObject({ state: "saved", verified: false })
  expect(service.calls).toHaveLength(2)
  expect((await runCli(["session", "list", "--json"], { keyring })).json().items).toContainEqual(
    expect.objectContaining({ profile: "personal", signed_in: true, token_from: "keyring" }),
  )
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  const ended = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(ended.json().item).toMatchObject({ state: "missing", token_from: null })
})

it("a token kept by an earlier version's session start still signs the profile in, with no new sign-in", async () => {
  const service = fakeDisk()
  const status = await runCli(["personal", "session", "status", "--check", "--json"], { keyring: signedIn(), service })
  expect(status.json().item).toMatchObject({ state: "saved", token_from: "keyring", verified: true, id: "1000" })
})

it("session start --credential-storage file keeps the token in a private file instead of the keyring", async () => {
  const keyring = memoryKeyring()
  const started = await runCli(["personal", "session", "start", "--credential-storage", "file", "--json"], {
    keyring,
    stdin: FAKE_TOKEN,
  })
  expect(started.json().item).toMatchObject({ stored_in: "file" })
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ token_from: "file" })
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).json().item).toMatchObject({
    ended: expect.arrayContaining(["file"]),
  })
})

it("session start without a working keyring keeps the token in a private file, and says so on stderr", async () => {
  const keyring = brokenKeyring()
  const started = await runCli(["personal", "session", "start", "--json"], { keyring, stdin: FAKE_TOKEN })
  expect(started.json().item).toMatchObject({ stored_in: "file" })
  expect(started.err).toContain("keyring")
  expect(new ProfileTokenStore({ app: IDENTITY, keyring }).signedIn("personal")).toBe(true)
  expect((await runCli(["personal", "session", "end", "--json"], { keyring })).code).toBe(0)
  expect(new ProfileTokenStore({ app: IDENTITY, keyring }).signedIn("personal")).toBe(false)
})

it("session start refuses a storage it does not know, before asking for the token", async () => {
  const service = fakeDisk()
  const { code, err } = await runCli(["personal", "session", "start", "--credential-storage", "vault", "--json"], {
    service,
  })
  expect(code).toBe(2)
  expect(err).toContain("--credential-storage takes keyring or file")
  expect(service.calls).toEqual([])
})

it("session start keeps nothing when the token is empty or the service refuses it", async () => {
  const keyring = memoryKeyring()
  const empty = await runCli(["personal", "session", "start", "--json"], { keyring, stdin: "  \n" })
  expect(empty.json()).toMatchObject({ error: { code: "validation_error" } })
  const refused = await runCli(["personal", "session", "start", "--json"], { keyring, stdin: "wrong0token" })
  expect(refused.json()).toMatchObject({ error: { code: "authentication_error" } })
  const status = await runCli(["personal", "session", "status", "--json"], { keyring })
  expect(status.json().item).toMatchObject({ state: "missing" })
})

it("the token reaches no address, output, run record or journal, whatever the outcome", async () => {
  const disk = fakeDisk()
  const api = diskApi({ loseNextWriteAnswer: true })
  const runs = [
    await runCli(["personal", "session", "start", "--json"], { keyring: memoryKeyring(), stdin: FAKE_TOKEN }),
    await runCli(["--record", ...LIST], { service: disk }),
    await runCli(["personal", "files", "create", "/New", "--json"], { service: api }),
    await runCli(["personal", "files", "show", "/missing.txt", "--json"], { service: disk }),
    await runCli(LIST, { service: { fetch: async () => new Response("{}", { status: 401 }) } }),
  ]
  for (const ran of runs) expect(ran.out + ran.err).not.toContain(FAKE_TOKEN)
  for (const call of [...disk.calls, ...api.calls]) expect(call.url.href).not.toContain(FAKE_TOKEN)
  const folders = [...new Set([process.env.HOME ?? "", tmpdir()])]
  const written = folders.flatMap(filesUnder).map((path) => readFileSync(path, "utf8"))
  expect(written.some((text) => text.includes("GET /disk/resources"))).toBe(true)
  expect(written.some((text) => text.includes("files.create"))).toBe(true)
  expect(written.filter((text) => text.includes(FAKE_TOKEN))).toEqual([])
})

it("mcp serve runs a read for an agent with the run's keyring", async () => {
  const service = fakeDisk()
  service.put("disk:/plan.txt", "hello")
  const options: RunOptions & ServiceEnvironment = { tty: false, keyring: signedIn(), fetch: service.fetch }
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { ...options, ...streams }))
  try {
    const listed = await mcp.call("ydisk_read", { command: "files list" })
    expect(listed.body).toMatchObject({ items: [{ name: "plan.txt", path: "disk:/plan.txt" }] })
  } finally {
    expect(await mcp.close()).toBe(0)
  }
})

it("doctor --online asks the Disk whose the profile's token is, and says so when there is none", async () => {
  withPermissions({})
  const service = fakeDisk()
  const checked = await runCli(["personal", "doctor", "--online", "--json"], { service })
  expect(checked.code, checked.err).toBe(0)
  expect(checked.json().item).toMatchObject({ online: { ok: true, user: { id: "1000", login: "test-person" } } })
  expect(
    service.calls.filter((call) => call.url.host === "cloud-api.yandex.net").map((call) => call.url.pathname),
  ).toEqual(["/v1/disk"])
  const unsigned = await runCli(["personal", "doctor", "--online", "--json"], { service, keyring: memoryKeyring() })
  expect(unsigned.code, unsigned.err).toBe(0)
  expect(unsigned.json().item).toMatchObject({ online: { ok: false, error_code: "authentication_error" } })
  expect(service.calls.filter((call) => call.url.host === "cloud-api.yandex.net")).toHaveLength(1)
})
