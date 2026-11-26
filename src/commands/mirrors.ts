import { CliError } from "@wirecat/cli-base"
import { outputFor, renderAnswer } from "@wirecat/cli-core/cli"
import { type FileMirrorWrite, fileMirrorsCommand, keepVersionsForDays } from "@wirecat/cli-core/documents/cli"
import type { Command } from "commander"
import { DELETE_KEY, UPLOAD_KEY } from "../config.js"
import { contextOf, diskFor, profileStateDir, tokenOf, writeGuard } from "../context.js"
import { IDENTITY, SERVICE } from "../identity.js"
import { diskPath } from "../yandex/source.js"

/**
 * A file put on the Disk also checks `files.upload`; a file replaced or moved to a trash, on either side,
 * `files.delete`, as `files upload --replace` does.
 */
export const mirrorKeys = ({ action, side }: FileMirrorWrite): readonly string[] => [
  ...(side === "remote" && action !== "delete" ? [UPLOAD_KEY] : []),
  ...(action === "update" || action === "delete" ? [DELETE_KEY] : []),
]

const profileOf = (command: Command) => {
  const { profile } = contextOf(command)
  if (!profile) throw new CliError("validation_error", "a profile is required")
  return profile
}

/** cli-core's `mirrors` group over Disk folders: `/` mirrors the whole Disk into a folder of its own. */
export const mirrorsCommand = (): Command =>
  fileMirrorsCommand({
    identity: IDENTITY,
    service: SERVICE,
    remote: "disk",
    root: {
      place: "Disk folder",
      description: "the Disk folder, by its path, like /Notes, or / for the whole Disk",
      examples: ["/Notes ./notes", '/ ~/YandexDisk --ignore Photos --ignore "*.iso"'],
      note: "/ mirrors the whole Disk into a folder of its own",
    },
    output: (command, body) => renderAnswer(command, outputFor(command), body),
    profile: profileOf,
    stateDir: profileStateDir,
    keepForDays: (command) => keepVersionsForDays(contextOf(command).settings),
    connect: (command, body, options) => {
      const token = tokenOf(command)
      return contextOf(command).run((events) => {
        const disk = diskFor(command, events, token)
        return body({
          target: disk.target,
          root: async (input) => {
            const remote = await disk.byPath(diskPath(input))
            if (remote.mime !== "inode/directory")
              throw new CliError("validation_error", `${input} is a file on ${SERVICE}, not a folder`, {
                reason: "mirror.not-folder",
              })
            return { folder: remote.providerMetadata.path, rootId: remote.id }
          },
        })
      }, options)
    },
    writeGuard,
    keysOf: mirrorKeys,
  })
