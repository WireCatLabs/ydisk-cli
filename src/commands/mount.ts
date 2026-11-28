import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import {
  itemOf,
  levelFor,
  type Mounted,
  outputFor,
  parseDuration,
  REMOTE_READ,
  renderAnswer,
  serveMount,
} from "@wirecat/cli-core"
import { Command } from "commander"
import { permissions } from "../config.js"
import { contextOf, diskFor, tokenOf } from "../context.js"
import { IDENTITY, SERVICE } from "../identity.js"
import { diskPath, isFolder } from "../yandex/source.js"

const CLI = IDENTITY.command

const portOf = (input: string | undefined) => {
  if (input === undefined) return 0
  const port = Number(input)
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new CliError("validation_error", "--port takes a number from 1 to 65535", { param: "--port" })
  return port
}

const serve = async (...[source, options]: Parameters<typeof serveMount>): Promise<Mounted> => {
  try {
    return await serveMount(source, options)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE")
      throw new CliError("validation_error", `port ${options?.port} is in use; choose another --port or leave it out`, {
        param: "--port",
      })
    throw error
  }
}

const told = (mounted: Mounted, path: string) =>
  [
    `${SERVICE} ${path} is served read-only at ${mounted.url}`,
    "Mount it with the system's own WebDAV client:",
    `  Linux:   ${mounted.how.linux}`,
    `  macOS:   ${mounted.how.macos}`,
    `  Windows: ${mounted.how.windows}`,
    "Any program on this computer that has this address can read the folder. Stop with Ctrl-C.",
    "",
  ].join("\n")

/**
 * A long-running server, so agents never get it over MCP (`lifetime: "persistent"`, WC-MCP). It only reads: cli-core's
 * mount refuses every write method, and the source it is given has no write.
 */
export const serveCommand = (): Command =>
  annotate(new Command("serve"), {
    effects: REMOTE_READ,
    offline: false,
    lifetime: "persistent",
    examples: [`${CLI} personal files serve`, `${CLI} personal files serve /Documents --port 8090`],
  })
    .summary("show a Disk folder as a read-only folder on this computer, until Ctrl-C")
    .description(
      "show a Disk folder, or the whole Disk, as a read-only folder on this computer: it serves the folder over " +
        "WebDAV on 127.0.0.1 behind a random address, which the system's own client mounts; nothing can be written, " +
        "renamed or deleted through it. Runs until Ctrl-C or --timeout",
    )
    .argument("[path]", "the Disk folder to show, like /Documents; the whole Disk without it")
    .option("--port <port>", "the local port to serve on; a free one without it")
    .action(async function (this: Command, path: string | undefined, args: { port?: string }) {
      const port = portOf(args.port)
      const root = diskPath(path ?? "/")
      const context = contextOf(this)
      // cli-core checks only the command's own key; a mount reads every file it shows, as files download does.
      const download = levelFor(context.settings.permissions, "files.download", permissions.defaults)
      if (download.level === "deny")
        throw new CliError(
          "permission_error",
          `profile ${context.profile} denies files.download, which files serve reads as`,
          {
            permission: "files.download",
          },
        )
      const token = tokenOf(this)
      const timeout = this.optsWithGlobals<{ timeout?: string }>().timeout
      const stop = AbortSignal.any(
        [
          context.environment.untilStopped?.(),
          context.environment.signal,
          timeout === undefined ? undefined : AbortSignal.timeout(parseDuration(timeout, "--timeout")),
        ].filter((one): one is AbortSignal => one !== undefined),
      )
      await context.run(
        async (events) => {
          const disk = diskFor(this, events, token)
          if (!isFolder(await disk.byPath(root)))
            throw new CliError("validation_error", "files serve shows a folder; give the folder that holds this file")
          const mounted = await serve(
            disk.mount(root, (folder) =>
              context.renderer.warn(`${folder} shows its first entries only; it holds too many to list`),
            ),
            { port, onError: (error) => context.renderer.warn(error instanceof Error ? error.message : String(error)) },
          )
          try {
            if (context.format === "pretty") context.streams.data(told(mounted, root))
            else
              renderAnswer(
                this,
                outputFor(this),
                itemOf({ path: root, url: mounted.url, read_only: true, mount: mounted.how }),
              )
            if (!stop.aborted) await new Promise((resolve) => stop.addEventListener("abort", resolve, { once: true }))
          } finally {
            await mounted.close()
          }
        },
        { unbounded: true },
      )
    })
