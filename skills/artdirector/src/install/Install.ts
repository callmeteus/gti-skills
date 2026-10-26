import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ArtErrors, Paths } from "../core";

/**
 * Supported agent skill locations.
 */
export const AgentTargets = {
    opencode: join(".opencode", "skills", "artdirector"),
    cursor: join(".cursor", "skills", "artdirector"),
    claude: join(".claude", "skills", "artdirector"),
    agents: join(".agents", "skills", "artdirector")
} as const;

export type AgentId = keyof typeof AgentTargets;

/**
 * Copies the single ArtDirector skill into a project or home directory.
 */
export namespace SkillInstall {
    /**
     * Installs the skill for one or all agents.
     *
     * @param options Target and destination root
     * @returns Installed paths
     */
    export function run(options: {
        agent: AgentId | "all";
        dest: string;
    }): string[] {
        const agents: AgentId[] = options.agent === "all"
            ? ["opencode", "cursor", "claude", "agents"]
            : [options.agent];
        const source = Paths.skillDir();

        if (!existsSync(join(source, "SKILL.md"))) {
            throw ArtErrors.notFound("Canonical skill/artdirector/SKILL.md is missing.");
        }

        const installed: string[] = [];

        for (const agent of agents) {
            const dest = join(options.dest, AgentTargets[agent]);
            mkdirSync(dirname(dest), { recursive: true });
            cpSync(source, dest, { recursive: true });

            const scriptsDir = join(dest, "scripts");
            mkdirSync(scriptsDir, { recursive: true });
            writeFileSync(join(scriptsDir, "artdirector.root"), Paths.packageRoot(), "utf8");

            installed.push(dest);

            if (agent === "opencode") {
                const commandSource = join(Paths.packageRoot(), "skill", "opencode", "commands", "artdirector.md");
                const commandDest = join(options.dest, ".opencode", "commands", "artdirector.md");

                mkdirSync(dirname(commandDest), { recursive: true });
                cpSync(commandSource, commandDest);
                installed.push(commandDest);
            }
        }

        return installed;
    }

    /**
     * Writes a tiny OpenCode config snippet pointing at the skill.
     *
     * @param dest Project root
     */
    export function writeOpenCodeHint(dest: string): void {
        const file = join(dest, "opencode.json");

        if (existsSync(file)) {
            return;
        }

        writeFileSync(
            file,
            `${JSON.stringify({
                $schema: "https://opencode.ai/config.json",
                skills: [".opencode/skills"]
            }, null, 4)}\n`,
            "utf8"
        );
    }

    /**
     * Reads the canonical skill body (for tests).
     *
     * @returns SKILL.md text
     */
    export function skillSource(): string {
        return readFileSync(join(Paths.skillDir(), "SKILL.md"), "utf8");
    }
}
