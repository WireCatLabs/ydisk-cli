import { join } from "node:path"
import { resolvePaths } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import {
  appDoctorCommand,
  appMcpCommand,
  appUpdate,
  commandsCommand,
  configCommand,
  createProgram as createSharedProgram,
  outputFor,
  ProfileTokenStore,
  type ProgramDefinition,
  type ProgramOptions,
  type RunOptions,
  run as runShared,
  runsCommand,
  sharedStoreCommand,
  skillCommand,
  upgradeCommand,
} from "@wirecat/cli-core"
import type { Command } from "commander"
import { accountCommand } from "./commands/account.js"
import { apiCommand } from "./commands/api.js"
import { filesCommand } from "./commands/files.js"
import { libraryCommands } from "./commands/library.js"
import { mirrorsCommand } from "./commands/mirrors.js"
import { sessionCommand } from "./commands/session.js"
import { configuration } from "./config.js"
import { diskFor, tokenOf } from "./context.js"
import { IDENTITY, PACKAGE, SERVICE, SKILL } from "./identity.js"

const update = appUpdate({
  packageName: PACKAGE,
  command: IDENTITY.command,
  version: IDENTITY.version,
  entry: import.meta.url,
  statePath: (env) =>
    join(resolvePaths({ appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }).state, "update-check.json"),
  // biome-ignore lint/plugin/no-own-settings: the update check runs before any command exists to give baseContext
  enabled: (env) => configuration.resolveSettings({}, { env, needsProfile: false }).updateCheck,
  offVariables: [`${IDENTITY.envPrefix}_NO_UPDATE_CHECK`],
})

const storeCommand = () => {
  const store = sharedStoreCommand()
  for (const info of store.commands) annotate(info, { examples: [`${IDENTITY.command} store info --json`] })
  return store
}

const mcpCommand = () =>
  appMcpCommand(IDENTITY, configuration, {
    name: SERVICE,
    // Files can come from anyone who shared them or saved them to the Disk (WC-MCP-11).
    untrusted: ["file text", "file and folder names"],
    permissionExample: "files.delete=deny",
    skill: SKILL,
    signedIn: (profile, env, keyring) =>
      new ProfileTokenStore({ app: IDENTITY, env, ...(keyring ? { keyring } : {}) }).signedIn(profile),
  })

/** `doctor --online` asks the Disk whose token the profile holds, as `session status --check` does. */
const doctorCommand = () => {
  // cli-core hands `online` only the environment; the command carries the profile, the keyring and a test's fake.
  // doctor already runs `--online` inside its own run, which `online` cannot reach, so no second run is opened here.
  const doctor: Command = appDoctorCommand(IDENTITY, configuration, {
    packageName: PACKAGE,
    online: async () => ({ ok: true, user: await diskFor(doctor, undefined, tokenOf(doctor)).account() }),
  })
  return doctor
}

export const definition = (): ProgramDefinition => ({
  app: IDENTITY,
  // The whole object: cli-core refuses a command by its key only when it gets the permission table too.
  configuration,
  commands: () => [
    commandsCommand(IDENTITY),
    sessionCommand(),
    accountCommand(),
    ...libraryCommands(),
    filesCommand(),
    mirrorsCommand(),
    storeCommand(),
    apiCommand(),
    doctorCommand(),
    skillCommand(IDENTITY, SKILL),
    mcpCommand(),
    upgradeCommand(IDENTITY, PACKAGE, (command) => ({
      ...outputFor(command),
      installer: () => update.installer({}),
      latest: () => update.latest({}),
      install: (argv) => update.runUpdate(argv, {}),
    })),
    configCommand(IDENTITY, configuration),
    runsCommand(IDENTITY),
  ],
})

export const createProgram = (options?: ProgramOptions): Command => createSharedProgram(definition(), options)

export const run = (argv: string[], options?: RunOptions): Promise<number> => runShared(argv, definition(), options)
