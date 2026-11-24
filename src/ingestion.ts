import { documentIngestion } from "@wirecat/cli-core/documents"
import { IDENTITY } from "./identity.js"
import { type DiskFile, isFolder } from "./yandex/source.js"

export const PROVIDER = {
  name: "yandex-disk",
  kind: "documents",
  aliases: [],
  command: IDENTITY.command,
  opens: { document: "documents show" },
} as const

const external = (id: string) => `${id}.md`

/** How the Disk's files are filed in the shared store; the documents commands and a replace's rekey share it. */
export const diskIngestion = (store: Parameters<typeof documentIngestion>[0]) =>
  documentIngestion<DiskFile>(store, {
    provider: PROVIDER.name,
    externalId: external,
    catalogInput: (file) => ({
      externalId: external(file.id),
      kind: isFolder(file) ? "folder" : "file",
      name: file.name,
      parents: file.parents.map(external),
      url: file.url,
      mime: file.mime,
      ...(file.createdAt ? { createdAt: file.createdAt } : {}),
      ...(file.modifiedAt ? { modifiedAt: file.modifiedAt } : {}),
      metadata: { path: file.providerMetadata.path },
    }),
    frontMatter: ({ metadata }) => ({
      source: PROVIDER.name,
      sourceUrl: metadata.url,
      resourceId: metadata.id,
      path: metadata.providerMetadata.path,
      modifiedAt: metadata.modifiedAt ?? null,
    }),
  })
