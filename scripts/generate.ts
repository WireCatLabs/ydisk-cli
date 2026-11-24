import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import {
  coverageGenerator,
  definitionsGenerator,
  generate,
  manifestGenerator,
  typesGenerator,
  valibotGenerator,
  writeArtifacts,
} from "@wirecat/cli-base/codegen"
import { specModel } from "./spec-model.ts"

// The service's API description → src/generated/ and docs/dev/API_COVERAGE.md. Each correction below is read from
// the service's documentation, never guessed; cli-base docs/standards/kit-surface.md says what each one does.
const root = resolve(import.meta.dirname, "..")
const { model, notes } = await specModel(root)
const artifacts = generate(
  model,
  [
    typesGenerator({ path: "src/generated/types.ts" }),
    valibotGenerator({ path: "src/generated/schemas.ts", typesImport: "./types.js" }),
    manifestGenerator({ path: "src/generated/manifest.ts", coreImport: "@wirecat/cli-base/codegen/runtime" }),
    definitionsGenerator({ path: "src/generated/definitions.ts", coreImport: "@wirecat/cli-base/codegen/runtime" }),
    coverageGenerator({
      path: "docs/dev/API_COVERAGE.md",
      title: "API coverage",
      command: (operation) => `ydisk <profile> api ${operation.command}`,
    }),
  ],
  {
    banner: ["Source: spec/ydisk/, checked against provenance.json", "Run: pnpm generate"],
    overrides: {},
    readingPosts: false,
    // drive-cli's words: the path's segments, then what the method does; /v1/disk/ is in every path, so it is left out.
    // `commands` names those the method misreads: GET /v1/disk would be `list`, the group's own command; a GET that
    // answers a link is not a list; PUT /v1/disk/resources makes a folder; POST …/upload has Disk fetch a URL.
    names: {
      fromPath: true,
      segments: { disk: "" },
      commands: {
        GetDisk: "disk-get",
        CreateResource: "resources-create",
        GetResourceDownloadLink: "resources-download-link",
        GetResourceUploadLink: "resources-upload-link",
        UploadExternalResource: "resources-upload-url",
        GetPublicResource: "public-resources-get",
        GetPublicResourceDownloadLink: "public-resources-download-link",
        UpdatePublicSettings: "public-settings-update",
      },
    },
    // https://yandex.ru/dev/disk-api/doc/en/reference/delete: `permanently=true` skips the trash. `overwrite=true`
    // replaces the file at the target on copy, move, restore and the upload link
    // (https://yandex.ru/dev/disk-api/doc/en/reference/copy, …/move, …/trash-restore, …/upload).
    // https://yandex.ru/dev/disk-api/doc/en/reference/publish: a public link opens a file to anyone who has it.
    permissions: {
      group: "files",
      deletingFlags: ["permanently", "overwrite"],
      shares: ["PublishResource", "UnpublishResource", "UpdatePublicSettings"],
    },
    pagination: true,
    auth: {
      securitySchemes: { oauth: { type: "http", scheme: "OAuth" } },
      security: [{ oauth: [] }],
      reason:
        "The Swagger 1.2 source names no sign-in. <https://yandex.ru/dev/disk-api/doc/en/concepts/quickstart>: every " +
        "request carries `Authorization: OAuth <token>`.",
    },
  },
)
const coverage = artifacts.find((artifact) => artifact.path === "docs/dev/API_COVERAGE.md")
if (coverage && notes.length)
  coverage.content += ["", "## Spec corrections", "", ...notes.map((n) => `- ${n}`), ""].join("\n")
const format = (path: string, content: string) =>
  path.endsWith(".ts")
    ? execFileSync(
        process.execPath,
        [`${root}/node_modules/@biomejs/biome/bin/biome`, "check", "--write", `--stdin-file-path=${path}`],
        { cwd: root, encoding: "utf8", input: content, maxBuffer: 64 * 1024 * 1024 },
      )
    : content
const check = process.argv.includes("--check")
const stale = writeArtifacts(artifacts, { root, check, format })
if (check && stale.length) {
  process.stderr.write(`Generated files are stale: ${stale.join(", ")}; run pnpm generate\n`)
  process.exitCode = 1
}
