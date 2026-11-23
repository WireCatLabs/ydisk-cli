import { createHash } from "node:crypto"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { neverAnswers, runScopeCases } from "@wirecat/cli-core/testing"
import { describe, it } from "vitest"
import { API } from "./config.js"
import { definition } from "./program.js"
import { diskApi } from "./testing/disk-api.js"
import { FAKE_TOKEN } from "./testing/fake-disk.js"
import { signedIn } from "./testing/harness.js"

const scratch = mkdtempSync(join(tmpdir(), "ydisk-run-scope-"))
const upload = join(scratch, "upload.txt")
writeFileSync(upload, "notes")

// The spec's fake answers every path as the file "hello".
const HELLO = createHash("sha256").update("hello").digest("hex")

const stdin = () => Object.assign(Readable.from([FAKE_TOKEN]), { isTTY: false })

describe("each remote command runs inside cli-core's run", () => {
  const cases = runScopeCases({
    definition: definition(),
    commands: {
      "session start": ["personal", "session", "start"],
      "session status": ["personal", "session", "status", "--check"],
      "folders add": ["personal", "folders", "add", "/Work"],
      "folders browse": ["personal", "folders", "browse"],
      sync: ["personal", "sync"],
      "files list": ["personal", "files", "list"],
      "files show": ["personal", "files", "show", "/plan.txt"],
      "files download": ["personal", "files", "download", "/plan.txt"],
      "files upload": ["personal", "files", "upload", upload, "--folder", "/Work"],
      "files update": [
        "personal",
        "files",
        "update",
        "/plan.txt",
        "--text",
        "notes",
        "--expected-fingerprint",
        HELLO,
        "--yes",
      ],
      "files copy": ["personal", "files", "copy", "/plan.txt", "--folder", "/Archive"],
      "files move": ["personal", "files", "move", "/plan.txt", "--folder", "/Archive"],
      "files create": ["personal", "files", "create", "/Archive"],
      "files delete": ["personal", "files", "delete", "/plan.txt", "--yes"],
      "files restore": ["personal", "files", "restore", "trash:/plan.txt"],
      "files publish": ["personal", "files", "publish", "/plan.txt", "--yes"],
      "files unpublish": ["personal", "files", "unpublish", "/plan.txt", "--yes"],
      "mirrors add": ["personal", "mirrors", "add", "/Work", scratch],
    },
    skip: {
      ...Object.fromEntries(
        API.manifest.operations.map((operation) => [
          `api ${operation.command}`,
          "cli-core's serviceApiCommand runs it in its run; src/api.test.ts sends each one",
        ]),
      ),
      "mcp serve": "listens until stopped",
      "mirrors sync":
        "needs a saved mirror and a Disk that lists sha256, which the spec's fake lacks; it runs in contextOf().run, and src/mirrors.test.ts runs it against fake-disk",
      "mirrors preview":
        "the same listing as mirrors sync, writing nothing; src/mirrors.test.ts runs it against fake-disk",
      "mirrors watch": "keeps running until stopped; src/mirrors.test.ts runs one cycle and its --timeout",
      "files sheets show":
        "reads a workbook, which the spec's fake has none of; src/edit.test.ts runs it against fake-disk",
      "files sheets update": "edits a workbook; src/edit.test.ts runs it against fake-disk",
      "files documents show":
        "reads a .docx, which the spec's fake has none of; src/edit.test.ts runs it against fake-disk",
      "files documents update": "edits a .docx; src/edit.test.ts runs it against fake-disk",
      "files history":
        "reads only the versions kept on this computer, so a silent service cannot stop it; src/edit.test.ts runs it",
      "mirrors conflicts resolve":
        "needs a conflict a sync recorded; src/mirrors.test.ts resolves one against fake-disk. cli-core connects it outside the command's run (WireCatLabs/cli-core#3230)",
      "files serve": "serves until stopped; src/mount.test.ts reads through it against fake-disk and stops it",
      "memories extract": "asks the configured model, not Yandex Disk; cli-core's shared command",
      doctor:
        "cli-core's appDoctorCommand answers --online outside a run of its own; drop this once core runs it inside",
    },
    answering: () => ({ keyring: signedIn(), fetch: diskApi().fetch, stdin: stdin() }),
    silent: () => ({ keyring: signedIn(), fetch: neverAnswers, stdin: stdin() }),
  })
  for (const one of cases) it(one.name, () => one.run())
})
