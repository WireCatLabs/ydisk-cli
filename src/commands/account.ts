import { annotate } from "@wirecat/cli-base/commands"
import {
  type AccountRemoval,
  accountRemoveCommand,
  LOCAL_READ,
  LOCAL_WRITE,
  ProfileTokenStore,
} from "@wirecat/cli-core/cli"
import { documentProfile } from "@wirecat/cli-core/documents/cli"
import { Command } from "commander"
import { configuration } from "../config.js"
import { IDENTITY, SERVICE } from "../identity.js"
import { PROVIDER } from "../ingestion.js"

const removal: AccountRemoval = {
  // The token is an OAuth token the owner made; only Yandex's own page revokes it, so nothing is revoked here.
  signOut: async (profile, { env, keyring }) => {
    const gone = new ProfileTokenStore({ app: IDENTITY, env, ...(keyring ? { keyring } : {}) }).remove(profile)
    return { revoked: null, removed: gone.length ? [`the ${SERVICE} token of ${profile}`] : [] }
  },
  // The chosen folders and the synced files; the store's copy is cli-core's, kept or deleted by the flag.
  dataFiles: (profile, { env }) => [documentProfile(IDENTITY, env, profile).dir],
}

export const accountCommand = (): Command =>
  annotate(new Command("account"), { effects: LOCAL_READ })
    .description("this profile on this computer")
    .addCommand(
      accountRemoveCommand(IDENTITY, removal, {
        provider: PROVIDER.name,
        resolveSettings: configuration.resolveSettings,
        effects: LOCAL_WRITE,
      }),
    )
