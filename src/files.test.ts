import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

const scratch = () => mkdtempSync(join(tmpdir(), "ydisk-files-"))

describe("files", () => {
  it("lists a folder live, as rows with their Disk paths", async () => {
    const service = diskApi()
    const answer = await runCli(["personal", "files", "list", "--folder", "/Work", "--json"], { service })
    expect(answer.code, answer.err).toBe(0)
    expect(answer.json().items).toMatchObject([{ name: "plan.txt", path: "disk:/Work/plan.txt", kind: "file" }])
    expect(service.refusals).toEqual([])
  })

  it("downloads to a new local file, never sends the token to the download host, and keeps an existing file", async () => {
    const service = diskApi()
    const output = join(scratch(), "plan.txt")
    const answer = await runCli(["personal", "files", "download", "/Work/plan.txt", "--output", output, "--json"], {
      service,
    })
    expect(answer.code, answer.err).toBe(0)
    expect(readFileSync(output, "utf8")).toBe("hello")
    expect(service.refusals).toEqual([])
    const again = await runCli(["personal", "files", "download", "/Work/plan.txt", "--output", output, "--json"], {
      service: diskApi(),
    })
    expect(again.code).not.toBe(0)
    expect(again.err + again.out).toContain("already exists")
  })

  it("uploads the bytes to the link the Disk gives, without the token", async () => {
    const service = diskApi()
    const local = join(scratch(), "notes.txt")
    writeFileSync(local, "some notes")
    const answer = await runCli(["personal", "files", "upload", local, "--folder", "/Work", "--json"], { service })
    expect(answer.code, answer.err).toBe(0)
    expect(answer.json().item).toMatchObject({ path: "disk:/Work/notes.txt", status: "done" })
    expect(new TextDecoder().decode(service.uploaded[0])).toBe("some notes")
    expect(service.refusals).toEqual([])
  })

  it("asks files.delete before an overwrite, and answers a long copy's operation id", async () => {
    withPermissions({ "files.delete": "deny" })
    const refused = diskApi()
    const denied = await runCli(
      ["personal", "files", "copy", "/plan.txt", "--folder", "/Archive", "--replace", "--json"],
      { service: refused },
    )
    expect(denied.code).not.toBe(0)
    expect(refused.calls).toEqual([])
    const service = diskApi()
    const copied = await runCli(["personal", "files", "copy", "/plan.txt", "--folder", "/Archive", "--json"], {
      service,
    })
    expect(copied.code, copied.err).toBe(0)
    expect(copied.json().item).toMatchObject({ status: "in-progress", disk_operation: "fake-op-1" })
    expect(service.refusals).toEqual([])
  })

  it("moves a file to the trash, not for good, and asks files.share before a public link", async () => {
    const service = diskApi()
    const trashed = await runCli(["personal", "files", "delete", "/plan.txt", "--yes", "--json"], { service })
    expect(trashed.code, trashed.err).toBe(0)
    expect(service.calls[0]?.query).toMatchObject({ permanently: "false" })
    withPermissions({ "files.share": "deny" })
    const shared = diskApi()
    const refused = await runCli(["personal", "files", "publish", "/plan.txt", "--json"], { service: shared })
    expect(refused.code).not.toBe(0)
    expect(shared.calls).toEqual([])
    withPermissions({ "files.share": "allow" })
    const published = diskApi()
    const done = await runCli(["personal", "files", "publish", "/plan.txt", "--json"], { service: published })
    expect(published.refusals).toEqual([])
    expect(done.code, done.err).toBe(0)
  })
})

describe("files, what an agent may not do and what may not be lost", () => {
  it("an upload whose answer is lost is outcome_unknown, never a plain network error", async () => {
    const service = diskApi({ loseNextWriteAnswer: true })
    const local = join(scratch(), "notes.txt")
    writeFileSync(local, "some notes")
    const answer = await runCli(["personal", "files", "upload", local, "--json"], { service })
    expect(answer.code).not.toBe(0)
    expect(JSON.parse(answer.err)).toMatchObject({ error: { code: "outcome_unknown" } })
  })

  it("refuses to upload a credential file unless the owner allows it", async () => {
    const dir = join(scratch(), ".ssh")
    mkdirSync(dir)
    const key = join(dir, "id_rsa")
    writeFileSync(key, "not a real key")
    const service = diskApi()
    const refused = await runCli(["personal", "files", "upload", key, "--json"], { service })
    expect(refused.code).not.toBe(0)
    expect(refused.err).toContain("credential")
    expect(service.calls).toEqual([])
  })

  it("asks files.delete before an upload with --replace", async () => {
    withPermissions({ "files.delete": "deny" })
    const service = diskApi()
    const local = join(scratch(), "notes.txt")
    writeFileSync(local, "some notes")
    const refused = await runCli(["personal", "files", "upload", local, "--replace", "--json"], { service })
    expect(refused.code).not.toBe(0)
    expect(service.calls).toEqual([])
  })

  it("answers a file's text without --output, and the link operations are not in the api group", async () => {
    const service = diskApi()
    const read = await runCli(["personal", "files", "download", "/Work/plan.txt", "--json"], { service })
    expect(read.code, read.err).toBe(0)
    expect(read.json().item).toMatchObject({ path: "disk:/Work/plan.txt", text: "hello", truncated: false })
    const listed = await runCli(["personal", "api", "list", "--json"], { service })
    const names = JSON.stringify(listed.json())
    expect(names).not.toContain("download-link")
    expect(names).not.toContain("upload-link")
  })

  it("refuses a download whose bytes are not the listed file's, as a retryable provider error", async () => {
    const service = diskApi({ downloadBody: "another file at the same path" })
    const read = await runCli(["personal", "files", "download", "/Work/plan.txt", "--json"], { service })
    expect(read.code).not.toBe(0)
    expect(JSON.parse(read.err)).toMatchObject({ error: { code: "provider_error" } })
  })

  it("says what is wrong with a missing local file or an output folder that does not exist", async () => {
    const missing = await runCli(["personal", "files", "upload", join(scratch(), "nothing.txt"), "--json"], {
      service: diskApi(),
    })
    expect(JSON.parse(missing.err)).toMatchObject({ error: { code: "validation_error" } })
    const output = join(scratch(), "no-such-folder", "plan.txt")
    const saved = await runCli(["personal", "files", "download", "/Work/plan.txt", "--output", output, "--json"], {
      service: diskApi(),
    })
    expect(JSON.parse(saved.err)).toMatchObject({ error: { code: "validation_error", param: "--output" } })
  })

  it("takes the links to a file's bytes out of every api answer", async () => {
    const listed = await runCli(["personal", "api", "resources-list", "--path", "/Work", "--json"], {
      service: diskApi({ resourceExtra: { file: "https://downloader.disk.yandex.ru/secret", preview: "https://x/p" } }),
    })
    expect(listed.code, listed.err).toBe(0)
    expect(listed.out).not.toContain("downloader.disk.yandex.ru")
    expect(listed.out).not.toContain('"preview"')
    expect(listed.out).toContain("plan.txt")
  })

  it("answers a public link's address once, when the owner publishes", async () => {
    withPermissions({ "files.share": "allow" })
    const service = diskApi()
    const done = await runCli(["personal", "files", "publish", "/plan.txt", "--json"], { service })
    expect(done.code, done.err).toBe(0)
    expect(done.json().item).toMatchObject({ public_url: "https://yadi.sk/d/fake-public" })
  })

  it("leaves public_url out, as not known, when the link cannot be read back after the publish", async () => {
    withPermissions({ "files.share": "allow" })
    const done = await runCli(["personal", "files", "publish", "/plan.txt", "--json"], {
      service: diskApi({ publicUrlFails: true }),
    })
    expect(done.code, done.err).toBe(0)
    expect(done.json().item).toMatchObject({ path: "disk:/plan.txt", status: "done" })
    expect(done.json().item).not.toHaveProperty("public_url")
  })
})

describe("files, the options of each command", () => {
  it("download --output saves the file, and --replace replaces one already there", async () => {
    const output = join(scratch(), "plan.txt")
    writeFileSync(output, "old")
    const replaced = await runCli(
      ["personal", "files", "download", "/Work/plan.txt", "--output", output, "--replace", "--json"],
      { service: diskApi() },
    )
    expect(replaced.code, replaced.err).toBe(0)
    expect(readFileSync(output, "utf8")).toBe("hello")
  })

  it("upload --name names the file on the Disk; --allow-any-file sends a refused file", async () => {
    const dir = join(scratch(), ".ssh")
    mkdirSync(dir)
    const key = join(dir, "config")
    writeFileSync(key, "Host example")
    const service = diskApi()
    const sent = await runCli(
      [
        "personal",
        "files",
        "upload",
        key,
        "--folder",
        "/Work",
        "--name",
        "ssh-config.txt",
        "--allow-any-file",
        "--json",
      ],
      { service },
    )
    expect(sent.code, sent.err).toBe(0)
    expect(sent.json().item).toMatchObject({ path: "disk:/Work/ssh-config.txt" })
  })

  it.each(["copy", "move"])("%s --name gives it a new name in --folder", async (name) => {
    const service = diskApi()
    const done = await runCli(
      ["personal", "files", name, "/plan.txt", "--folder", "/Archive", "--name", "old-plan.txt", "--json"],
      { service },
    )
    expect(done.code, done.err).toBe(0)
    expect(done.json().item).toMatchObject({ from: "disk:/plan.txt", path: "disk:/Archive/old-plan.txt" })
  })

  it("folders list names each chosen folder with its Disk path", async () => {
    const service = diskApi()
    const added = await runCli(["personal", "folders", "add", "/Work", "--json"], { service })
    expect(added.code, added.err).toBe(0)
    const listed = await runCli(["personal", "folders", "list", "--json"], { service })
    expect(listed.code, listed.err).toBe(0)
    expect(listed.json().items).toEqual([{ id: "fake-disk:/Work", name: "Work", path: "disk:/Work" }])
  })

  it("folders browse lists the folders one level down, and --cursor goes on from page.next", async () => {
    const service = diskApi()
    const listed = await runCli(["personal", "folders", "browse", "--folder", "/Work", "--json"], { service })
    expect(listed.code, listed.err).toBe(0)
    expect(listed.json()).toMatchObject({ items: [] })
    const bad = await runCli(["personal", "folders", "browse", "--cursor", "x", "--json"], { service: diskApi() })
    expect(bad.code).not.toBe(0)
    const next = await runCli(["personal", "folders", "browse", "--cursor", "200", "--json"], { service: diskApi() })
    expect(next.code, next.err).toBe(0)
  })
})

describe("hashes and long texts", () => {
  const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")
  const OLD = "# Notes\nthe first draft\n"
  const setup = () => {
    const service = fakeDisk()
    service.put("disk:/notes.md", OLD, "text/markdown")
    return service
  }

  it("show and download give the file's md5 and sha256", async () => {
    const service = setup()
    const shown = await runCli(["personal", "files", "show", "/notes.md", "--json"], { service })
    expect(shown.json().item).toMatchObject({ sha256: sha256(OLD), md5: expect.any(String) })
    const read = await runCli(["personal", "files", "download", "/notes.md", "--json"], { service })
    expect(read.json().item).toMatchObject({ text: OLD, sha256: sha256(OLD), truncated: false })
  })

  it("a text longer than 200,000 characters is cut there and says truncated: true", async () => {
    const service = setup()
    service.put("disk:/long.txt", "x".repeat(200_010))
    const read = await runCli(["personal", "files", "download", "/long.txt", "--json"], { service })
    const item = read.json().item as { text: string; truncated: boolean; sha256: string | null }
    expect(item.truncated).toBe(true)
    expect(item.text).toHaveLength(200_000)
    // A cut text gives nothing to write it back with; files show still gives the file's own hash.
    expect(item.sha256).toBeNull()
    const shown = await runCli(["personal", "files", "show", "/long.txt", "--json"], { service })
    expect(shown.json().item).toMatchObject({ sha256: sha256("x".repeat(200_010)) })
  })
})
