import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fakeApi, sampleOf } from "@wirecat/cli-base/codegen"
import { apiFlagOf, manifestBaseUrl } from "@wirecat/cli-core"
import { afterEach, expect, it } from "vitest"
import { API } from "./config.js"
import { definitions } from "./generated/definitions.js"
import { FAKE_TOKEN } from "./testing/fake-disk.js"
import { runCli } from "./testing/harness.js"

const configFile = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
afterEach(() => rmSync(configFile, { force: true }))

const fake = () =>
  fakeApi({
    operations: API.manifest.operations,
    definitions,
    baseUrl: manifestBaseUrl(API.manifest),
    auth: { header: "authorization", value: `OAuth ${FAKE_TOKEN}` },
  })

type Operation = (typeof API.manifest.operations)[number]

const operationOf = (command: string): Operation => {
  const found = API.manifest.operations.find((operation) => operation.command === command)
  if (!found) throw new Error(`no operation ${command}`)
  return found
}

const keysOf = (suffix: string) => [
  ...new Set(
    API.manifest.operations.flatMap((operation) =>
      (operation.permissions ?? []).map((permission) => permission.key).filter((key) => key.endsWith(suffix)),
    ),
  ),
]
const deleteKeys = keysOf(".delete")
const shareKeys = keysOf(".share")

const argsOf = (operation: Operation) => [
  ...operation.parameters
    .filter((parameter) => parameter.required)
    .flatMap((parameter) => [`--${apiFlagOf(parameter.name)}`, String(sampleOf(parameter.schema, definitions))]),
  ...(operation.request?.schema
    ? ["--body", JSON.stringify(sampleOf({ type: "ref", ref: operation.request.schema }, definitions))]
    : []),
  ...(operation.effect === "destructive" ? ["--yes"] : []),
]

const allowed = () => Object.fromEntries([...deleteKeys, ...shareKeys].map((key) => [key, "allow"]))

it("sends every operation the spec offers as the spec describes it, with the profile's OAuth token", async () => {
  withPermissions({ api: "allow", ...allowed() })
  const service = fake()
  expect(API.manifest.operations.length).toBeGreaterThan(0)
  for (const operation of API.manifest.operations) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.code, `${operation.command}: ${ran.err}`).toBe(0)
  }
  expect(service.refusals).toEqual([])
  expect(service.calls).toHaveLength(API.manifest.operations.length)
  for (const call of service.calls) {
    expect(call.url.host).toBe("cloud-api.yandex.net")
    expect(call.url.pathname).toMatch(/^\/v1\/disk(\/|$)/)
    expect(call.headers.get("authorization")).toBe(`OAuth ${FAKE_TOKEN}`)
  }
})

it("a delete through api checks the manifest's delete key too, before anything is sent", async () => {
  expect(deleteKeys).toEqual(["files.delete"])
  withPermissions({ api: "allow", "files.delete": "deny" })
  const service = fake()
  const destructive = API.manifest.operations.filter((operation) => operation.effect === "destructive")
  expect(destructive.map((operation) => operation.command).sort()).toEqual([
    "resources-delete",
    "trash-resources-delete",
  ])
  for (const operation of destructive) {
    const ran = await runCli(["personal", "api", operation.command, ...argsOf(operation), "--json"], { service })
    expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
  }
  expect(service.calls).toEqual([])
})

it("overwrite=true asks by the delete key, and the same call without it goes through", async () => {
  withPermissions({ api: "allow", "files.delete": "deny" })
  const service = fake()
  const copy = ["personal", "api", "resources-copy", ...argsOf(operationOf("resources-copy"))]
  const refused = await runCli([...copy, "--overwrite", "true", "--json"], { service })
  expect(refused.json()).toMatchObject({ error: { code: "permission_error" } })
  expect(service.calls).toEqual([])
  const sent = await runCli([...copy, "--json"], { service })
  expect(sent.code, sent.err).toBe(0)
  expect(service.calls).toHaveLength(1)
})

it("a public link asks by the share key", async () => {
  expect(shareKeys).toEqual(["files.share"])
  withPermissions({ api: "allow", "files.share": "deny" })
  const service = fake()
  const publish = operationOf("resources-publish")
  const ran = await runCli(["personal", "api", publish.command, ...argsOf(publish), "--json"], { service })
  expect(ran.json()).toMatchObject({ error: { code: "permission_error" } })
  expect(service.calls).toEqual([])
})

it.each([
  ["resources-copy", "files.copy"],
  ["resources-move", "files.move"],
  ["resources-create", "files.create"],
  ["resources-publish", "files.publish"],
  ["resources-unpublish", "files.unpublish"],
  ["trash-resources-restore", "files.restore"],
  ["resources-upload-url", "files.upload"],
  ["public-resources-save-to-disk", "files.upload"],
])("api %s checks %s, as the files command that does the same, in the run and in --dry-run", async (command, key) => {
  withPermissions({ api: "allow", ...allowed(), [key]: "deny" })
  const service = fake()
  const call = ["personal", "api", command, ...argsOf(operationOf(command)), "--json"]
  expect((await runCli(call, { service })).json()).toMatchObject({
    error: { code: "permission_error", details: { permission: key } },
  })
  expect((await runCli([...call, "--dry-run"], { service })).json()).toMatchObject({
    error: { code: "permission_error", details: { permission: key } },
  })
  expect(service.calls).toEqual([])
})
