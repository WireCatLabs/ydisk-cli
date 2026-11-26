import { tokenSessionCommand } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { configuration } from "../config.js"
import { diskFor } from "../context.js"
import { IDENTITY, SERVICE } from "../identity.js"

const GUIDE = `## Get a Yandex OAuth token

1. Register an app at [oauth.yandex.ru/client/new](https://oauth.yandex.ru/client/new/) ("For API access or debugging"), with the Yandex Disk access cloud_api:disk.read, cloud_api:disk.write and cloud_api:disk.info (only disk.read and disk.info for a read-only token). Copy its ClientID.
2. Open https://oauth.yandex.ru/authorize?response_type=token&client_id= with the ClientID added at the end, allow access and copy the token.

Every step, with Yandex's own labels: [get a Yandex token](https://github.com/WireCatLabs/ydisk-cli/blob/main/docs/installation.md#get-a-yandex-token).`

/**
 * Yandex shows the OAuth token to the person in the browser (https://yandex.ru/dev/id/doc/en/tokens/debug-token), so
 * `session start` takes it pasted, as an API token, rather than through cli-core's OAuth sign-in.
 */
export const sessionCommand = (): Command =>
  tokenSessionCommand({
    app: IDENTITY,
    service: SERVICE,
    resolveSettings: configuration.resolveSettings,
    token: "OAuth token",
    guide: GUIDE,
    endNote: "Remove the app in Yandex ID's Data access to revoke it there: https://id.yandex.ru/personal/data-access",
    verify: async (command, token, events) => {
      const user = await diskFor(command, events, token).account()
      return { id: user.id, account: user }
    },
  })
