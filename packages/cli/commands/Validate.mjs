import { validateSkills } from "../core/Plan.mjs";
import { discoverSkills } from "../core/Skills.mjs";

/**
 * Validates every skill against the Agent Skills standard and the repository rules.
 *
 * @param {Record<string, string | boolean>} flags Command flags
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {number} Exit code, 1 when any skill has errors
 */
export function runValidate(flags, io) {
    const skills = discoverSkills().filter((skill) => typeof flags.skill !== "string" || skill.id === flags.skill);
    let failed = 0;

    for (const finding of validateSkills(skills)) {
        if (finding.errors.length === 0) {
            io.out(`ok      ${finding.skill}`);
        } else {
            failed += 1;
        }

        for (const error of finding.errors) {
            io.err(`error   ${finding.skill}: ${error}`);
        }

        for (const warning of finding.warnings) {
            io.err(`warning ${finding.skill}: ${warning}`);
        }
    }

    return failed > 0 ? 1 : 0;
}
