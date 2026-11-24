import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { metaOf } from "@wirecat/cli-base/commands"
import type { Command } from "commander"
import { expect, it } from "vitest"
import { definition, run } from "./program.js"
import { type FakeDisk, fakeDisk } from "./testing/fake-disk.js"
import { runCli, signedIn } from "./testing/harness.js"

/** A Disk folder and a local folder for one test, with its own state and config, so no test sees another's mirror. */
const setup = (files: Record<string, string> = {}, local: Record<string, string> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), "ydisk-mirror-"))
  const root = join(dir, "notes")
  mkdirSync(root)
  for (const [path, text] of Object.entries(local)) write(root, path, text)
  const disk = fakeDisk()
  disk.put("disk:/Notes")
  for (const [path, text] of Object.entries(files)) disk.put(`disk:/Notes/${path}`, text)
  const env = { YDISK_STATE_DIR: join(dir, "state"), YDISK_CONFIG_DIR: join(dir, "config") }
  const cli = (args: string[], options: { env?: object } = {}) =>
    runCli(["personal", "mirrors", ...args, "--json"], { service: disk, env: { ...env, ...options.env } })
  const permit = (permissions: Record<string, string>) => {
    mkdirSync(env.YDISK_CONFIG_DIR, { recursive: true })
    writeFileSync(
      join(env.YDISK_CONFIG_DIR, "config.json"),
      JSON.stringify({ profiles: { personal: { permissions } } }),
    )
  }
  return { dir, root, disk, env, cli, permit }
}

const write = (root: string, path: string, text: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true })
  writeFileSync(join(root, path), text)
}
const read = (root: string, path: string) => readFileSync(join(root, path), "utf8")
const text = (disk: FakeDisk, path: string) => disk.nodes.get(`disk:/Notes/${path}`)?.text

type Synced = {
  uploaded: string[]
  downloaded: string[]
  adopted: string[]
  trashed: { path: string; side: string }[]
  renamed: { from: string; to: string }[]
  conflicts: { path: string; reason: string }[]
  unknown: { path: string; side: string }[]
  errors: { path: string; code: string }[]
  plan?: { kind: string; path: string }[]
  too_many_deletions?: number
}

const added = async (cli: ReturnType<typeof setup>["cli"], root: string) => {
  const ran = await cli(["add", "/Notes", root])
  expect(ran.code, ran.err).toBe(0)
  return (ran.json().item as { id: string }).id
}
/** With --yes: files.delete asks by default, and every replace or deletion checks it. */
const synced = async (cli: ReturnType<typeof setup>["cli"], ...args: string[]) => {
  const ran = await cli(["sync", ...args, "--yes"])
  const items = (ran.json().items ?? []) as Synced[]
  return { code: ran.code, err: ran.err, json: ran.json, result: items[0] as Synced }
}
const localTrash = (root: string) => {
  const trash = join(root, ".wirecat-trash")
  return existsSync(trash) ? readdirSync(trash, { recursive: true, encoding: "utf8" }) : []
}

it("adds a mirror for a Disk folder, and refuses a local path that is not a folder", async () => {
  const { cli, root, dir } = setup()
  const ran = await cli(["add", "/Notes", root])
  expect(ran.json().item).toMatchObject({ path: root, folder: "disk:/Notes", added: true })
  const again = await cli(["add", "disk:/Notes", root])
  expect(again.json().item).toMatchObject({ added: false })
  expect((await cli(["list"])).json().items).toEqual([
    { id: expect.any(String), path: root, folder: "disk:/Notes", ignore: [] },
  ])
  writeFileSync(join(dir, "file.txt"), "x")
  const refused = await cli(["add", "/Notes", join(dir, "file.txt")])
  expect(refused.json()).toMatchObject({ error: { code: "validation_error", reason: "mirror.not-folder" } })
})

it("a first sync adopts identical files, copies one-sided ones both ways, and reports different ones", async () => {
  const { cli, root, disk } = setup(
    { "same.txt": "same", "disk-only.txt": "from the disk", "both.txt": "disk version" },
    { "same.txt": "same", "sub/local-only.txt": "from here", "both.txt": "local version" },
  )
  const id = await added(cli, root)
  const first = await synced(cli, id)
  expect(first.code).not.toBe(0)
  expect(first.result).toMatchObject({
    adopted: ["same.txt"],
    uploaded: ["sub/local-only.txt"],
    downloaded: ["disk-only.txt"],
    conflicts: [{ path: "both.txt", reason: expect.stringContaining("both sides") }],
  })
  expect(first.json()).toMatchObject({ meta: { complete: false, issues: [{ reason: "mirror.partial" }] } })
  expect(text(disk, "sub/local-only.txt")).toBe("from here")
  expect(read(root, "disk-only.txt")).toBe("from the disk")
  expect(read(root, "both.txt")).toBe("local version")
  expect(text(disk, "both.txt")).toBe("disk version")

  const preview = await cli(["preview", id, "--keep", "disk"])
  expect((preview.json().items as Synced[])[0]?.plan).toEqual([{ kind: "download", path: "both.txt" }])
  const kept = await synced(cli, id, "--keep", "disk")
  expect(kept.code, kept.err).toBe(0)
  expect(read(root, "both.txt")).toBe("disk version")
  expect(disk.refusals).toEqual([])
})

it("copies edits both ways, and settles a conflict with --keep both", async () => {
  const { cli, root, disk } = setup({ "a.txt": "a1", "b.txt": "b1", "c.txt": "c1" })
  const id = await added(cli, root)
  expect((await synced(cli, id)).code).toBe(0)
  write(root, "a.txt", "a2 here")
  disk.put("disk:/Notes/b.txt", "b2 on the disk")
  write(root, "c.txt", "c2 here")
  disk.put("disk:/Notes/c.txt", "c2 on the disk")
  const second = await synced(cli, id)
  expect(second.result).toMatchObject({ uploaded: ["a.txt"], downloaded: ["b.txt"], conflicts: [{ path: "c.txt" }] })
  expect(text(disk, "a.txt")).toBe("a2 here")
  expect(read(root, "b.txt")).toBe("b2 on the disk")

  const both = await synced(cli, id, "--keep", "both")
  expect(both.code, both.err).toBe(0)
  const copy = readdirSync(root).find((name) => name.startsWith("c (conflict "))
  expect(copy).toMatch(/^c \(conflict \d{4}-\d{2}-\d{2} disk\)\.txt$/u)
  expect(read(root, "c.txt")).toBe("c2 here")
  expect(read(root, copy as string)).toBe("c2 on the disk")
  expect(text(disk, copy as string)).toBe("c2 on the disk")
  expect(text(disk, "c.txt")).toBe("c2 here")
})

it("a deletion on either side goes to the other side's trash, never away", async () => {
  const { cli, root, disk } = setup({ "keep.txt": "k", "gone-here.txt": "g1", "gone-there.txt": "g2" })
  const id = await added(cli, root)
  await synced(cli, id)
  rmSync(join(root, "gone-here.txt"))
  disk.remove("disk:/Notes/gone-there.txt")
  const ran = await synced(cli, id)
  expect(ran.code, ran.err).toBe(0)
  expect(ran.result.trashed).toEqual([
    { path: "gone-here.txt", side: "remote" },
    { path: "gone-there.txt", side: "local" },
  ])
  expect(disk.trash.get("disk:/Notes/gone-here.txt")?.text).toBe("g1")
  expect(existsSync(join(root, "gone-there.txt"))).toBe(false)
  expect(localTrash(root).some((path) => path.endsWith("gone-there.txt"))).toBe(true)
  expect(text(disk, "keep.txt")).toBe("k")
})

it("a file missing from an incomplete listing, or a missing Disk folder, is not taken as deleted", async () => {
  const { cli, root, disk } = setup({ "top.txt": "t", "Locked/inside.txt": "i" })
  const id = await added(cli, root)
  await synced(cli, id)
  disk.deny("disk:/Notes/Locked", 403)
  const partial = await synced(cli, id)
  expect(partial.code).not.toBe(0)
  expect(partial.result.unknown).toEqual([{ path: "Locked/inside.txt", side: "remote", reason: expect.any(String) }])
  expect(read(root, "Locked/inside.txt")).toBe("i")
  expect(localTrash(root)).toEqual([])

  disk.remove("disk:/Notes")
  const gone = await synced(cli, id)
  expect(gone.code).not.toBe(0)
  expect(gone.result.errors).toEqual([{ path: ".", code: "not_found", message: expect.any(String) }])
  expect(read(root, "top.txt")).toBe("t")
  expect(localTrash(root)).toEqual([])
})

it("a file moved on the Disk is renamed here by its resource_id", async () => {
  const { cli, root, disk } = setup({ "old.txt": "moving" })
  const id = await added(cli, root)
  await synced(cli, id)
  disk.put("disk:/Notes/Archive")
  disk.move("disk:/Notes/old.txt", "disk:/Notes/Archive/new.txt")
  const ran = await synced(cli, id)
  expect(ran.code, ran.err).toBe(0)
  expect(ran.result.renamed).toEqual([{ from: "old.txt", to: "Archive/new.txt" }])
  expect(read(root, "Archive/new.txt")).toBe("moving")
  expect(existsSync(join(root, "old.txt"))).toBe(false)
  expect(localTrash(root)).toEqual([])
})

it("a Disk file changed between the listing and its deletion stays: the md5 check refuses the delete", async () => {
  const { cli, root, disk } = setup({ "race.txt": "first", "stays.txt": "s" })
  const id = await added(cli, root)
  await synced(cli, id)
  rmSync(join(root, "race.txt"))
  disk.beforeWrite = (method, path) => {
    if (method === "DELETE" && path === "disk:/Notes/race.txt") disk.put(path, "edited elsewhere")
  }
  const ran = await synced(cli, id)
  expect(ran.code).not.toBe(0)
  expect(ran.result.conflicts).toEqual([expect.objectContaining({ path: "race.txt" })])
  expect(text(disk, "race.txt")).toBe("edited elsewhere")
  expect(disk.trash.size).toBe(0)
})

it("keeps the local versions a sync replaced, and restores one for the next sync to send", async () => {
  const { cli, root, disk } = setup({ "plan.md": "v1" })
  const id = await added(cli, root)
  await synced(cli, id)
  disk.put("disk:/Notes/plan.md", "v2 from the disk")
  await synced(cli, id)
  expect(read(root, "plan.md")).toBe("v2 from the disk")
  const listed = await cli(["versions", "list", id, "plan.md"])
  const events = listed.json().items as { event: string; old?: string; available: boolean }[]
  const replaced = events.find((event) => event.event === "changed")
  expect(replaced).toMatchObject({ direction: "remote-to-local", available: true })
  const restored = await cli(["versions", "restore", id, join(root, "plan.md"), replaced?.old as string])
  expect(restored.json().item).toMatchObject({ path: "plan.md", restored: true })
  expect(read(root, "plan.md")).toBe("v1")
  const sent = await synced(cli, id)
  expect(sent.result.uploaded).toEqual(["plan.md"])
  expect(text(disk, "plan.md")).toBe("v1")
  const missing = await cli(["versions", "restore", id, "plan.md", "0".repeat(64)])
  expect(missing.json()).toMatchObject({ error: { code: "not_found" } })
})

it("a Disk folder replaced by another is refused until --repin, which then deletes nothing", async () => {
  const { cli, root, disk } = setup({ "a.txt": "a", "b.txt": "b" })
  const id = await added(cli, root)
  await synced(cli, id)
  disk.remove("disk:/Notes")
  disk.put("disk:/Notes")
  disk.put("disk:/Notes/a.txt", "a")
  const refused = await synced(cli, id)
  expect(refused.code).not.toBe(0)
  expect(refused.result.errors).toEqual([
    {
      path: ".",
      code: "confirmation_required",
      message: expect.stringContaining(`ydisk personal mirrors sync ${id} --repin`),
    },
  ])
  const repinned = await synced(cli, id, "--repin")
  expect(repinned.code, repinned.err).toBe(0)
  expect(repinned.result).toMatchObject({ adopted: ["a.txt"], uploaded: ["b.txt"], trashed: [] })
  expect(text(disk, "b.txt")).toBe("b")
})

it("preview lists the Disk and shows the plan; sync --dry-run shows the keys; neither writes", async () => {
  const { cli, root, disk } = setup({ "there.txt": "t" }, { "here.txt": "h" })
  const id = await added(cli, root)
  const before = disk.revision()
  const preview = await cli(["preview", id])
  expect(preview.code, preview.err).toBe(0)
  expect((preview.json().items as Synced[])[0]?.plan).toEqual([
    { kind: "upload", path: "here.txt" },
    { kind: "download", path: "there.txt" },
  ])
  const calls = disk.calls.length
  const dry = await cli(["sync", id, "--dry-run"])
  expect(dry.code, dry.err).toBe(0)
  expect(dry.json().item).toMatchObject({ permission: { key: "mirrors.sync" } })
  expect(JSON.stringify(dry.json())).toContain("files.delete")
  const resolve = await cli(["conflicts", "resolve", id, "here.txt", "--keep", "disk", "--dry-run"])
  expect(resolve.code, resolve.err).toBe(0)
  expect(resolve.json().item).toMatchObject({ permission: { key: "mirrors.conflicts.resolve" } })
  expect(JSON.stringify(resolve.json())).toContain("files.delete")
  expect(disk.calls.length).toBe(calls)
  expect(disk.revision()).toBe(before)
  expect(existsSync(join(root, "there.txt"))).toBe(false)
  expect(disk.calls.filter((call) => call.method !== "GET")).toEqual([])
})

it("preview marks each planned path in a scheduled agent's run", async () => {
  const { cli, root } = setup({ "there.txt": "t" })
  const id = await added(cli, root)
  const MARK = "0123456789abcdef"
  const preview = await cli(["preview", id], { env: { YDISK_READ_ONLY: "1", YDISK_UNTRUSTED_MARK: MARK } })
  expect(preview.code, preview.err).toBe(0)
  expect((preview.json().items as Synced[])[0]?.plan).toEqual([
    { kind: "download", path: expect.stringMatching(new RegExp(`^⟦untrusted:${MARK} source=path[^⟧]*⟧there.txt⟦/`)) },
  ])
})

it("files.delete at deny lets a sync add files and stops only what replaces or deletes", async () => {
  const { cli, root, disk, permit } = setup({ "a.txt": "a1", "gone.txt": "g" })
  const id = await added(cli, root)
  await synced(cli, id)
  permit({ "files.delete": "deny" })
  write(root, "new.txt", "new")
  write(root, "a.txt", "a2")
  rmSync(join(root, "gone.txt"))
  const ran = await synced(cli, id)
  expect(ran.code).not.toBe(0)
  expect(ran.result.uploaded).toEqual(["new.txt"])
  expect(ran.result.errors.map((error) => [error.path, error.code])).toEqual([
    ["a.txt", "permission_error"],
    ["gone.txt", "permission_error"],
  ])
  expect(text(disk, "a.txt")).toBe("a1")
  expect(text(disk, "gone.txt")).toBe("g")
})

it("a sync asks once for each key at ask, however many files it replaces or deletes", async () => {
  const { cli, root, disk, env } = setup({ "a.txt": "a1", "b.txt": "b1", "gone.txt": "g" })
  const id = await added(cli, root)
  await synced(cli, id)
  write(root, "a.txt", "a2")
  disk.put("disk:/Notes/b.txt", "b2")
  rmSync(join(root, "gone.txt"))
  const unasked = await cli(["sync", id])
  expect(unasked.json().items).toEqual([
    expect.objectContaining({
      errors: [
        expect.objectContaining({ path: "a.txt", code: "confirmation_required" }),
        expect.objectContaining({ path: "b.txt", code: "confirmation_required" }),
        expect.objectContaining({ path: "gone.txt", code: "confirmation_required" }),
      ],
    }),
  ])
  const asked: string[] = []
  // cli-core never asks under --json.
  const yes = await runCli(["personal", "mirrors", "sync", id], {
    service: disk,
    env,
    answer: (question) => {
      asked.push(question)
      return "y"
    },
  })
  expect(yes.code, yes.err).toBe(0)
  expect(asked).toHaveLength(1)
  expect(text(disk, "a.txt")).toBe("a2")
  expect(read(root, "b.txt")).toBe("b2")
  expect(disk.trash.has("disk:/Notes/gone.txt")).toBe(true)
})

it("the read-only switch refuses a sync before any write, and preview still runs", async () => {
  const { cli, root, disk } = setup({}, { "here.txt": "h" })
  const id = await added(cli, root)
  const locked = { env: { YDISK_READ_ONLY: "1" } }
  const refused = await cli(["sync", id, "--yes"], locked)
  expect(refused.code).not.toBe(0)
  expect(disk.calls.filter((call) => call.method !== "GET")).toEqual([])
  const preview = await cli(["preview", id], locked)
  expect(preview.code, preview.err).toBe(0)
})

it("a sync signed in to another account is refused", async () => {
  const { cli, root, env } = setup({ "a.txt": "a" })
  const id = await added(cli, root)
  const list = join(env.YDISK_STATE_DIR, "profiles", "personal", "mirrors.json")
  writeFileSync(list, readFileSync(list, "utf8").replace('"account": "1000"', '"account": "2000"'))
  const ran = await synced(cli, id)
  expect(ran.json()).toMatchObject({ error: { code: "authentication_error", reason: "profile.wrong-account" } })
})

it("status shows local changes without asking the Disk, and remove forgets the pair only", async () => {
  const { cli, root, disk } = setup({ "a.txt": "a" })
  const id = await added(cli, root)
  await synced(cli, id)
  write(root, "b.txt", "b")
  const calls = disk.calls.length
  const status = await cli(["status", id])
  expect(status.json().items).toEqual([
    expect.objectContaining({ id, upload: 1, delete: 0, unchanged: 1, remote_checked: false }),
  ])
  expect(disk.calls.length).toBe(calls)
  const removed = await cli(["remove", id])
  expect(removed.json().item).toEqual({ id, removed: true })
  expect((await cli(["list"])).json().items).toEqual([])
  expect(read(root, "a.txt")).toBe("a")
  expect(text(disk, "a.txt")).toBe("a")
  const gone = await cli(["sync", id])
  expect(gone.json()).toMatchObject({ error: { code: "not_found", reason: "mirror.not-found" } })
})

it("watch syncs at start and ends at --timeout with exit 0", async () => {
  const { root, disk, env } = setup({ "there.txt": "t" }, { "deep/here.txt": "h" })
  const cli = (args: string[]) => runCli(["personal", "mirrors", ...args], { service: disk, env })
  const add = await cli(["add", "/Notes", root, "--json"])
  const mirror = (add.json().item as { id: string }).id
  const ran = await cli(["watch", mirror, "--every", "10s", "--timeout", "1s", "--jsonl"])
  expect(ran.code, ran.err).toBe(0)
  const records = ran.out
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; data?: unknown })
  expect(records[0]).toMatchObject({
    type: "item",
    data: { triggers: ["start"], results: [{ uploaded: ["deep/here.txt"], downloaded: ["there.txt"] }] },
  })
  expect(text(disk, "deep/here.txt")).toBe("h")
  expect(records.at(-1)).toMatchObject({ type: "end" })
})

it("stops a run that would delete more than 10 files until --allow-deletions covers them", async () => {
  const files = Object.fromEntries(Array.from({ length: 40 }, (_, n) => [`f${n}.txt`, String(n)]))
  const { cli, root, disk } = setup(files, files)
  const id = await added(cli, root)
  await synced(cli, id)
  for (let n = 0; n < 11; n++) rmSync(join(root, `f${n}.txt`))
  const stopped = await synced(cli, id)
  expect(stopped.code).not.toBe(0)
  expect(stopped.result.too_many_deletions).toBe(11)
  expect(JSON.parse(stopped.err)).toMatchObject({
    error: {
      code: "confirmation_required",
      reason: "mirror.too-many-deletions",
      message:
        `this sync would delete 11 files (more than 10); check them with \`ydisk personal mirrors preview ${id}\`, ` +
        `then allow them with \`ydisk personal mirrors sync ${id} --allow-deletions 11\``,
    },
  })
  expect(disk.trash.size).toBe(0)
  const invalid = await synced(cli, id, "--allow-deletions", "some")
  expect(invalid.json()).toMatchObject({ error: { code: "validation_error" } })
  const allowed = await synced(cli, id, "--allow-deletions", "11")
  expect(allowed.code, allowed.err).toBe(0)
  expect(disk.trash.size).toBe(11)
})

it("stops a run that would replace more than 50 files until --allow-replacements covers them, or --replace", async () => {
  const files = Object.fromEntries(Array.from({ length: 51 }, (_, n) => [`f${n}.txt`, String(n)]))
  const { cli, root, disk, permit } = setup(files, files)
  const id = await added(cli, root)
  await synced(cli, id)
  for (let n = 0; n < 51; n++) disk.put(`disk:/Notes/f${n}.txt`, `${n}, encrypted`)
  const stopped = await synced(cli, id)
  expect(JSON.parse(stopped.err)).toMatchObject({
    error: {
      code: "confirmation_required",
      reason: "mirror.too-many-replacements",
      message: expect.stringContaining(`\`ydisk personal mirrors sync ${id} --allow-replacements 51\``),
    },
  })
  expect(read(root, "f0.txt")).toBe("0")
  const short = await synced(cli, id, "--allow-replacements", "50")
  expect(JSON.parse(short.err)).toMatchObject({ error: { reason: "mirror.too-many-replacements" } })
  expect(read(root, "f0.txt")).toBe("0")
  // Past the guard, each replacement still checks files.delete; denied here, so the test makes no 51 downloads.
  permit({ "files.delete": "deny" })
  for (const flag of [["--allow-replacements", "51"], ["--replace"]]) {
    const allowed = await synced(cli, id, ...flag)
    expect(allowed.result.errors).toHaveLength(51)
    expect(allowed.result.errors.every((error) => error.path !== ".")).toBe(true)
  }
  expect(read(root, "f0.txt")).toBe("0")
  for (const flag of [
    ["--allow-replacements", "0"],
    ["--allow-replacements", "5", "--replace"],
  ]) {
    const refused = await synced(cli, id, ...flag)
    expect(refused.json()).toMatchObject({ error: { code: "validation_error" } })
  }
})

it("an allow flag needs the mirror's id when the profile has more than one mirror", async () => {
  const { cli, root, dir } = setup()
  await added(cli, root)
  const other = join(dir, "other")
  mkdirSync(other)
  expect((await cli(["add", "/Notes", other])).code).toBe(0)
  for (const flag of [["--allow-deletions", "20"], ["--allow-replacements", "60"], ["--replace"]]) {
    const refused = await synced(cli, ...flag)
    expect(refused.json()).toMatchObject({ error: { code: "validation_error", param: flag[0] } })
  }
})

it("watch reports a guard stop at each cycle and still syncs the other mirrors", async () => {
  const files = Object.fromEntries(Array.from({ length: 12 }, (_, n) => [`f${n}.txt`, String(n)]))
  const { root, disk, env, dir } = setup(files, files)
  const cli = (args: string[]) => runCli(["personal", "mirrors", ...args], { service: disk, env })
  const id = (await cli(["add", "/Notes", root, "--json"])).json().item as { id: string }
  await cli(["sync", id.id, "--yes", "--json"])
  for (let n = 0; n < 11; n++) rmSync(join(root, `f${n}.txt`))
  disk.put("disk:/Other/new.txt", "new")
  const other = join(dir, "other")
  mkdirSync(other)
  await cli(["add", "/Other", other, "--json"])
  const ran = await cli(["watch", "--every", "10s", "--timeout", "1s", "--jsonl", "--yes"])
  expect(ran.code, ran.err).toBe(0)
  const first = JSON.parse(ran.out.split("\n")[0] as string) as {
    data: { results: { errors: { reason?: string }[]; downloaded: string[] }[] }
  }
  expect(first.data.results[0]?.errors).toEqual([
    expect.objectContaining({ path: ".", reason: "mirror.too-many-deletions" }),
  ])
  expect(first.data.results[1]?.downloaded).toEqual(["new.txt"])
  const pretty: string[] = []
  await run(["personal", "mirrors", "watch", id.id, "--every", "10s", "--timeout", "1s", "--yes"], {
    streams: { data: (line) => pretty.push(line), diagnostic: () => {} },
    tty: true,
    keyring: signedIn(),
    fetch: disk.fetch,
    env: { ...process.env, ...env },
  })
  expect(pretty.join("")).toContain("stopped: this sync would delete 11 files (more than 10)")
  expect(disk.trash.size).toBe(0)
})

it("mirrors the whole Disk into a folder of its own, leaving excluded paths alone on both sides", async () => {
  const { cli, dir, disk } = setup({ "plan.md": "p" })
  disk.put("disk:/Photos/1.jpg", "photo")
  disk.put("disk:/Docs/report.txt", "r")
  disk.put("disk:/Docs/big.iso", "iso")
  const root = join(dir, "YandexDisk")
  mkdirSync(root)
  write(root, "Photos/local.jpg", "mine")
  const add = await cli(["add", "/", root, "--ignore", "Photos", "--ignore", "*.iso"])
  expect(add.json().item).toMatchObject({ folder: "disk:/", ignore: ["Photos", "*.iso"], added: true })
  const id = (add.json().item as { id: string }).id
  const first = await synced(cli, id)
  expect(first.code, first.err).toBe(0)
  expect(first.result.downloaded.sort()).toEqual(["Docs/report.txt", "Notes/plan.md"])
  expect(first.result.uploaded).toEqual([])
  expect(disk.nodes.has("disk:/Photos/local.jpg")).toBe(false)
  expect(existsSync(join(root, "Docs/big.iso"))).toBe(false)
  expect(disk.calls.some((call) => call.url.pathname === "/v1/disk/resources/files")).toBe(true)

  const ignored = await cli(["update", id, "--ignore", "Notes", "--ignore", "*.iso"])
  expect(ignored.json().item).toEqual({ id, ignore: ["Photos", "*.iso", "Notes"] })
  rmSync(join(root, "Notes"), { recursive: true })
  disk.remove("disk:/Docs/report.txt")
  const after = await synced(cli, id)
  expect(after.result.trashed).toEqual([{ path: "Docs/report.txt", side: "local" }])
  expect(disk.trash.size).toBe(0)
  expect(text(disk, "plan.md")).toBe("p")

  const included = await cli(["update", id, "--clear", "--ignore", "Photos", "--ignore", "*.iso"])
  expect(included.json().item).toEqual({ id, ignore: ["Photos", "*.iso"] })
  const back = await synced(cli, id)
  expect(back.result).toMatchObject({ downloaded: ["Notes/plan.md"], trashed: [] })
  expect((await cli(["list"])).json().items).toEqual([
    { id, path: root, folder: "disk:/", ignore: ["Photos", "*.iso"] },
  ])
  expect((await cli(["update", id])).json()).toMatchObject({ error: { code: "validation_error", param: "--ignore" } })
  expect((await cli(["update", id, "--clear"])).json().item).toEqual({ id, ignore: [] })
})

it("add refuses the home folder, the file system's root and a pattern that leaves the mirror", async () => {
  const { cli, dir, disk } = setup()
  const home = join(dir, "home")
  mkdirSync(join(home, "Disk"), { recursive: true })
  for (const path of [home, dir, "/"]) {
    const refused = await cli(["add", "/", path], { env: { HOME: home } })
    expect(refused.json(), path).toMatchObject({ error: { code: "validation_error", reason: "mirror.not-folder" } })
  }
  const bad = await cli(["add", "/", join(home, "Disk"), "--ignore", "../x"], { env: { HOME: home } })
  expect(bad.json()).toMatchObject({ error: { code: "validation_error", reason: "mirror.bad-exclusion" } })
  expect(disk.calls).toEqual([])
})

it("add refuses a Disk path that is a file, and an unreadable mirror list is refused, not reset", async () => {
  const { cli, root, disk, env } = setup({ "a.txt": "a" })
  const file = await cli(["add", "/Notes/a.txt", root])
  expect(file.json()).toMatchObject({ error: { code: "validation_error", reason: "mirror.not-folder" } })
  await added(cli, root)
  const list = join(env.YDISK_STATE_DIR, "profiles", "personal", "mirrors.json")
  writeFileSync(list, "{ not json")
  expect((await cli(["list"])).json()).toMatchObject({ error: { code: "configuration_error" } })
  writeFileSync(list, JSON.stringify([{ id: "x" }]))
  expect((await cli(["list"])).json()).toMatchObject({ error: { code: "configuration_error" } })
  expect(disk.refusals).toEqual([])
})

it("watch refuses to ask the Disk more often than every 10 seconds", async () => {
  const { cli, root } = setup()
  const id = await added(cli, root)
  const fast = await cli(["watch", id, "--every", "1s"])
  expect(fast.json()).toMatchObject({ error: { code: "validation_error" } })
})

it("add refuses a credential folder, and a folder that is or holds the CLI's own folders", async () => {
  const { cli, dir, env, disk } = setup()
  const ssh = join(dir, "home", ".ssh")
  mkdirSync(ssh, { recursive: true })
  const keyrings = join(dir, "home", ".local", "share", "keyrings")
  mkdirSync(keyrings, { recursive: true })
  mkdirSync(env.YDISK_STATE_DIR, { recursive: true })
  for (const path of [ssh, keyrings, env.YDISK_STATE_DIR, dir]) {
    const refused = await cli(["add", "/Notes", path])
    expect(refused.json(), path).toMatchObject({ error: { code: "validation_error", reason: "mirror.not-folder" } })
  }
  expect(disk.calls).toEqual([])
})

it("--keep local keeps the Disk's old content as a version before it replaces the Disk file", async () => {
  const { cli, root, disk } = setup({ "c.txt": "c1" })
  const id = await added(cli, root)
  await synced(cli, id)
  write(root, "c.txt", "c2 here")
  disk.put("disk:/Notes/c.txt", "c2 on the disk")
  expect((await synced(cli, id)).result.conflicts).toEqual([expect.objectContaining({ path: "c.txt" })])
  const kept = await synced(cli, id, "--keep", "local")
  expect(kept.code, kept.err).toBe(0)
  expect(text(disk, "c.txt")).toBe("c2 here")
  const events = (await cli(["versions", "list", id, "c.txt"])).json().items as {
    event: string
    from?: string
    old?: string
    available: boolean
  }[]
  const replaced = events.find((event) => event.from === "remote")
  expect(replaced).toMatchObject({ available: true })
  const restored = await cli(["versions", "restore", id, "c.txt", replaced?.old as string])
  expect(restored.code, restored.err).toBe(0)
  expect(read(root, "c.txt")).toBe("c2 on the disk")
})

it("never lists or brings down a Disk .git or node_modules folder", async () => {
  const { cli, root, disk } = setup({ "a.txt": "a", ".git/HEAD": "ref", "node_modules/x/index.js": "x" })
  const id = await added(cli, root)
  const first = await synced(cli, id)
  expect(first.result.downloaded).toEqual(["a.txt"])
  expect(existsSync(join(root, ".git"))).toBe(false)
  expect(disk.calls.some((call) => call.url.searchParams.get("path")?.includes("node_modules"))).toBe(false)
})

it("a file deleted here is trashed on the Disk by its md5, with no download, and its version is in the Disk trash", async () => {
  // Not a text file: the store keeps a text file's last synced content as its next merge's base.
  const { cli, root, disk } = setup({ "gone.bin": "g1", "keep.txt": "k" })
  const id = await added(cli, root)
  await synced(cli, id)
  rmSync(join(root, "gone.bin"))
  disk.calls.length = 0
  const ran = await synced(cli, id)
  expect(ran.code, ran.err).toBe(0)
  expect(ran.result.trashed).toEqual([{ path: "gone.bin", side: "remote" }])
  expect(disk.trash.get("disk:/Notes/gone.bin")?.text).toBe("g1")
  const asked = (pathname: string) =>
    disk.calls.filter(
      (call) => call.url.pathname === pathname && call.url.searchParams.get("path")?.endsWith("gone.bin"),
    )
  expect(asked("/v1/disk/resources/download")).toEqual([])
  expect(
    asked("/v1/disk/resources")
      .find((call) => call.method === "DELETE")
      ?.url.searchParams.get("md5"),
  ).toBe(createHash("md5").update("g1").digest("hex"))
  const events = (await cli(["versions", "list", id, "gone.bin"])).json().items as { event: string }[]
  expect(events.at(-1)).toMatchObject({ event: "deleted", from: "remote", old_in: "remote-trash", available: false })
})

/** The Disk with its flat listing stuck from `offset` on until the request is stopped, slower than any deadline. */
const stuckFrom = (disk: FakeDisk, offset: number) => ({
  fetch: (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname !== "/v1/disk/resources/files" || Number(url.searchParams.get("offset")) < offset)
      return disk.fetch(input, init)
    return new Promise<Response>((_, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }),
    )
  },
})

it("a sync stops before its deadline when the Disk listing is slow, says how far it got and deletes nothing", async () => {
  const { cli, dir, disk, env, root: notes } = setup({ "plan.md": "p" })
  disk.put("disk:/Docs/a.txt", "a")
  disk.put("disk:/Docs/gone.txt", "g")
  const root = join(dir, "YandexDisk")
  mkdirSync(root)
  const whole = ((await cli(["add", "/", root])).json().item as { id: string }).id
  const folder = await added(cli, notes)
  expect((await synced(cli)).code).toBe(0)
  disk.remove("disk:/Docs/gone.txt")
  disk.filesPageCap = 1
  const ran = await runCli(["personal", "mirrors", "sync", "--yes", "--json", "--timeout", "10s"], {
    service: stuckFrom(disk, 1),
    env,
  })
  expect(ran.code, ran.err).toBe(0)
  const body = ran.json()
  expect(body).toMatchObject({ meta: { complete: false } })
  expect(body.next).toEqual([
    expect.objectContaining({
      step: "mirrors.sync",
      command: "mirrors sync",
      args: { timeout: "10s" },
      why: expect.stringContaining("run it again"),
      safe_to_auto_execute: false,
    }),
  ])
  expect(body.items).toEqual([
    expect.objectContaining({
      id: whole,
      stopped: true,
      listed: { files: 1, complete: false, so_far: 1 },
      unlisted: 2,
    }),
    { id: folder, path: notes, stopped: true },
  ])
  expect((body.items as Synced[])[0]).toMatchObject({ trashed: [], unknown: [], downloaded: [] })
  expect(read(root, "Docs/gone.txt")).toBe("g")
  expect(localTrash(root)).toEqual([])

  // The second run goes on from the first one's place, lists one more page and stops again.
  const pages = () =>
    disk.calls
      .filter((call) => call.url.pathname === "/v1/disk/resources/files")
      .map((call) => call.url.searchParams.get("offset"))
  disk.calls.length = 0
  const second = await runCli(["personal", "mirrors", "sync", whole, "--yes", "--json", "--timeout", "10s"], {
    service: stuckFrom(disk, 2),
    env,
  })
  expect(second.code, second.err).toBe(0)
  expect(pages()[0]).toBe("1")
  expect(second.json().items).toEqual([
    expect.objectContaining({
      id: whole,
      stopped: true,
      listed: { files: 1, complete: false, resumed: true, so_far: 2 },
    }),
  ])
  expect(read(root, "Docs/gone.txt")).toBe("g")

  disk.calls.length = 0
  const after = await synced(cli)
  expect(pages()[0]).toBe("2")
  expect(after.result).toMatchObject({ id: whole, trashed: [{ path: "Docs/gone.txt", side: "local" }] })
  expect(after.json().next).toBeUndefined()
})

it("a sync of a Disk folder keeps no place in its listing, so a stopped one asks for more time", async () => {
  const { cli, disk, env, root } = setup({ "a.txt": "a", "b.txt": "b" })
  const id = await added(cli, root)
  const stuck = {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.pathname !== "/v1/disk/resources" || url.searchParams.get("limit") === "0") return disk.fetch(input, init)
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true }),
      )
    },
  }
  const ran = await runCli(["personal", "mirrors", "sync", id, "--yes", "--json", "--timeout", "10s"], {
    service: stuck,
    env,
  })
  expect(ran.code, ran.err).toBe(0)
  expect(ran.json().items).toEqual([
    expect.objectContaining({ id, stopped: true, listed: { files: 0, complete: false } }),
  ])
  expect(ran.json().next).toEqual([
    expect.objectContaining({ step: "mirrors.sync.longer", args: { id, timeout: "15m" } }),
  ])
})

it("sync gets a sync's deadline and preview a cooperative one, not a one-shot's 30 s", () => {
  const mirrors = definition()
    .commands()
    .find((one) => one.name() === "mirrors") as Command
  const meta = (name: string) => metaOf(mirrors.commands.find((one) => one.name() === name) as Command)
  expect(meta("sync")).toMatchObject({ cooperative: true, partial: true })
  expect(meta("preview")).toMatchObject({ cooperative: true })
  expect(meta("preview").partial).toBeUndefined()
})

/** The Disk with one file's download taking `ms`, as a big file's would. */
const slowDownload = (disk: FakeDisk, path: string, ms: number) => ({
  fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.pathname === "/disk/fake" && url.searchParams.get("path") === path) await sleep(ms)
    return disk.fetch(input, init)
  },
})

it("a sync stopped between files keeps what it did, and the next sync goes on from there", async () => {
  const { cli, disk, env, root } = setup({ "a.txt": "a", "b.txt": "b", "c.txt": "c" })
  const id = await added(cli, root)
  const ran = await runCli(["personal", "mirrors", "sync", id, "--yes", "--json", "--timeout", "10s"], {
    service: slowDownload(disk, "disk:/Notes/b.txt", 6_000),
    env,
  })
  expect(ran.code, ran.err).toBe(0)
  const body = ran.json()
  expect(body.items).toEqual([
    expect.objectContaining({
      id,
      stopped: true,
      downloaded: ["a.txt", "b.txt"],
      listed: { files: 3, complete: true },
    }),
  ])
  expect(body.next).toEqual([
    expect.objectContaining({ step: "mirrors.sync", args: { id, timeout: "10s" }, safe_to_auto_execute: false }),
  ])
  const rest = await synced(cli, id)
  expect(rest.code, rest.err).toBe(0)
  expect(rest.result).toMatchObject({ downloaded: ["c.txt"], unchanged: 2 })
  expect(rest.json().next).toBeUndefined()
})

it("a preview stops before its deadline when the Disk listing is slow, and fails as a cut plan", async () => {
  const { cli, dir, disk, env } = setup({ "plan.md": "p" })
  const root = join(dir, "YandexDisk")
  mkdirSync(root)
  const whole = ((await cli(["add", "/", root])).json().item as { id: string }).id
  const ran = await runCli(["personal", "mirrors", "preview", whole, "--json", "--timeout", "10s"], {
    service: stuckFrom(disk, 0),
    env,
  })
  expect(ran.code).not.toBe(0)
  const body = ran.json()
  expect(body).toMatchObject({
    meta: { complete: false, issues: [{ code: "timeout", reason: "mirror.stopped", source: `mirror ${whole}` }] },
  })
  expect(body.items).toEqual([
    expect.objectContaining({ id: whole, stopped: true, listed: { files: 0, complete: false }, plan: [] }),
  ])
  expect(body.next).toEqual([
    expect.objectContaining({ step: "mirrors.preview.longer", args: { id: whole, timeout: "15m" } }),
  ])
})

const PLAN = "# Plan\n\n## Monday\n\nwrite the brief\n\n## Friday\n\nsend the report\n"

it("merges a text file both sides changed in different sections, and keeps the three versions", async () => {
  const { cli, root, disk } = setup({ "plan.md": PLAN }, { "plan.md": PLAN })
  const id = await added(cli, root)
  expect((await synced(cli, id)).code).toBe(0)
  write(root, "plan.md", PLAN.replace("write the brief", "write the brief and the budget"))
  disk.put("disk:/Notes/plan.md", PLAN.replace("send the report", "send the report to Anna"))
  const preview = await cli(["preview", id])
  expect((preview.json().items as Synced[])[0]?.plan).toEqual([
    expect.objectContaining({ kind: "merge", path: "plan.md" }),
  ])
  const merged = await synced(cli, id)
  expect(merged.code, merged.err).toBe(0)
  expect(merged.result).toMatchObject({ merged: ["plan.md"], conflicts: [] })
  const both = PLAN.replace("write the brief", "write the brief and the budget").replace(
    "send the report",
    "send the report to Anna",
  )
  expect(read(root, "plan.md")).toBe(both)
  expect(text(disk, "plan.md")).toBe(both)
  const events = (await cli(["versions", "list", id, "plan.md"])).json().items as {
    event: string
    versions?: { role: string }[]
  }[]
  const event = events.find((one) => one.event === "merged")
  expect(event?.versions?.map((one) => one.role).sort()).toEqual(["base", "local", "remote", "result"])
})

it("a line both sides changed is a conflict that conflicts list, show and resolve settle on both sides", async () => {
  const { cli, root, disk, dir } = setup({ "plan.md": PLAN }, { "plan.md": PLAN })
  const id = await added(cli, root)
  expect((await synced(cli, id)).code).toBe(0)
  const local = PLAN.replace("send the report", "send the report on Thursday")
  const remote = PLAN.replace("send the report", "send the report on Saturday")
  write(root, "plan.md", local)
  disk.put("disk:/Notes/plan.md", remote)
  const partial = await synced(cli, id)
  expect(partial.code).not.toBe(0)
  expect(partial.result.conflicts).toEqual([expect.objectContaining({ path: "plan.md" })])
  expect(read(root, "plan.md")).toBe(local)
  expect(text(disk, "plan.md")).toBe(remote)

  const listed = await cli(["conflicts", "list", id])
  expect(listed.code, listed.err).toBe(0)
  expect(listed.json().items).toEqual([expect.objectContaining({ id, path: "plan.md" })])
  const shown = await cli(["conflicts", "show", id, "plan.md"])
  expect(shown.code, shown.err).toBe(0)
  const view = shown.json().item as { merged: string }
  expect(view.merged).toContain("<<<<<<<")
  expect(view.merged).toContain("on Thursday")
  expect(view.merged).toContain("on Saturday")

  const final = join(dir, "final.md")
  writeFileSync(final, PLAN.replace("send the report", "send the report on Friday"))
  const resolved = await cli(["conflicts", "resolve", id, "plan.md", "--file", final, "--yes"])
  expect(resolved.code, resolved.err).toBe(0)
  expect(resolved.json().item).toMatchObject({ id, path: "plan.md", resolution: "file" })
  expect(read(root, "plan.md")).toContain("on Friday")
  expect(text(disk, "plan.md")).toContain("on Friday")
  expect((await cli(["conflicts", "list", id])).json().items).toEqual([])
  expect((await synced(cli, id)).result).toMatchObject({ conflicts: [], uploaded: [], downloaded: [] })
})

it("conflicts resolve --keep disk takes the Disk's version, and refuses when a side changed since", async () => {
  const { cli, root, disk } = setup({ "plan.md": PLAN }, { "plan.md": PLAN })
  const id = await added(cli, root)
  await synced(cli, id)
  write(root, "plan.md", PLAN.replace("brief", "local brief"))
  disk.put("disk:/Notes/plan.md", PLAN.replace("brief", "disk brief"))
  await synced(cli, id)
  write(root, "plan.md", PLAN.replace("brief", "newer local brief"))
  const refused = await cli(["conflicts", "resolve", id, "plan.md", "--keep", "disk", "--yes"])
  expect(refused.code).not.toBe(0)
  expect(text(disk, "plan.md")).toContain("disk brief")
  expect(read(root, "plan.md")).toContain("newer local brief")
  await synced(cli, id)
  const kept = await cli(["conflicts", "resolve", id, "plan.md", "--keep", "disk", "--yes"])
  expect(kept.code, kept.err).toBe(0)
  expect(read(root, "plan.md")).toContain("disk brief")
  expect((await cli(["conflicts", "resolve", id, "plan.md"])).json()).toMatchObject({
    error: { code: "validation_error" },
  })
})
