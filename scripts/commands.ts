import { readFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { apiSkillFiles, writeArtifacts } from "@wirecat/cli-base/codegen"
import { COMMANDS_PAGE_LABELS, commandsPage, describeOptions, describeProgram } from "@wirecat/cli-base/commands"
import { skillFiles } from "@wirecat/cli-base/skill"
import { commandHelpMarkdown } from "@wirecat/cli-core"
import { API } from "../dist/config.js"
import { IDENTITY, SKILL } from "../dist/identity.js"
import { createProgram } from "../dist/program.js"

const root = resolve(import.meta.dirname, "..")
const program = createProgram()
const page = commandsPage({
  cli: IDENTITY.command,
  commands: describeProgram(program),
  options: describeOptions(program),
  labels: COMMANDS_PAGE_LABELS.en,
  details: (command) => commandHelpMarkdown(program, command.path),
  text: {
    banner: "<!-- Generated from the command tree by pnpm generate. Do not edit. -->",
    title: "Commands",
    intro: `Every command, option and exit code, generated from the program itself. For the same list as JSON, run
\`${IDENTITY.command} commands --json\`.

**The first word is the profile**, a name you choose: \`${IDENTITY.command} personal config show\`. \`${IDENTITY.envPrefix}_PROFILE\`
does the same for a whole shell session. No profile is assumed: a command that uses an account stops without one and
lists the profiles on this computer.`,
    globalHeading: "Options for every command",
    globalIntro: "",
    mutates: "**Changes something in the service.**",
    mutatesLocal: "**Changes something on this computer only.**",
    exitHeading: "Exit codes",
    exitIntro: "Branch on the code, not on the text: the text can change, the code does not.",
    outro: "",
  },
})
const check = process.argv.includes("--check")
const artifacts = [{ path: "docs/commands.md", content: page.replace(/\n{3,}/g, "\n\n") }]
const skillFolder = relative(root, dirname(fileURLToPath(SKILL)))
artifacts.push(
  ...apiSkillFiles({
    cli: IDENTITY.command,
    folder: skillFolder,
    files: skillFiles(SKILL),
    service: API.service,
    operations: API.manifest.operations,
    skill: readFileSync(SKILL, "utf8"),
    commands: describeProgram(program),
    banner: "Generated from the API manifest and the command tree by pnpm generate. Do not edit.",
  }),
)
const apiPages = relative(root, fileURLToPath(new URL("references/api", SKILL)))
const stale = writeArtifacts(artifacts, { root, check, owns: [apiPages] })
if (check && stale.length) {
  process.stderr.write(`Stale: ${stale.join(", ")}; run pnpm generate\n`)
  process.exitCode = 1
}
