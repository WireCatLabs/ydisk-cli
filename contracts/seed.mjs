import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

// The previous release writes the state with its own modules and its own cli-core: one file synced from a fake Disk,
// as `ydisk <profile> sync` saves it, so the candidate reopens the schema, notes and catalog that release left.
const entry = realpathSync(process.argv[2])
const fromPrevious = createRequire(entry)
const previous = (path) => import(pathToFileURL(join(dirname(entry), "..", path)).href)
// cli-core 2.x names an entry per area; 3.x serves them all from ".", so a previous release on either one loads.
const core = async (name) => {
  try {
    return await import(pathToFileURL(fromPrevious.resolve(`@wirecat/cli-core/${name}`)).href)
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error
    return import(pathToFileURL(fromPrevious.resolve("@wirecat/cli-core")).href)
  }
}

if (!process.env.WIRECAT_CONTRACT_DENIED) throw new Error("requires the isolated contract runner")

const [{ IDENTITY }, { PROVIDER }, { openAppStore, rememberAccount }, { documentIngestion }, { documentProfile }] =
  await Promise.all([
    previous("identity.js"),
    previous("ingestion.js"),
    core("cli"),
    core("documents"),
    core("documents/cli"),
  ])

const principal = "synthetic-principal"
const file = {
  id: "synthetic-resource-1",
  name: "synthetic-budget.md",
  url: "https://disk.yandex.com/d/synthetic",
  mime: "text/markdown",
  parents: [],
  modifiedAt: "2026-10-01T10:00:00Z",
  providerMetadata: { path: "disk:/Synthetic/synthetic-budget.md" },
}
const text = "wirecat-synthetic-document-canary budget"
const external = (id) => `${id}.md`

const store = await openAppStore(process.env, { app: IDENTITY, provider: PROVIDER })
try {
  const ingestion = documentIngestion(store, {
    provider: PROVIDER.name,
    command: IDENTITY.command,
    externalId: external,
    catalogInput: (item) => ({
      externalId: external(item.id),
      kind: "file",
      name: item.name,
      parents: [],
      url: item.url,
      mime: item.mime,
      modifiedAt: item.modifiedAt,
      metadata: { path: item.providerMetadata.path },
    }),
    frontMatter: ({ metadata }) => ({
      source: PROVIDER.name,
      sourceUrl: metadata.url,
      resourceId: metadata.id,
      path: metadata.providerMetadata.path,
      modifiedAt: metadata.modifiedAt ?? null,
    }),
  })
  await ingestion.registerProfile("contract", principal)
  const ref = await ingestion.save(principal, { metadata: file, text }, "synthetic-hash-1")
  await store.notes.addNote({ text: "Synthetic owner memo", about: [ref] })
  const profile = documentProfile(IDENTITY, process.env, "contract")
  rememberAccount(IDENTITY, "contract", principal, process.env)
  profile.saveFolders(["synthetic-folder"], {})
  profile.state(principal).save({
    version: 1,
    principal,
    scope: "",
    folders: {},
    documents: { [file.id]: { metadata: file, hash: "synthetic-hash-1", reference: ref, tabs: 0 } },
    skipped: [],
  })
  profile.state(principal).saveSnapshot({ metadata: file, text, tabs: [] })
} finally {
  await store.close()
}
process.stdout.write(`${JSON.stringify({ seeded: true })}\n`)
