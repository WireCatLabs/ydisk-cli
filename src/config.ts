import {
  type ConditionalKey,
  type Configuration,
  commandPermissions,
  serviceApiPermissions,
  settingsFor,
} from "@wirecat/cli-core/cli"
import { DOCUMENT_HISTORY_SETTINGS } from "@wirecat/cli-core/documents/cli"
import * as manifest from "./generated/manifest.js"
import { IDENTITY, SERVICE } from "./identity.js"

/** The key every overwrite and permanent delete also checks, as the api group's `deletingFlags` do. */
export const DELETE_KEY = "files.delete"
/** The key every file a command puts on the Disk checks, as `files upload` does. */
export const UPLOAD_KEY = "files.upload"
/** A public link opens the file to anyone who has it. */
export const SHARE_KEY = "files.share"

// The keys a delete or a share checks (`files.delete`, `files.share`) come from `permissions` in scripts/generate.ts.
// An operation that answers with a credential is left out: the CLI signs in through `session`, and the api group would
// drop it anyway.
export const LINK_OPERATIONS = ["GetResourceDownloadLink", "GetResourceUploadLink", "GetPublicResourceDownloadLink"]

/**
 * The `files` command each raw operation does the same as. Its key is added to the operation's own, so `files.move`
 * set to deny also stops `api resources-move`, and its `--dry-run` shows the key (WC-PERM-22).
 */
const COMMAND_KEYS: Readonly<Record<string, string>> = {
  "resources-copy": "files.copy",
  "resources-move": "files.move",
  "resources-create": "files.create",
  "resources-publish": "files.publish",
  "resources-unpublish": "files.unpublish",
  "trash-resources-restore": "files.restore",
  // Both put a file on the Disk: one from an address on the web, one from someone's public link.
  "resources-upload-url": "files.upload",
  "public-resources-save-to-disk": "files.upload",
}

export const API = {
  // A download or upload link carries its own grant to the file, so it is never printed: files download and upload
  // use it without showing it.
  manifest: {
    ...manifest,
    operations: manifest.operations
      .filter((operation) => !operation.response?.sensitive && !LINK_OPERATIONS.includes(operation.id))
      .map((operation) => {
        const key = COMMAND_KEYS[operation.command]
        return key ? { ...operation, permissions: [...(operation.permissions ?? []), { key }] } : operation
      }),
  },
  service: SERVICE,
}

const REPLACES = { key: DELETE_KEY, when: "with --replace" }

/** A mirror's sync writes on both sides: what it sends checks as an upload, what it replaces or trashes as a delete. */
const MIRROR_CHECKS = [
  { key: UPLOAD_KEY, when: "for each file it puts on the Disk" },
  { key: DELETE_KEY, when: "for each file it replaces or moves to a trash, on either side" },
]

/** What a `files` write checks beside its own key, so `--dry-run` shows the same keys as the run. */
const FILES_CHECKS: Readonly<Record<string, readonly (string | ConditionalKey)[]>> = {
  "files upload": [REPLACES],
  "files copy": [REPLACES],
  "files move": [REPLACES],
  "files publish": [SHARE_KEY],
  "files unpublish": [SHARE_KEY],
  "mirrors sync": MIRROR_CHECKS,
  "mirrors watch": MIRROR_CHECKS,
  // It reads every file it shows, as files download does, so a profile that denies that also refuses it.
  "files serve": ["files.download"],
}

const api = serviceApiPermissions(API)

export const permissions = commandPermissions({
  extra: api.extra,
  alsoChecks: (path) => [...api.alsoChecks(path), ...(FILES_CHECKS[path.join(" ")] ?? [])],
  defaults: {
    ...api.defaults,
    // The api group makes each of its keys `ask`; a command's own key keeps the command's level, as `files move`
    // has it, on both paths.
    ...Object.fromEntries(Object.values(COMMAND_KEYS).map((key) => [key, "allow"])),
  },
})

export const configuration: Configuration = settingsFor(IDENTITY, {
  permissions,
  profile: DOCUMENT_HISTORY_SETTINGS.profile,
  settings: DOCUMENT_HISTORY_SETTINGS.settings,
})
