import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readDocxParagraphs, readXlsxCells } from "@wirecat/cli-core"
import { afterEach, describe, expect, it } from "vitest"
import { diskApi } from "./testing/disk-api.js"
import { fakeDisk } from "./testing/fake-disk.js"
import { runCli } from "./testing/harness.js"

const configFile = join(process.env.YDISK_CONFIG_DIR ?? "", "config.json")
const withPermissions = (permissions: Record<string, string>) => {
  mkdirSync(join(configFile, ".."), { recursive: true })
  writeFileSync(configFile, JSON.stringify({ profiles: { personal: { permissions } } }))
}
afterEach(() => rmSync(configFile, { force: true }))

const sha256 = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex")
const fixture = (name: string) => readFileSync(join(import.meta.dirname, "testing", "fixtures", name))
const OLD = "# Notes\nthe first draft\n"
const NEW = "# Notes\nthe second draft\n"

/** The fake Disk with notes, a workbook and a letter, and a state folder of the test's own for the versions. */
const setup = () => {
  const service = fakeDisk()
  service.put("disk:/notes.md", OLD, "text/markdown")
  service.put("disk:/budget.xlsx", fixture("budget.xlsx"), "application/vnd.ms-excel")
  service.put("disk:/letter.docx", fixture("letter.docx"), "application/msword")
  const state = join(mkdtempSync(join(tmpdir(), "ydisk-edit-")), "state")
  const uploads = () => service.calls.filter((call) => call.url.host === "uploader1.disk.yandex.net")
  const cli = (argv: string[], options: { stdin?: string; answer?: (question: string) => string } = {}) =>
    runCli(["personal", "files", ...argv], { service, env: { YDISK_STATE_DIR: state }, ...options })
  return { service, state, uploads, cli }
}

describe("files update", () => {
  it("replaces the file at the sha256 it was read at, keeps what it replaced, and history lists it", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, state, uploads, cli } = setup()
    const done = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD), "--json"])
    expect(done.code, done.err).toBe(0)
    const item = done.json().item as { replaced: { sha256: string; kept_at: string }; operation_id: string }
    expect(item).toMatchObject({ path: "disk:/notes.md", sha256: sha256(NEW), replaced: { sha256: sha256(OLD) } })
    expect(item.operation_id).toEqual(expect.any(String))
    expect(service.nodes.get("disk:/notes.md")?.text).toBe(NEW)
    expect(item.replaced.kept_at.startsWith(join(state, "profiles", "personal", "files.versions"))).toBe(true)
    expect(readFileSync(item.replaced.kept_at, "utf8")).toBe(OLD)
    expect(uploads()).toHaveLength(1)
    expect(service.refusals).toEqual([])
    // No public link: the Disk itself checked the old file as it went to the trash.
    expect(service.trash.get("disk:/notes.md")?.text).toBe(OLD)
    expect([...service.nodes.keys()].filter((path) => path.includes("/."))).toEqual([])

    const history = await cli(["history", "/notes.md", "--json"])
    expect(history.code, history.err).toBe(0)
    expect(history.json().item).toMatchObject({
      path: "disk:/notes.md",
      versions: [{ event: "changed", version: sha256(OLD), available: true, new: sha256(NEW) }],
    })
  })

  it("a file with a public link is overwritten in place, keeping its id and its link", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    service.publish("disk:/notes.md")
    const before = service.nodes.get("disk:/notes.md")
    const done = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD), "--json"])
    expect(done.code, done.err).toBe(0)
    expect(service.nodes.get("disk:/notes.md")).toMatchObject({
      text: NEW,
      resource_id: before?.resource_id,
      public_key: before?.public_key,
    })
    expect(service.trash.size).toBe(0)
  })

  it("a file put at the path while it is replaced is a conflict that names where the new content is", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    service.beforeWrite = (method, path) => {
      if (method === "POST" && path === "disk:/notes.md") service.put("disk:/notes.md", "someone else's")
    }
    const refused = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD), "--json"])
    const [temporary] = [...service.nodes.keys()].filter((path) => path.includes("/."))
    expect(service.nodes.get(temporary as string)?.text).toBe(NEW)
    expect(refused.json()).toMatchObject({ error: { code: "conflict", reason: "upload.replace-interrupted" } })
    expect(JSON.stringify(refused.json())).toContain(temporary)
  })

  it("a fingerprint the file no longer has is a conflict that says to read it again, and nothing is uploaded", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, uploads, cli } = setup()
    const stale = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256("old"), "--json"])
    expect(stale.code).not.toBe(0)
    expect(stale.json()).toMatchObject({ error: { code: "conflict", reason: "mirror.remote-changed" } })
    expect(JSON.stringify(stale.json())).toContain("ydisk personal files show /notes.md")
    expect(uploads()).toEqual([])
    expect(service.nodes.get("disk:/notes.md")?.text).toBe(OLD)
  })

  it("a file another device changes after it was kept is caught before the upload", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, uploads } = setup()
    const fetch: typeof service.fetch = async (input, init) => {
      const answer = await service.fetch(input, init)
      if (String(input).includes("downloader.disk.yandex.ru")) service.put("disk:/notes.md", "another device's edit")
      return answer
    }
    const state = join(mkdtempSync(join(tmpdir(), "ydisk-edit-")), "state")
    const raced = await runCli(
      ["personal", "files", "update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD), "--json"],
      { service: { fetch }, env: { YDISK_STATE_DIR: state } },
    )
    expect(raced.json()).toMatchObject({ error: { code: "conflict", reason: "mirror.remote-changed" } })
    expect(uploads()).toEqual([])
    expect(service.nodes.get("disk:/notes.md")?.text).toBe("another device's edit")
  })

  it("refuses an existing file without a fingerprint, and a .docx or .xlsx, before anything is sent", async () => {
    const { uploads, cli } = setup()
    const bare = await cli(["update", "/notes.md", "--text", NEW, "--json"])
    expect(bare.json()).toMatchObject({ error: { code: "validation_error", param: "--expected-fingerprint" } })
    const bad = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", "abc", "--json"])
    expect(bad.json()).toMatchObject({ error: { code: "validation_error" } })
    for (const path of ["/letter.docx", "/budget.xlsx"]) {
      const office = await cli(["update", path, "--text", "x", "--expected-fingerprint", sha256("x"), "--json"])
      expect(office.json()).toMatchObject({ error: { code: "validation_error", reason: "file.not-plain-text" } })
    }
    expect(uploads()).toEqual([])
  })

  it("creates a new file with no fingerprint, from stdin", async () => {
    const { service, cli } = setup()
    const created = await cli(["update", "/new.md", "--json"], { stdin: NEW })
    expect(created.code, created.err).toBe(0)
    expect(created.json().item).toMatchObject({ path: "disk:/new.md", sha256: sha256(NEW), replaced: null })
    expect(service.nodes.get("disk:/new.md")?.text).toBe(NEW)
  })

  it("an overwrite asks as files.delete does, and a no sends nothing", async () => {
    withPermissions({ "files.delete": "ask" })
    const { service, cli } = setup()
    const asked: string[] = []
    const refused = await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD)], {
      answer: (question) => {
        asked.push(question)
        return "n"
      },
    })
    expect(refused.code).not.toBe(0)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain("files.delete")
    expect(service.calls).toEqual([])
  })
})

describe("files restore", () => {
  it("puts back a version history lists, keeping the current content first", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    await cli(["update", "/notes.md", "--text", NEW, "--expected-fingerprint", sha256(OLD), "--json"])
    const restored = await cli(["restore", "/notes.md", sha256(OLD), "--expected-fingerprint", sha256(NEW), "--json"])
    expect(restored.code, restored.err).toBe(0)
    expect(restored.json().item).toMatchObject({
      path: "disk:/notes.md",
      sha256: sha256(OLD),
      restored: sha256(OLD),
      replaced: { sha256: sha256(NEW) },
    })
    expect(service.nodes.get("disk:/notes.md")?.text).toBe(OLD)
    const history = (await cli(["history", "/notes.md", "--json"])).json().item as { versions: object[] }
    expect(history.versions).toEqual([
      expect.objectContaining({ version: sha256(OLD) }),
      expect.objectContaining({ version: sha256(NEW), direction: "restored", available: true }),
    ])
    const gone = await cli(["restore", "/notes.md", sha256("never kept"), "--expected-fingerprint", sha256(OLD)])
    expect(gone.json()).toMatchObject({ error: { code: "not_found" } })
  })

  it("with no version still brings a file back from the Disk's trash", async () => {
    const service = diskApi()
    const restored = await runCli(["personal", "files", "restore", "/old.txt", "--yes", "--json"], { service })
    expect(restored.code, restored.err).toBe(0)
    expect(restored.json().item).toMatchObject({ path: "trash:/old.txt", operation_id: expect.any(String) })
    expect(service.calls[0]?.query).toMatchObject({ path: "trash:/old.txt" })
  })
})

describe("Office files edited in place", () => {
  it("sheets show gives the cells and the sha256; sheets update writes them and keeps the rest", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    const shown = await cli(["sheets", "show", "/budget.xlsx", "Synthetic Budget!A1:B2", "--json"])
    expect(shown.code, shown.err).toBe(0)
    const item = shown.json().item as { sha256: string; sheets: { name: string; cells: { address: string }[] }[] }
    expect(item.sha256).toBe(sha256(fixture("budget.xlsx")))
    expect(item.sheets[0]?.cells.map((cell) => cell.address)).toEqual(["A1", "B1", "A2", "B2"])

    const stale = await cli(
      ["sheets", "update", "/budget.xlsx", "B2", "--values", "[[1300]]", "--expected-fingerprint", sha256("x")],
      {},
    )
    expect(stale.json()).toMatchObject({ error: { code: "conflict", reason: "mirror.remote-changed" } })

    const updated = await cli([
      "sheets",
      "update",
      "/budget.xlsx",
      "B2:C2",
      "--values",
      '[[1300, "paid"]]',
      "--expected-fingerprint",
      item.sha256,
      "--json",
    ])
    expect(updated.code, updated.err).toBe(0)
    expect(updated.json().item).toMatchObject({ replaced: { sha256: item.sha256 } })
    const bytes = new Uint8Array(service.nodes.get("disk:/budget.xlsx")?.bytes ?? [])
    const [sheet] = await readXlsxCells(bytes, {})
    const value = (address: string) => sheet?.cells.find((cell) => cell.address === address)?.value
    expect(value("B2")).toBe(1300)
    expect(value("C2")).toBe("paid")
    expect(value("A3")).toBe("Heron food")
  })

  it("sheets update refuses a formula cell unless --replace, which says Excel recalculates the workbook", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    const fingerprint = () => sha256(service.nodes.get("disk:/budget.xlsx")?.bytes ?? "")
    const refused = await cli([
      "sheets",
      "update",
      "/budget.xlsx",
      "B4",
      "--values",
      "[[1]]",
      "--expected-fingerprint",
      fingerprint(),
      "--json",
    ])
    expect(refused.json()).toMatchObject({ error: { code: "validation_error", reason: "office.formula-cell" } })
    expect(JSON.stringify(refused.json())).toContain("--replace")
    const replaced = await cli([
      "sheets",
      "update",
      "/budget.xlsx",
      "B4",
      "--values",
      "[[1]]",
      "--expected-fingerprint",
      fingerprint(),
      "--replace",
      "--json",
    ])
    expect(replaced.code, replaced.err).toBe(0)
    const [sheet] = await readXlsxCells(new Uint8Array(service.nodes.get("disk:/budget.xlsx")?.bytes ?? []), {})
    expect(sheet?.cells.find((cell) => cell.address === "B4")).toMatchObject({ value: 1 })
    expect(sheet?.cells.find((cell) => cell.address === "B4")?.formula).toBeUndefined()
  })

  it("documents show gives the paragraphs and the sha256; documents update changes one and keeps the rest", async () => {
    withPermissions({ "files.delete": "allow" })
    const { service, cli } = setup()
    const shown = await cli(["documents", "show", "/letter.docx", "--json"])
    expect(shown.code, shown.err).toBe(0)
    const item = shown.json().item as { sha256: string; paragraphs: { index: number; text: string }[] }
    expect(item.paragraphs.map((one) => one.text)).toContain("Plain second paragraph.")
    const updated = await cli([
      "documents",
      "update",
      "/letter.docx",
      "--payload",
      '[{"index": 2, "text": "A new second paragraph."}, {"insert_after": 5, "text": "Signed, the heron."}]',
      "--expected-fingerprint",
      item.sha256,
      "--json",
    ])
    expect(updated.code, updated.err).toBe(0)
    expect(updated.json().item).toMatchObject({ paragraphs: { replaced: [2], inserted: 1, deleted: [] } })
    const bytes = new Uint8Array(service.nodes.get("disk:/letter.docx")?.bytes ?? [])
    const texts = (await readDocxParagraphs(bytes)).map((one) => one.text)
    expect(texts).toEqual([
      "Synthetic letter",
      "Dear heron, the pond is ready.",
      "A new second paragraph.",
      "Cell one",
      "Cell two",
      "Closing words.",
      "Signed, the heron.",
    ])
    const history = (await cli(["history", "/letter.docx", "--json"])).json().item as { versions: object[] }
    expect(history.versions).toEqual([expect.objectContaining({ version: item.sha256, available: true })])
  })

  it("sheets create and documents create write new files on the Disk and refuse one that is there", async () => {
    const { service, cli } = setup()
    const sheet = await cli([
      "sheets",
      "create",
      "/costs.xlsx",
      "--values",
      '[["Item", "Cost"], ["Rent", 950]]',
      "--name",
      "Costs",
      "--json",
    ])
    expect(sheet.code, sheet.err).toBe(0)
    const workbook = new Uint8Array(service.nodes.get("disk:/costs.xlsx")?.bytes ?? [])
    expect(sheet.json().item).toMatchObject({ path: "disk:/costs.xlsx", sha256: sha256(workbook) })
    const [costs] = await readXlsxCells(workbook, {})
    expect(costs?.name).toBe("Costs")
    expect(costs?.cells.find((cell) => cell.address === "B2")?.value).toBe(950)

    const document = await cli([
      "documents",
      "create",
      "/report.docx",
      "--payload",
      '[{"text": "Report", "style": "Title"}, {"text": "The pond is ready."}]',
      "--json",
    ])
    expect(document.code, document.err).toBe(0)
    const docx = new Uint8Array(service.nodes.get("disk:/report.docx")?.bytes ?? [])
    expect((await readDocxParagraphs(docx)).map((one) => one.text)).toEqual(["Report", "The pond is ready."])

    const there = await cli(["sheets", "create", "/budget.xlsx", "--values", "[[1]]", "--json"])
    expect(there.json()).toMatchObject({ error: { code: "conflict", reason: "office.file-exists" } })
  })

  it("a download of a .docx or .xlsx answers its text without a sha256 to write it back with", async () => {
    const { cli } = setup()
    for (const path of ["/letter.docx", "/budget.xlsx"]) {
      const read = await cli(["download", path, "--json"])
      expect(read.code, read.err).toBe(0)
      expect(read.json().item).toMatchObject({ sha256: null, truncated: false, text: expect.any(String) })
      const shown = await cli(["show", path, "--json"])
      expect(shown.json().item).toMatchObject({ sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) })
    }
  })
})
