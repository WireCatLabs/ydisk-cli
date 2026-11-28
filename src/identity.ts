import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import type { AppIdentity } from "@wirecat/cli-core"
import { VERSION } from "./version.js"

export const PACKAGE = "@wirecat/yandex-disk-cli"

export const IDENTITY: AppIdentity = {
  command: "ydisk",
  appName: "yandex-disk-cli",
  envPrefix: "YDISK",
  description: "Yandex Disk for your AI agents: chosen folders as searchable text, and the files live",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/ydisk-cli/issues/new",
  messenger: false,
  contentLanguages: ["ru", "en"],
}

// What `wcat` and WireCat Desktop show before the tool is installed. The bin passes it to wcatStart before anything
// else loads; src/wcat.ts adds the permission keys.
export const DESKTOP: ManifestIdentity = {
  ...IDENTITY,
  docs: "https://github.com/WireCatLabs/ydisk-cli#readme",
  // Every host the CLI contacts (WC-CMD-32). The API is cloud-api.yandex.net; its download and upload links point at
  // downloader.disk.yandex.ru and *.disk.yandex.net (https://yandex.ru/dev/disk-api/doc/en/reference/content, …/upload);
  // the first live check (2026-11-17) got a link on mds.storage.yandex.net, which the docs do not name.
  hosts: ["cloud-api.yandex.net", "downloader.disk.yandex.ru", "*.disk.yandex.net", "*.storage.yandex.net"],
  syncs: "files in the Disk folders you choose",
  mcpPort: 8760,
  tagline: "Search your Yandex Disk folders and work with the files",
  signIn: {
    gives: "Lets your agent read, search and change the files on your Yandex Disk through ydisk.",
    asks: "A Yandex OAuth token with Disk access, pasted once and kept in the system keyring.",
    methods: [
      {
        id: "token",
        label: "Yandex OAuth token",
        words: ["{profile}", "session", "start", "--json"],
        password: "YDISK_TOKEN",
        stdin: true,
      },
    ],
  },
}

/** The API's one host: the token goes nowhere else. */
export const SERVICE = "Yandex Disk"

export const API_HOSTS = ["cloud-api.yandex.net"]

export const SKILL = new URL("../skills/yandex-disk-cli/SKILL.md", import.meta.url)
