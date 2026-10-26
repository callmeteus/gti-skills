import { loadHarnesses } from "../core/Registry.mjs";
import { discoverSkills } from "../core/Skills.mjs";

/**
 * Prints the skills and the supported agents.
 *
 * @param {Record<string, string | boolean>} flags Command flags (none are used)
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {number} Exit code
 */
export function runList(flags, io) {
    io.out("Skills");

    for (const skill of discoverSkills()) {
        io.out(`  ${skill.id.padEnd(20)} ${skill.displayName}`);
    }

    io.out("");
    io.out("Agents (id, project path, user path)");

    for (const harness of loadHarnesses()) {
        io.out(`  ${harness.id.padEnd(12)} ${harness.projectPath.padEnd(18)} ${harness.userPath}  [${harness.source}]`);
    }

    return 0;
}
