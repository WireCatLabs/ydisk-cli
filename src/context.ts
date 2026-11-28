import { join } from "node:path"
import { CliError, resolvePaths } from "@wirecat/cli-base"
import {
  type Asker,
  type BaseEnvironment,
  baseContext,
  type EventSink,
  environmentOf,
  type GlobalFlags,
  guardFor,
  keyedGuard,
  levelFor,
  linkFetch,
  Pacer,
  ProfileTokenStore,
  pacePathFor,
  terminalAsker,
} from "@wirecat/cli-core"
import { rekeySyncedDocument } from "@wirecat/cli-core/documents"
import type { Command } from "commander"
import { configuration, permissions } from "./config.js"
import { API_HOSTS, DESKTOP, IDENTITY, SERVICE } from "./identity.js"
import { diskIngestion, PROVIDER } from "./ingestion.js"
import { diskTarget } from "./yandex/mirror-target.js"
import { diskMount } from "./yandex/mount.js"
import { diskSource } from "./yandex/source.js"
import { type Transport, transport } from "./yandex/transport.js"
import { diskWrites } from "./yandex/writes.js"

/** What a test hands `run()` beside cli-core's own: the fake service in place of the network (WC-ARCH-10). */
export interface ServiceEnvironment extends BaseEnvironment {
  fetch?: typeof fetch
}

// Yandex's Disk API documentation names no rate limit; this pace stays well under what a person clicks.
export const PACE = { perMinute: 120, burst: 20 }

/**
 * Settings, keyring and the run come from cli-core's `baseContext` and nowhere else: a command that resolves settings
 * on its own skips `--timeout`, the run record and the profile's permissions (WC-LIFE-5, WC-LIFE-15).
 */
export const contextOf = (command: Command) => {
  const base = baseContext(command, configuration.resolveSettings)
  return {
    ...base,
    environment: environmentOf<ServiceEnvironment>(command),
    flags: command.optsWithGlobals<GlobalFlags>(),
    profile: base.settings.profile,
    tokens: new ProfileTokenStore({
      app: IDENTITY,
      env: base.env,
      ...(base.keyring ? { keyring: base.keyring } : {}),
      warn: base.renderer.warn,
    }),
  }
}

/** The profile's own folder under the state folder: its mirrors and the versions its file writes keep. */
export const profileStateDir = (command: Command) => {
  const { env, profile } = contextOf(command)
  if (!profile) throw new CliError("validation_error", "a profile is required")
  return join(resolvePaths({ appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }).state, "profiles", profile)
}

export const refuseOffline = (flags: GlobalFlags) => {
  if (flags.offline)
    throw new CliError("permission_error", `this needs ${SERVICE}; leave out --offline`, { reason: "offline.refused" })
}

/** Download and upload links point away from the API; linkFetch never sends them the token. */
export const LINK_HOSTS = (DESKTOP.hosts ?? []).filter((host) => !API_HOSTS.includes(host))
/** A file moves at the link's own pace; the run's --timeout and stop still end it. */
const LINK_TIMEOUT_MS = 60 * 60_000

/** The transport names no command (WC-ARCH-16); a refused token gets the words that sign this profile in again. */
const signInAgain = (api: Transport, profile: string): Transport => ({
  send: (request, answer) =>
    api.send(request, answer).catch((error: unknown) => {
      if (!(error instanceof CliError) || error.code !== "authentication_error") throw error
      throw new CliError(
        error.code,
        `${error.message}; sign in again with ${IDENTITY.command} ${profile} session start`,
        error.details,
      )
    }),
})

/** The Disk for one run, with the token it was given; `events` comes from `run()`, so each request is recorded. */
export const diskFor = (command: Command, events: EventSink | undefined, token: string) => {
  const { environment, env, profile, renderer } = contextOf(command)
  const api = signInAgain(
    transport({
      token,
      ...(events ? { events } : {}),
      signal: environment.signal,
      ...(environment.fetch ? { fetch: environment.fetch } : {}),
      pacer: new Pacer(pacePathFor(IDENTITY, profile, env), PACE),
    }),
    profile,
  )
  const links = linkFetch({
    hosts: LINK_HOSTS,
    timeoutMs: LINK_TIMEOUT_MS,
    ...(environment.fetch ? { fetch: environment.fetch } : {}),
  })
  const source = diskSource(api, links, environment.signal)
  return {
    ...source,
    ...diskWrites(api, links, environment.signal),
    // A replace that gave the file a new id moves its synced copy too, so the owner's tags and notes follow it.
    target: diskTarget(api, links, environment.signal, async (from, to) => {
      await rekeySyncedDocument({
        env,
        app: IDENTITY,
        provider: PROVIDER,
        ingestion: diskIngestion,
        account: await source.identity(),
        from,
        to,
        warn: renderer.warn,
      })
    }),
    mount: (root: string, onTruncated?: (path: string) => void) =>
      diskMount({ api, links, root, signal: environment.signal, ...(onTruncated ? { onTruncated } : {}) }),
  }
}

export type Disk = ReturnType<typeof diskFor>

/** The profile's saved token, or an authentication error that says how to sign in. Read before any request. */
export const tokenOf = (command: Command): string => {
  const { flags, profile, tokens } = contextOf(command)
  refuseOffline(flags)
  return tokens.need(profile)
}

/**
 * Every remote call goes through here: inside cli-core's run, so `--timeout` bounds it, a failure or `--record` keeps
 * a run named after the command, and the transport's requests land in that run (WC-LIFE-5, WC-LIFE-15).
 */
export const withDisk = <T>(command: Command, body: (disk: Disk) => Promise<T>): Promise<T> => {
  const token = tokenOf(command)
  return contextOf(command).run((events) => body(diskFor(command, events, token)))
}

/**
 * The guard of a write under the command's own key and `extra` (WC-PERM-13): a key that denies refuses before anything
 * is asked, and one question names every key at `ask`, once per guard.
 */
export const writeGuard = (command: Command, extra: readonly string[], ask: Asker = terminalAsker(command)) => {
  const { settings, env, renderer } = contextOf(command)
  return keyedGuard(
    (ask) =>
      guardFor(
        IDENTITY,
        { ...settings, sendsPerHour: Number.MAX_SAFE_INTEGER, permissionDefaults: permissions.defaults },
        renderer.warn,
        env,
        ask,
      ),
    ask,
    (key) => levelFor(settings.permissions, key, permissions.defaults).level,
    extra,
  )
}
