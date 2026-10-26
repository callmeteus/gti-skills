import { validateSkills } from "../core/Plan.mjs";
import { loadHarnesses } from "../core/Registry.mjs";
import { discoverSkills, loadSkillFiles, writeSyncedRegions } from "../core/Skills.mjs";

/**
 * Syncs shared and generated files into each skill, then validates the skills.
 *
 * Generated files are the shared scripts, the per-agent guides in `harnesses/<agent>/GUIDE.md`,
 * and the documents listed in `skill.json`.
 *
 * @param {Record<string, string | boolean>} flags Command flags (none are used)
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {number} Exit code
 */
export function runBuild(flags, io) {
    const harnesses = loadHarnesses();
    const skills = discoverSkills();
    let written = 0;

    for (const skill of skills) {
        const { files, regions } = loadSkillFiles(skill, harnesses);
        writeSyncedRegions(skill, files, regions);
        written += regions.length;
    }

    const findings = validateSkills(skills);
    const failed = findings.filter((finding) => finding.errors.length > 0);

    for (const finding of findings) {
        for (const error of finding.errors) {
            io.err(`error   ${finding.skill}: ${error}`);
        }

        for (const warning of finding.warnings) {
            io.err(`warning ${finding.skill}: ${warning}`);
        }
    }

    if (failed.length > 0) {
        io.err(`Build finished with ${failed.length} skill(s) failing validation.`);

        return 1;
    }

    io.out(`Built ${skills.length} skill(s): ${written} synced or generated paths for ${harnesses.length} agent(s).`);

    return 0;
}
