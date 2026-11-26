import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CliError, isCliError, memoryKeyring } from "@wirecat/cli-base"
import { linkFetch, ProfileTokenStore } from "@wirecat/cli-core/cli"
import { type FeedlessDocumentSource, syncDocuments } from "@wirecat/cli-core/documents"
import { documentProfile } from "@wirecat/cli-core/documents/cli"
import { documentCommandsContract, documentSourceContract } from "@wirecat/cli-core/documents/testing"
import { afterEach, describe, expect, it } from "vitest"
import { libraryCommands } from "./commands/library.js"
import { PACE } from "./context.js"
import { IDENTITY } from "./identity.js"
import { createProgram } from "./program.js"
import { FAKE_TOKEN, type FakeDisk, fakeDisk } from "./testing/fake-disk.js"
import { runCli, signedIn } from "./testing/harness.js"
import { type DiskFile, diskSource, isFolder, skipReason } from "./yandex/source.js"
import { transport } from "./yandex/transport.js"

const LINKS = ["downloader.disk.yandex.ru"]

const tree = () => {
  const disk = fakeDisk()
  disk.put("disk:/Work")
  disk.put("disk:/Work/plan.txt", "quarterly budget for the test team")
  disk.put("disk:/Work/Notes/review.md", "# Review\n\nnotes from the planning review")
  disk.put("disk:/Work/photo.jpg", "not text", "image/jpeg")
  disk.put("disk:/Other/elsewhere.txt", "outside the chosen folder")
  return disk
}

const sourceOver = (disk: FakeDisk) =>
  diskSource(transport({ token: FAKE_TOKEN, fetch: disk.fetch }), linkFetch({ hosts: LINKS, fetch: disk.fetch }))

/** Each test gets its own folders, so one test's sync never reads another's. */
const sandbox = () => {
  const dir = mkdtempSync(join(tmpdir(), "ydisk-library-"))
  return {
    YDISK_STATE_DIR: join(dir, "state"),
    YDISK_CONFIG_DIR: join(dir, "config"),
    YDISK_CACHE_DIR: join(dir, "cache"),
    MESSAGING_STORE: join(dir, "wirecat.db"),
  }
}

describe("the Yandex Disk source", () => {
  for (const c of documentSourceContract<DiskFile>(async () => {
    const disk = tree()
    const raw = sourceOver(disk)
    const top = await raw.byPath("disk:/Work")
    // The CLI reads a chosen folder's path from its settings; the fixture does the same.
    const source: FeedlessDocumentSource<DiskFile> = {
      ...raw,
      metadata: (id: string, known?: DiskFile) => raw.metadata(id, known ?? (id === top.id ? top : undefined)),
    }
    const state = documentProfile<DiskFile>(IDENTITY, sandbox(), "personal").state("1000")
    const saved = new Set<string>()
    return {
      source,
      root: top.id,
      isFolder,
      missing: "fake-unknown",
      change: async () => {
        disk.put("disk:/Work/new.txt", "a new budget file")
      },
      remove: async () => {
        const id = disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string
        disk.remove("disk:/Work/plan.txt")
        return id
      },
      faults: {
        deny: (status) => {
          disk.deny("disk:/Work/plan.txt", status)
          return disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string
        },
        sync: async ({ wrap, budget, deadline, signal, now }) => {
          const result = await syncDocuments<DiskFile>({
            source: wrap(source),
            index: {
              save: async (_principal, content) => {
                saved.add(content.metadata.id)
                return `document:${saved.size}`
              },
              remove: async (_principal, id) => {
                saved.delete(id)
              },
              openPictures: async () => {
                throw new CliError("not_found", "no pictures")
              },
            },
            state,
            principal: "1000",
            roots: [top.id],
            textLimit: 100_000,
            max: 1_000,
            maxEntries: 1_000,
            isFolder,
            skipReason,
            retryable: () => false,
            errorOf: (error) => (isCliError(error) ? error : new CliError("provider_error", String(error))),
            assertHeld: () => undefined,
            storeVersion: "test",
            ...(budget ? { budget } : {}),
            ...(deadline ? { deadline } : {}),
            ...(signal ? { signal } : {}),
            ...(now ? { now } : {}),
          })
          return { result, saved: [...saved] }
        },
      },
    }
  }))
    it(c.name, c.run)

  it("never sends the token to the download host and asks the API only what the fake knows", async () => {
    const disk = tree()
    const answer = await runCli(["personal", "folders", "add", "/Work", "--json"], { service: disk, env: sandbox() })
    expect(answer.code, answer.err).toBe(0)
    const env = { ...sandbox() }
    await runCli(["personal", "folders", "add", "disk:/Work", "--json"], { service: disk, env })
    const synced = await runCli(["personal", "sync", "--json"], { service: disk, env })
    expect(synced.code, synced.err).toBe(0)
    expect(disk.refusals).toEqual([])
    const downloads = disk.calls.filter((call) => call.url.host === "downloader.disk.yandex.ru")
    expect(downloads.length).toBeGreaterThan(0)
    expect(downloads.every((call) => !call.auth)).toBe(true)
  })

  it("keeps a moved file's id, so its tags stay, and drops a file deleted on the Disk", async () => {
    const disk = tree()
    const env = sandbox()
    const run = (...argv: string[]) => runCli(["personal", ...argv, "--json"], { service: disk, env })
    await run("folders", "add", "/Work")
    expect((await run("sync")).json().item).toMatchObject({ saved: 2 })
    const id = disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string
    expect((await run("tags", "add", id, "budget")).code).toBe(0)
    disk.move("disk:/Work/plan.txt", "disk:/Work/Notes/plan.txt")
    disk.remove("disk:/Work/Notes/review.md")
    expect((await run("sync")).json().item).toMatchObject({ removed: 1 })
    const shown = (await run("documents", "show", id)).json()
    expect(JSON.stringify(shown)).toContain("disk:/Work/Notes/plan.txt")
    expect(((await run("tags", "list", id)).json().items as { tag: string }[]).map((tag) => tag.tag)).toEqual([
      "budget",
    ])
  })
  // Nine runs of the CLI, more than the default time allows on a busy runner.
  it("a file files update replaces under the Disk's check gets a new id, and its tags and notes go with it", async () => {
    const disk = tree()
    const env = sandbox()
    const run = (...argv: string[]) => runCli(["personal", ...argv, "--json"], { service: disk, env })
    await run("folders", "add", "/Work")
    await run("sync")
    const old = disk.nodes.get("disk:/Work/plan.txt")
    expect((await run("tags", "add", old?.resource_id as string, "budget")).code).toBe(0)
    expect((await run("notes", "add", old?.resource_id as string, "check the totals")).code).toBe(0)
    const edited = await run(
      "files",
      "update",
      "/Work/plan.txt",
      "--text",
      "the budget was cut in half",
      "--expected-fingerprint",
      old?.sha256 as string,
      "--yes",
    )
    expect(edited.code, edited.err).toBe(0)
    const id = disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string
    expect(id).not.toBe(old?.resource_id)
    const tags = async () => ((await run("tags", "list", id)).json().items as { tag: string }[]).map((tag) => tag.tag)
    const notes = async () => JSON.stringify((await run("notes", "list", id)).json())
    await run("sync")
    expect(await tags()).toEqual(["budget"])
    expect(await notes()).toContain("check the totals")
    expect(JSON.stringify((await run("documents", "show", id)).json())).toContain("cut in half")
  }, 30_000)
})

describe("the file-size budget", () => {
  const file = (size: number) => ({ id: "f", name: "big.pdf", mime: "application/pdf", size }) as DiskFile

  it("reads a file up to 10 GiB by default and follows MESSAGING_ATTACHMENT_MAX_MIB", () => {
    expect(skipReason(file(10 * 1024 ** 3), {})).toBeUndefined()
    expect(skipReason(file(10 * 1024 ** 3 + 1), {})).toBe(
      "file is larger than 10 GiB; configure MESSAGING_ATTACHMENT_MAX_MIB",
    )
    expect(skipReason(file(2 * 1024 ** 2), { MESSAGING_ATTACHMENT_MAX_MIB: "1" })).toBe(
      "file is larger than 1 MiB; configure MESSAGING_ATTACHMENT_MAX_MIB",
    )
  })
})

describe("the history of synced files", () => {
  it("keeps a changed file's earlier text, and a file gone from the Disk as no longer visible, not deleted", async () => {
    const disk = tree()
    const env = sandbox()
    const run = (...argv: string[]) => runCli(["personal", ...argv, "--json"], { service: disk, env })
    await run("folders", "add", "/Work")
    await run("sync")
    const id = disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string
    disk.put("disk:/Work/plan.txt", "the budget was cut in half")
    await run("sync")
    disk.remove("disk:/Work/Notes/review.md")
    expect((await run("sync")).json().item).toMatchObject({ removed: 1 })

    const versions = (await run("documents", "history", id)).json().item as { versions: unknown[] }
    expect(versions.versions.length).toBeGreaterThanOrEqual(2)
    expect(JSON.stringify((await run("documents", "history", id, "--revision", "1")).json())).toContain(
      "quarterly budget",
    )
    const events = ((await run("changes", "--since", "1h")).json().items as { path: string; event: string }[]).map(
      (row) => row.event,
    )
    expect(events).toEqual(expect.arrayContaining(["changed", "unavailable"]))
    expect(events).not.toContain("deleted")
    const until = new Date(Date.now() + 60_000).toISOString()
    const only = (
      await run("changes", "--since", "1h", "--until", until, "--event", "unavailable", "--limit", "5", "--page", "1")
    ).json().items as { path: string; event: string }[]
    expect(only.map((row) => row.event)).toEqual(["unavailable"])
  })
})

describe("a chosen folder renamed on the Disk", () => {
  it("is unavailable and its copies leave, until it is added again under its new path", async () => {
    const disk = tree()
    const env = sandbox()
    const run = (...argv: string[]) => runCli(["personal", ...argv, "--json"], { service: disk, env })
    await run("folders", "add", "/Work")
    expect((await run("sync")).json().item).toMatchObject({ saved: 2 })
    disk.move("disk:/Work", "disk:/Renamed")
    expect((await run("sync")).json().item).toMatchObject({ removed: 3 })
    expect((await run("folders", "add", "/Renamed")).code).toBe(0)
    expect((await run("sync")).json().item).toMatchObject({ saved: 2 })
  })
})

describe("the shared documents commands over Yandex Disk", () => {
  for (const c of documentCommandsContract(async () => {
    const disk = tree()
    const env = sandbox()
    const run = async (argv: string[]) => {
      const answer = await runCli(["personal", ...argv, "--json"], { service: disk, env })
      return { exit: answer.code, stdout: answer.out }
    }
    await run(["folders", "add", "/Work"])
    return {
      program: createProgram(),
      words: { app: "ydisk", remote: "disk", provider: "Yandex Disk", source: "yandex-disk" },
      run,
      document: disk.nodes.get("disk:/Work/plan.txt")?.resource_id as string,
      word: "quarterly",
    }
  }))
    it(c.name, c.run)

  it("mounts the shared groups once", () => {
    expect(libraryCommands().map((command) => command.name())).toContain("folders")
  })
})

describe("Disk times", () => {
  const zone = process.env.TZ
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  })

  // Yandex sends each time with an offset; the computer's zone must not change what is stored or answered (WC-TIME-6).
  const timesIn = async (tz: string) => {
    process.env.TZ = tz
    const disk = tree()
    const plan = disk.nodes.get("disk:/Work/plan.txt")
    if (!plan) throw new Error("the tree has no plan.txt")
    plan.modified = "2026-01-02T03:00:00+03:00"
    const env = sandbox()
    const run = (...argv: string[]) => runCli(["personal", ...argv, "--json"], { service: disk, env })
    await run("folders", "add", "/Work")
    expect((await run("sync")).code).toBe(0)
    const listed = (await run("documents", "list")).json().items as { id: string; modified_at: string }[]
    const shown = (await run("files", "show", "/Work/plan.txt")).json().item as { modified_at: string }
    return { stored: listed.find((one) => one.id === plan.resource_id)?.modified_at, live: shown.modified_at }
  }

  it("are kept and answered in UTC, the same under any zone", async () => {
    const utc = "2026-01-02T00:00:00.000Z"
    expect(await timesIn("Asia/Vladivostok")).toEqual({ stored: utc, live: utc })
    expect(await timesIn("America/Los_Angeles")).toEqual({ stored: utc, live: utc })
  })
})

describe("folders browse", () => {
  const browse = async (...argv: string[]) => {
    const disk = tree()
    disk.put("disk:/Work/Deep/Inner/old.txt", "two folders down")
    const answer = await runCli(["personal", "folders", "browse", ...argv, "--json"], { service: disk, env: sandbox() })
    expect(answer.code, answer.err).toBe(0)
    return answer.json().items as Record<string, unknown>[]
  }

  it("names each folder's kind and tells one that holds a folder from one that holds only files", async () => {
    const items = await browse("--folder", "/Work")
    expect(items.map((item) => item.name)).toEqual(["Deep", "Notes"])
    for (const item of items) expect(item).toMatchObject({ kind: "folder", added: false })
    expect(Object.fromEntries(items.map((item) => [item.name, item.has_children]))).toEqual({
      Deep: true,
      Notes: false,
    })
  })

  it("marks the folder names and paths in a scheduled agent's run", async () => {
    const MARK = "0123456789abcdef"
    const marked = (text: string) => new RegExp(`^⟦untrusted:${MARK} source=[^⟧]+⟧${text}⟦/untrusted:${MARK}⟧$`)
    const answer = await runCli(["personal", "folders", "browse", "--folder", "/Work", "--json"], {
      service: tree(),
      env: { ...sandbox(), YDISK_READ_ONLY: "1", YDISK_UNTRUSTED_MARK: MARK },
    })
    expect(answer.code, answer.err).toBe(0)
    const notes = (answer.json().items as Record<string, unknown>[]).find((item) => String(item.name).includes("Notes"))
    expect(notes?.name).toMatch(marked("Notes"))
    expect(notes?.path).toMatch(marked("disk:/Work/Notes"))
  })

  it("leaves has_children null for a folder it cannot list, and keeps the others", async () => {
    const disk = tree()
    disk.put("disk:/Work/Deep/Inner/old.txt", "two folders down")
    disk.put("disk:/Work/Locked/x.txt", "x")
    disk.deny("disk:/Work/Locked", 403)
    const answer = await runCli(["personal", "folders", "browse", "--folder", "/Work", "--json"], { service: disk })
    expect(answer.code, answer.err).toBe(0)
    const items = answer.json().items as { name: string; has_children: boolean | null }[]
    expect(Object.fromEntries(items.map((item) => [item.name, item.has_children]))).toEqual({
      Deep: true,
      Locked: null,
      Notes: false,
    })
  })

  it("leaves has_children null, and asks for no listing inside, on a level with more folders than the burst", async () => {
    const disk = tree()
    for (let n = 0; n <= PACE.burst; n++) disk.put(`disk:/Many/f${String(n).padStart(2, "0")}/x.txt`, "x")
    const answer = await runCli(["personal", "folders", "browse", "--folder", "/Many", "--json"], { service: disk })
    const items = answer.json().items as { has_children: boolean | null }[]
    expect(items).toHaveLength(PACE.burst + 1)
    for (const item of items) expect(item.has_children).toBeNull()
    expect(disk.calls.filter((call) => call.url.searchParams.get("path")?.startsWith("disk:/Many/f"))).toEqual([])
  })

  it("says page.next_cursor, the key the answer has, in its help and its refusal", async () => {
    const help = await runCli(["personal", "folders", "browse", "--help"])
    expect(help.out).toContain("page.next_cursor")
    const bad = await runCli(["personal", "folders", "browse", "--cursor", "x", "--json"], { service: tree() })
    expect(JSON.stringify(bad.json())).toContain("page.next_cursor")
  })
})

describe("store info", () => {
  it("reads the shared store without a sign-in and changes nothing", async () => {
    const env = sandbox()
    const answer = await runCli(["store", "info", "--json"], { env, keyring: memoryKeyring() })
    expect(answer.code, answer.err).toBe(0)
    expect(answer.json().item).toMatchObject({ path: env.MESSAGING_STORE, exists: false })
    expect(existsSync(env.MESSAGING_STORE)).toBe(false)
  })
})

describe("account remove", () => {
  it("asks which way the data goes, and removes nothing until it is told", async () => {
    const keyring = signedIn()
    const env = sandbox()
    await runCli(["personal", "session", "start", "--json"], { env, keyring, stdin: FAKE_TOKEN })
    const answer = await runCli(["personal", "account", "remove", "--yes", "--json"], { keyring, env })
    expect(answer.code).not.toBe(0)
    expect(new ProfileTokenStore({ app: IDENTITY, keyring }).read("personal")).toBeDefined()
  })

  it("--dry-run lists what it would remove and removes nothing", async () => {
    const env = sandbox()
    const keyring = signedIn()
    await runCli(["personal", "session", "start", "--json"], { env, keyring, stdin: FAKE_TOKEN })
    const answer = await runCli(["personal", "account", "remove", "--keep-data", "--dry-run", "--json"], {
      keyring,
      env,
    })
    expect(answer.code, answer.err).toBe(0)
    expect(new ProfileTokenStore({ app: IDENTITY, keyring }).read("personal")).toBeDefined()
  })

  it("--keep-data signs the profile out and leaves the chosen folders", async () => {
    const disk = tree()
    const env = sandbox()
    const keyring = signedIn()
    await runCli(["personal", "session", "start", "--json"], { service: disk, env, keyring, stdin: FAKE_TOKEN })
    await runCli(["personal", "folders", "add", "/Work", "--json"], { service: disk, env, keyring })
    const answer = await runCli(["personal", "account", "remove", "--keep-data", "--yes", "--json"], {
      keyring,
      env,
    })
    expect(answer.code, answer.err).toBe(0)
    expect(new ProfileTokenStore({ app: IDENTITY, keyring }).read("personal")).toBeUndefined()
    expect(documentProfile(IDENTITY, { ...process.env, ...env }, "personal").folders().roots).toHaveLength(1)
  })

  it("--delete-data also removes the chosen folders and the synced files", async () => {
    const disk = tree()
    const env = sandbox()
    const keyring = signedIn()
    await runCli(["personal", "session", "start", "--json"], { service: disk, env, keyring, stdin: FAKE_TOKEN })
    await runCli(["personal", "folders", "add", "/Work", "--json"], { service: disk, env, keyring })
    await runCli(["personal", "sync", "--json"], { service: disk, env, keyring })
    const rows = async () => {
      const info = (await runCli(["store", "info", "--json"], { env, keyring })).json().item as {
        rows: Record<string, number>
      }
      return info.rows.documents ?? 0
    }
    expect(await rows()).toBeGreaterThan(0)
    const answer = await runCli(["personal", "account", "remove", "--delete-data", "--yes", "--json"], {
      keyring,
      env,
    })
    expect(answer.code, answer.err).toBe(0)
    expect(documentProfile(IDENTITY, { ...process.env, ...env }, "personal").folders().roots).toEqual([])
    expect(await rows()).toBe(0)
  })
})
