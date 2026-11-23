import { createProgram } from "./command-program.ts"

const GENERATED =
  "generated from Yandex Disk's Swagger 1.2; src/api.test.ts sends every operation through cli-base's strict fake, " +
  "and pnpm generate:check checks the generation"

type Node = { name(): string; commands: readonly Node[]; options: readonly { long?: string }[] }
const api = (createProgram() as unknown as Node).commands.find((command) => command.name() === "api")
const generatedOptions = [
  ...new Set(
    (api?.commands ?? [])
      .filter((command) => !["list", "show"].includes(command.name()))
      .flatMap((command) => command.options.map((option) => option.long ?? "")),
  ),
].filter((name) => name && name !== "--help")

const MODEL =
  "needs a downloaded meaning model or a configured model provider; cli-core's documents kit tests the shared command " +
  "with a fake model, and no test here downloads one"
const SHARED_DOCUMENTS =
  "cli-core's shared documents command, mounted by documentLibraryCommands; cli-core's documents tests and " +
  "documentCommandsContract drive it, and src/library.test.ts runs the contract over this CLI"
const leaves = (command: Node, prefix: string): { command: string; option?: string }[] => {
  const path = `${prefix} ${command.name()}`
  if (command.commands.length) return command.commands.flatMap((one) => leaves(one, path))
  const options = command.options.map((option) => option.long ?? "").filter((name) => name && name !== "--help")
  return [{ command: path }, ...options.map((option) => ({ command: path, option }))]
}
const SHARED_GROUPS = ["catalog", "relationships", "notes", "memories", "facts", "identities", "tags", "documents"]
const shared = (createProgram() as unknown as Node).commands
  .filter((command) => SHARED_GROUPS.includes(command.name()))
  .flatMap((group) => group.commands.flatMap((command) => leaves(command, group.name())))
  .flatMap((one) => (one.command.startsWith("memories extract") ? [] : [{ ...one, reason: SHARED_DOCUMENTS }]))

const SHARED_MCP =
  "cli-core's appMcpCommand; its app-mcp-command and mcp-server-command tests drive it, and src/mcp.test.ts runs " +
  "this CLI's own server, config, revoke and refusals"
const SHARED_REPORTS = "cli-core's appDoctorCommand; its app-mcp-command test creates and shows a report"
const LONG_RUNNING = `starts an HTTP server or a background process that runs until stopped; ${SHARED_MCP}`

export const UNTESTED: { command: string; option?: string; reason: string }[] = [
  { command: "sync", option: "--embed", reason: MODEL },
  { command: "memories extract", reason: MODEL },
  ...["--scope", "--tab", "--yes"].map((option) => ({ command: "memories extract", option, reason: MODEL })),
  { command: "api *", reason: GENERATED },
  ...generatedOptions.map((option) => ({ command: "api *", option, reason: GENERATED })),
  ...["folders remove", "search"].map((command) => ({ command, reason: SHARED_DOCUMENTS })),
  ...["--limit", "--rescan"].map((option) => ({ command: "sync", option, reason: SHARED_DOCUMENTS })),
  ...["--limit", "--page", "--exact"].map((option) => ({ command: "search", option, reason: SHARED_DOCUMENTS })),
  ...shared,
  ...[undefined, "--since", "--until", "--event", "--limit", "--page"].map((option) => ({
    command: "changes",
    ...(option ? { option } : {}),
    reason:
      "cli-core's shared change log of the synced copy, mounted by documentLibraryCommands; cli-core's history tests " +
      "drive it over the store",
  })),
  {
    command: "",
    option: "--help-all",
    reason: "Commander answers before any command runs, so the trace never sees it; contracts/help.snap covers help",
  },
  {
    command: "",
    option: "--version",
    reason: "Commander answers before any command runs, so the trace never sees it; `pnpm version:check` checks it",
  },
  {
    command: "mcp server start",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server start",
    option: "--port",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server start",
    option: "--public-url",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server stop",
    reason:
      "stops the detached server that `mcp server start` wrote a pid file for; cli-core tests mcpServerCommand, and no live scenario starts a server to stop",
  },
  ...["--http", "--port", "--public-url"].map((option) => ({ command: "mcp serve", option, reason: LONG_RUNNING })),
  { command: "doctor reports show", reason: SHARED_REPORTS },
  { command: "doctor reports create", reason: SHARED_REPORTS },
  { command: "doctor reports create", option: "--run", reason: SHARED_REPORTS },
  { command: "doctor reports create", option: "--output", reason: SHARED_REPORTS },
  { command: "mcp server status", reason: LONG_RUNNING },
  { command: "mcp server status", option: "--profiles", reason: LONG_RUNNING },
  { command: "mcp revoke", option: "--profiles", reason: SHARED_MCP },
  ...[undefined, "--allow-writes", "--permission"].map((option) => ({
    command: "mcp add",
    ...(option ? { option } : {}),
    reason: `writes Codex's or Claude Code's own MCP settings; ${SHARED_MCP}`,
  })),
  ...[undefined, "--permission"].map((option) => ({
    command: "mcp check",
    ...(option ? { option } : {}),
    reason: `starts the installed CLI as a child process, as the agent would; ${SHARED_MCP}`,
  })),
]
