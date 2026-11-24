import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { linkFetch } from "@wirecat/cli-core/cli"
import { expect, it } from "vitest"
import { LINK_HOSTS } from "../context.js"
import { FAKE_TOKEN, fakeDisk } from "../testing/fake-disk.js"
import { diskTarget } from "./mirror-target.js"
import { transport } from "./transport.js"

const over = () => {
  const disk = fakeDisk()
  const target = diskTarget(
    transport({ token: FAKE_TOKEN, fetch: disk.fetch }),
    linkFetch({ hosts: LINK_HOSTS, fetch: disk.fetch }),
  )
  const local = (text: string) => {
    const path = join(mkdtempSync(join(tmpdir(), "ydisk-target-")), "file.txt")
    writeFileSync(path, text)
    return path
  }
  return { disk, target, local }
}

it("lists a folder tree with paths relative to its root, hashes and the root's id", async () => {
  const { disk, target } = over()
  const rootId = disk.put("disk:/Notes")
  disk.put("disk:/Notes/a.txt", "a")
  disk.put("disk:/Notes/Sub/b.txt", "b")
  const listed = await target.list("disk:/Notes")
  expect(listed).toMatchObject({ rootId, complete: true })
  expect(listed?.files.map((file) => file.path).sort()).toEqual(["Sub/b.txt", "a.txt"])
  expect(listed?.files.find((file) => file.path === "a.txt")).toMatchObject({
    size: 1,
    sha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    md5: "0cc175b9c0f1b6a831c399e269772661",
  })
  expect(await target.list("disk:/Missing")).toBeUndefined()
  const top = await target.list("disk:/")
  expect(top?.files.map((file) => file.path).sort()).toEqual(["Notes/Sub/b.txt", "Notes/a.txt"])
})

it("pages a large folder, and a folder it cannot read leaves the listing incomplete", async () => {
  const { disk, target } = over()
  for (let n = 0; n < 205; n++) disk.put(`disk:/Big/f${String(n).padStart(3, "0")}.txt`, String(n))
  disk.put("disk:/Big/Locked/x.txt", "x")
  expect((await target.list("disk:/Big"))?.files).toHaveLength(206)
  disk.deny("disk:/Big/Locked", 403)
  expect(await target.list("disk:/Big")).toMatchObject({ complete: false })
})

it("refuses to list a file as a mirror's root", async () => {
  const { disk, target } = over()
  disk.put("disk:/a.txt", "a")
  await expect(target.list("disk:/a.txt")).rejects.toMatchObject({ code: "validation_error" })
})

it("uploads a new file only where none is, and replaces one only while it has the listed hash", async () => {
  const { disk, target, local } = over()
  disk.put("disk:/Notes")
  const sent = await target.upload("disk:/Notes/a.txt", local("one"), { absent: true })
  expect(disk.nodes.get("disk:/Notes/a.txt")?.text).toBe("one")
  expect(sent).toMatchObject({ path: "a.txt", size: 3, sha256: disk.nodes.get("disk:/Notes/a.txt")?.sha256 })
  await expect(target.upload("disk:/Notes/a.txt", local("two"), { absent: true })).rejects.toMatchObject({
    code: "conflict",
  })
  const listed = { sha256: sent.sha256 as string }
  disk.put("disk:/Notes/a.txt", "changed elsewhere")
  await expect(target.upload("disk:/Notes/a.txt", local("two"), listed)).rejects.toMatchObject({ code: "conflict" })
  disk.put("disk:/Notes/a.txt", "one")
  const replaced = await target.upload("disk:/Notes/a.txt", local("two"), listed)
  expect(disk.nodes.get("disk:/Notes/a.txt")?.text).toBe("two")
  expect(replaced).toMatchObject({ path: "a.txt", id: disk.nodes.get("disk:/Notes/a.txt")?.resource_id })
  await expect(target.upload("disk:/Notes/gone.txt", local("x"), listed)).rejects.toMatchObject({ code: "conflict" })
})

it("trashes a file with the expected md5, and finds the md5 itself when only the sha256 is known", async () => {
  const { disk, target } = over()
  disk.put("disk:/a.txt", "a")
  disk.put("disk:/b.txt", "b")
  const a = disk.nodes.get("disk:/a.txt")
  await expect(target.trash("disk:/a.txt", { sha256: "x", md5: "wrong" })).rejects.toMatchObject({ code: "conflict" })
  await target.trash("disk:/a.txt", { sha256: a?.sha256 as string, md5: a?.md5 as string })
  expect(disk.trash.has("disk:/a.txt")).toBe(true)
  await expect(target.trash("disk:/b.txt", { sha256: "other" })).rejects.toMatchObject({ code: "conflict" })
  await target.trash("disk:/b.txt", { sha256: disk.nodes.get("disk:/b.txt")?.sha256 as string })
  expect(disk.trash.has("disk:/b.txt")).toBe(true)
})

it("creates a folder with its missing parents, and accepts one that exists", async () => {
  const { disk, target } = over()
  await target.ensureFolder("disk:/One/Two/Three")
  expect(disk.nodes.get("disk:/One/Two/Three")?.type).toBe("dir")
  await target.ensureFolder("disk:/One/Two")
  disk.put("disk:/file.txt", "f")
  await expect(target.ensureFolder("disk:/file.txt")).rejects.toMatchObject({ code: "conflict" })
})

it("downloads a file into a new local file, and reads the account and the Disk's revision", async () => {
  const { disk, target } = over()
  disk.put("disk:/a.txt", "content")
  const into = join(mkdtempSync(join(tmpdir(), "ydisk-target-")), "a.txt")
  await target.download("disk:/a.txt", into)
  expect(readFileSync(into, "utf8")).toBe("content")
  await expect(target.download("disk:/a.txt", into)).rejects.toMatchObject({ code: "EEXIST" })
  expect(await target.identity()).toBe("1000")
  const before = await target.revision?.()
  disk.put("disk:/b.txt", "b")
  expect(await target.revision?.()).not.toBe(before)
})

it("a walk the Disk changed under is still complete, and a file it missed is found by a direct read", async () => {
  const { disk, target } = over()
  for (let n = 0; n < 205; n++) disk.put(`disk:/Big/f${String(n).padStart(3, "0")}.txt`, String(n))
  disk.beforePage = (path, offset) => {
    // Page two shifts by one, so f200 is never listed although it is still there.
    if (path === "disk:/Big" && offset === 200) disk.remove("disk:/Big/f000.txt")
  }
  const listed = await target.list("disk:/Big")
  expect(listed?.complete).toBe(true)
  expect(listed?.files.map((file) => file.path)).not.toContain("f200.txt")
  expect(await target.exists("disk:/Big/f200.txt")).toBe(true)
  expect(await target.exists("disk:/Big/f000.txt")).toBe(false)
  expect(disk.calls.filter((call) => call.url.searchParams.get("fields") === "revision")).toEqual([])
})

it("lists the whole Disk from its flat listing, whatever page size it really serves", async () => {
  const { disk, target } = over()
  for (let n = 0; n < 25; n++) disk.put(`disk:/Photos/${String(n).padStart(2, "0")}.jpg`, String(n))
  disk.put("disk:/Docs/a.md", "a")
  disk.put("disk:/.hidden/x.md", "x")
  disk.put("disk:/Docs/node_modules/y.js", "y")
  disk.filesPageCap = 7
  const listed = await target.list("disk:/")
  expect(listed).toMatchObject({ rootId: disk.nodes.get("disk:/")?.resource_id, complete: true })
  expect(listed?.files).toHaveLength(26)
  expect(listed?.files.find((file) => file.path === "Docs/a.md")).toMatchObject({
    id: disk.nodes.get("disk:/Docs/a.md")?.resource_id,
    sha256: disk.nodes.get("disk:/Docs/a.md")?.sha256,
  })
  const pages = disk.calls.filter((call) => call.url.pathname === "/v1/disk/resources/files")
  expect(pages.map((call) => call.url.searchParams.get("offset"))).toEqual(["0", "7", "14", "21", "28"])
  expect(disk.calls.filter((call) => call.url.pathname === "/v1/disk/resources")).toHaveLength(1)
})

it("keeps a file the flat listing returns twice once, and a failed page leaves it incomplete", async () => {
  const { disk, target } = over()
  for (let n = 0; n < 10; n++) disk.put(`disk:/b${n}.txt`, String(n))
  disk.filesPageCap = 5
  disk.beforeFilesPage = (offset) => {
    if (offset === 5) disk.put("disk:/a-new.txt", "new")
  }
  const listed = await target.list("disk:/")
  expect(listed?.files.map((file) => file.path)).toEqual(Array.from({ length: 10 }, (_, n) => `b${n}.txt`))
  expect(listed?.complete).toBe(true)
  let failing = false
  const failingTarget = diskTarget(
    transport({
      token: FAKE_TOKEN,
      fetch: async (input, init) => {
        const url = new URL(String(input))
        if (failing && url.pathname === "/v1/disk/resources/files" && url.searchParams.get("offset") === "5")
          return new Response(JSON.stringify({ error: "DiskForbiddenError" }), { status: 403 })
        return disk.fetch(input, init)
      },
    }),
    linkFetch({ hosts: LINK_HOSTS, fetch: disk.fetch }),
  )
  failing = true
  expect(await failingTarget.list("disk:/")).toMatchObject({ complete: false })
})

it("refuses to replace or trash a file when no hash can show it is the one listed", async () => {
  const { disk, target, local } = over()
  disk.put("disk:/a.txt", "a")
  const listed = { sha256: disk.nodes.get("disk:/a.txt")?.sha256 as string }
  const node = disk.nodes.get("disk:/a.txt")
  disk.nodes.set("disk:/a.txt", { ...node, sha256: undefined, md5: undefined } as NonNullable<typeof node>)
  const refused = { code: "conflict", details: { reason: "mirror.remote-changed" } }
  await expect(target.upload("disk:/a.txt", local("b"), listed)).rejects.toMatchObject(refused)
  await expect(target.trash("disk:/a.txt", listed)).rejects.toMatchObject(refused)
  expect(disk.nodes.get("disk:/a.txt")?.text).toBe("a")
  expect(disk.trash.size).toBe(0)
  expect(disk.calls.filter((call) => call.method === "DELETE")).toEqual([])
})

it("waits for an upload the Disk answered 202 to land before it reads the file back", async () => {
  const { disk, target, local } = over()
  disk.put("disk:/Notes")
  disk.acceptUploads = 2
  const sent = await target.upload("disk:/Notes/a.txt", local("late"), { absent: true })
  expect(sent).toMatchObject({ path: "a.txt", sha256: disk.nodes.get("disk:/Notes/a.txt")?.sha256 })
  expect(disk.calls.filter((call) => call.url.pathname.startsWith("/v1/disk/operations/"))).toHaveLength(3)
})

const hidden = (disk: ReturnType<typeof fakeDisk>) => [...disk.nodes.keys()].filter((path) => path.includes("/."))

it("replaces an unshared file through a hidden temporary file, the old one to the trash at its md5", async () => {
  const { disk, target, local } = over()
  const id = disk.put("disk:/Notes/a.txt", "one")
  const old = disk.nodes.get("disk:/Notes/a.txt")
  const replaced = await target.upload("disk:/Notes/a.txt", local("two"), { sha256: old?.sha256 as string })
  expect(disk.nodes.get("disk:/Notes/a.txt")?.text).toBe("two")
  expect(replaced.id).not.toBe(id)
  expect(disk.trash.get("disk:/Notes/a.txt")?.text).toBe("one")
  expect(hidden(disk)).toEqual([])
  const deleted = disk.calls.find((call) => call.method === "DELETE")
  expect(deleted?.url.searchParams.get("md5")).toBe(old?.md5)
  const moved = disk.calls.find((call) => call.url.pathname === "/v1/disk/resources/move")
  expect(moved?.url.searchParams.get("from")).toMatch(/^disk:\/Notes\/\.a\.txt\.ydisk-[0-9a-f]{8}$/u)
  expect(moved?.url.searchParams.get("overwrite")).toBe("false")
})

it("a file changed between the read and the delete is refused by the Disk, and the temporary file goes", async () => {
  const { disk, target, local } = over()
  disk.put("disk:/a.txt", "one")
  const listed = { sha256: disk.nodes.get("disk:/a.txt")?.sha256 as string }
  disk.beforeWrite = (method, path) => {
    if (method === "DELETE" && path === "disk:/a.txt") disk.put("disk:/a.txt", "changed elsewhere")
  }
  await expect(target.upload("disk:/a.txt", local("two"), listed)).rejects.toMatchObject({
    code: "conflict",
    details: { reason: "mirror.remote-changed" },
  })
  expect(disk.nodes.get("disk:/a.txt")?.text).toBe("changed elsewhere")
  expect(hidden(disk)).toEqual([])
})

it("a file created at the path between the delete and the move keeps the new content in the temporary file", async () => {
  const { disk, target, local } = over()
  disk.put("disk:/a.txt", "one")
  const listed = { sha256: disk.nodes.get("disk:/a.txt")?.sha256 as string }
  disk.beforeWrite = (method, path) => {
    if (method === "POST" && path === "disk:/a.txt") disk.put("disk:/a.txt", "someone else's")
  }
  const refused = target.upload("disk:/a.txt", local("two"), listed)
  await expect(refused).rejects.toMatchObject({ code: "conflict", details: { reason: "upload.replace-interrupted" } })
  const [temporary] = hidden(disk)
  await expect(refused).rejects.toThrow(`kept at ${temporary}`)
  expect(disk.nodes.get(temporary as string)?.text).toBe("two")
  expect(disk.nodes.get("disk:/a.txt")?.text).toBe("someone else's")
  expect(disk.trash.get("disk:/a.txt")?.text).toBe("one")
})

it("a file with a public link is overwritten in place, so it keeps its resource_id and its link", async () => {
  const { disk, target, local } = over()
  const id = disk.put("disk:/shared.txt", "one")
  disk.publish("disk:/shared.txt")
  const listed = { sha256: disk.nodes.get("disk:/shared.txt")?.sha256 as string }
  const replaced = await target.upload("disk:/shared.txt", local("two"), listed)
  expect(replaced.id).toBe(id)
  expect(disk.nodes.get("disk:/shared.txt")).toMatchObject({ text: "two", public_key: `fakepublic${id}` })
  expect(disk.calls.filter((call) => call.method === "DELETE" || call.method === "POST")).toEqual([])
})
