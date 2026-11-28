import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { changesAuthorityAt, type RunOptions, readsOverMcpAt } from "@wirecat/cli-core"
import { mcpOverStdio, ownCatalogue } from "@wirecat/cli-core/testing"
import { expect, it } from "vitest"
import { permissions } from "./config.js"
import type { ServiceEnvironment } from "./context.js"
import { IDENTITY } from "./identity.js"
import { createProgram, run } from "./program.js"
import { diskApi } from "./testing/disk-api.js"
import { fakeDisk } from "./testing/fake-disk.js"
import { runCli, signedIn } from "./testing/harness.js"

it("mcp serve offers search, read and write, and runs a command through the CLI", async () => {
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { tty: false, ...streams }))
  try {
    expect((await mcp.tools()).sort()).toEqual(["ydisk_read", "ydisk_tools_search", "ydisk_write"])
    const doctor = await mcp.call("ydisk_read", { command: "doctor" })
    expect(doctor.body).toMatchObject({ item: { version: IDENTITY.version } })
  } finally {
    expect(await mcp.close()).toBe(0)
  }
})

it("pins this CLI's own commands an agent can find, as reads or writes", async () => {
  const program = createProgram()
  const options = {
    includeUnavailable: true,
    exclude: [["mcp"]],
    authority: changesAuthorityAt(program),
    fetchOnly: readsOverMcpAt(program),
    permissions,
  }
  await expect(`${JSON.stringify(ownCatalogue(program, options), null, 2)}\n`).toMatchFileSnapshot(
    "../contracts/mcp-catalogue.json",
  )
})

it("mcp serve refuses a --permission that names no command, and a --profiles this computer lacks", async () => {
  const unknown = await runCli(["personal", "mcp", "serve", "--permission", "files.nope=deny"])
  expect(unknown.code).toBe(2)
  expect(unknown.err).toContain("files.nope")
  const missing = await runCli(["mcp", "serve", "--profiles", "nope"])
  expect(missing.code).toBe(2)
  expect(missing.err).toContain("nope")
})

it("mcp config prints an entry that serves the named profile, or every profile only when told", async () => {
  const one = await runCli(["personal", "mcp", "config", "--permission", "files.delete=deny", "--json"])
  const entry = one.json().item as { config: { mcpServers: Record<string, { args: string[] }> } }
  expect(entry.config.mcpServers["ydisk-personal"]?.args.slice(-5)).toEqual([
    "personal",
    "mcp",
    "serve",
    "--permission",
    "files.delete=deny",
  ])
  const all = await runCli(["mcp", "config", "--profiles", "all", "--json"])
  expect(JSON.stringify(all.json())).toContain('"--profiles","all"')
})

it("mcp revoke answers for the profile it names", async () => {
  const revoked = await runCli(["personal", "mcp", "revoke", "--json"])
  expect(revoked.code).toBe(0)
  expect(revoked.json().item).toMatchObject({ profile: "personal" })
})

it("doctor --online answers even when npm cannot be reached", async () => {
  const online = await runCli(["doctor", "--online", "--json"])
  expect(online.code).toBe(0)
  expect(online.json().item).toMatchObject({ version: IDENTITY.version, online: expect.any(Object) })
})

it("a denied command is offered as unavailable and refused before any request (WC-PERM-23)", async () => {
  const file = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
  mkdirSync(join(file, ".."), { recursive: true })
  writeFileSync(file, JSON.stringify({ profiles: { personal: { permissions: { "files.list": "deny" } } } }))
  const service = fakeDisk()
  const options: RunOptions & ServiceEnvironment = { tty: false, keyring: signedIn(), fetch: service.fetch }
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { ...options, ...streams }))
  try {
    const found = await mcp.call("ydisk_tools_search", { query: "files list" })
    expect(found.body).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          command: "files list",
          availability: expect.objectContaining({ available: false }),
        }),
      ]),
    })
    const listed = await mcp.call("ydisk_read", { command: "files list" })
    expect(listed.isError).toBe(true)
    expect(JSON.stringify(listed.body)).toContain("permission_error")
    expect(service.calls).toEqual([])
  } finally {
    expect(await mcp.close()).toBe(0)
    rmSync(file, { force: true })
  }
})

it("over MCP an agent reads a Disk file's text but cannot save it to a path, nor upload a credential file", async () => {
  const service = diskApi()
  const scratch = mkdtempSync(join(tmpdir(), "ydisk-mcp-"))
  const options: RunOptions & ServiceEnvironment = { tty: false, keyring: signedIn(), fetch: service.fetch }
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { ...options, ...streams }))
  try {
    const text = await mcp.call("ydisk_read", { command: "files download", arguments: { path: "/Work/plan.txt" } })
    expect(JSON.stringify(text.body)).toContain("hello")
    const saved = await mcp.call("ydisk_write", {
      command: "files download",
      arguments: { path: "/Work/plan.txt", output: join(scratch, "x.txt") },
    })
    expect(saved.isError).toBe(true)
    mkdirSync(join(scratch, ".ssh"))
    writeFileSync(join(scratch, ".ssh", "id_rsa"), "not a real key")
    const sent = await mcp.call("ydisk_write", {
      command: "files upload",
      arguments: { file: join(scratch, ".ssh", "id_rsa"), "allow-any-file": true },
    })
    expect(sent.isError).toBe(true)
    expect(service.calls.filter((call) => call.method === "PUT")).toEqual([])
  } finally {
    expect(await mcp.close()).toBe(0)
  }
})

it("over MCP an agent can neither approve many changes nor change a mirror's exclusions", async () => {
  const service = fakeDisk()
  const options: RunOptions & ServiceEnvironment = { tty: false, keyring: signedIn(), fetch: service.fetch }
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { ...options, ...streams }))
  try {
    for (const [flag, value] of [
      ["allow-deletions", "99"],
      ["replace", true],
    ] as const) {
      const approved = await mcp.call("ydisk_write", { command: "mirrors sync", arguments: { id: "x", [flag]: value } })
      expect(approved.isError, flag).toBe(true)
      expect(JSON.stringify(approved.body), flag).toContain(`Invalid key: Expected never but received \\"${flag}\\"`)
    }
    const changed = await mcp.call("ydisk_write", { command: "mirrors update", arguments: { id: "x", ignore: ["P"] } })
    expect(changed.isError).toBe(true)
    expect(JSON.stringify(changed.body)).toContain('no command \\"mirrors update\\" here')
    expect(service.calls).toEqual([])
  } finally {
    expect(await mcp.close()).toBe(0)
  }
})

it("over MCP an agent edits a text file at the sha256 it read, as a write, and reads a workbook's cells", async () => {
  const file = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
  mkdirSync(join(file, ".."), { recursive: true })
  writeFileSync(file, JSON.stringify({ profiles: { personal: { permissions: { "files.delete": "allow" } } } }))
  const service = fakeDisk()
  service.put("disk:/notes.md", "first draft")
  service.put("disk:/budget.xlsx", readFileSync(join(import.meta.dirname, "testing", "fixtures", "budget.xlsx")))
  const env = { ...process.env, YDISK_STATE_DIR: join(mkdtempSync(join(tmpdir(), "ydisk-mcp-")), "state") }
  const options: RunOptions & ServiceEnvironment = { tty: false, keyring: signedIn(), fetch: service.fetch, env }
  const mcp = await mcpOverStdio((streams) => run(["personal", "mcp", "serve"], { ...options, ...streams }))
  try {
    const shown = await mcp.call("ydisk_read", { command: "files show", arguments: { path: "/notes.md" } })
    const { sha256 } = (shown.body as { item: { sha256: string } }).item
    const written = await mcp.call("ydisk_write", {
      command: "files update",
      arguments: { path: "/notes.md", text: "second draft", expected_fingerprint: sha256 },
    })
    expect(written.isError, JSON.stringify(written.body)).toBe(false)
    expect(service.nodes.get("disk:/notes.md")?.text).toBe("second draft")
    const asRead = await mcp.call("ydisk_read", { command: "files update", arguments: { path: "/x.md", text: "x" } })
    expect(asRead.isError).toBe(true)
    expect(service.nodes.has("disk:/x.md")).toBe(false)
    const noText = await mcp.call("ydisk_write", { command: "files update", arguments: { path: "/empty.md" } })
    expect(JSON.stringify(noText.body)).toContain("--text")
    expect(service.nodes.has("disk:/empty.md")).toBe(false)
    const cells = await mcp.call("ydisk_read", { command: "files sheets show", arguments: { path: "/budget.xlsx" } })
    expect(cells.isError, JSON.stringify(cells.body)).toBe(false)
    const history = await mcp.call("ydisk_read", { command: "files history", arguments: { path: "/notes.md" } })
    expect(JSON.stringify(history.body)).toContain(sha256)
  } finally {
    expect(await mcp.close()).toBe(0)
    rmSync(file, { force: true })
  }
})
