import { loadPacks } from "../core/Packs.mjs";
import { loadHarnesses } from "../core/Registry.mjs";
import { discoverSkills } from "../core/Skills.mjs";

/**
 * Prints the skills, the packs, and the supported agents.
 *
 * @param {Record<string, string | boolean>} flags Command flags (none are used)
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {number} Exit code
 */
export function runList(flags, io) {
    const skills = discoverSkills();

    io.out("Skills");

    for (const skill of skills) {
        io.out(`  ${skill.id.padEnd(24)} ${skill.displayName.padEnd(24)} ${skill.packs.join(", ")}`);
    }

    io.out("");
    io.out("Packs (install one with --pack <id>)");

    for (const pack of loadPacks()) {
        const members = skills.filter((skill) => skill.packs.includes(pack.id)).map((skill) => skill.id);
        io.out(`  ${pack.id.padEnd(12)} ${pack.description}`);
        io.out(`  ${"".padEnd(12)} ${members.length > 0 ? members.join(", ") : "(no skills yet)"}`);
    }

    io.out("");
    io.out("Agents (id, project path, user path)");

    for (const harness of loadHarnesses()) {
        io.out(`  ${harness.id.padEnd(12)} ${harness.projectPath.padEnd(18)} ${harness.userPath}  [${harness.source}]`);
    }

    return 0;
}
