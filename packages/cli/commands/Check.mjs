import { validateSkills } from "../core/Plan.mjs";
import { loadHarnesses } from "../core/Registry.mjs";
import { discoverSkills, isGuide, loadSkillFiles, skillSkip } from "../core/Skills.mjs";
import { readTree } from "../core/Tree.mjs";

/**
 * Finds drift between synced regions on disk and what the build would write.
 *
 * @param {import("../core/Skills.mjs").Skill} skill Skill to compare
 * @param {import("../core/Registry.mjs").Harness[]} harnesses Harness registry
 * @returns {string[]} Problems in `skills/<id>/<path>: problem` form
 */
function syncDrift(skill, harnesses) {
    const { files, regions } = loadSkillFiles(skill, harnesses);
    const disk = readTree(skill.dir, skillSkip(skill));
    const inRegion = (path) => isGuide(path) || regions.some((region) => path === region || path.startsWith(`${region}/`));
    const problems = [];

    for (const [path, content] of files) {
        if (!inRegion(path)) {
            continue;
        }

        if (!disk.has(path)) {
            problems.push(`skills/${skill.id}/${path}: missing`);
        } else
        if (!disk.get(path).equals(content)) {
            problems.push(`skills/${skill.id}/${path}: changed`);
        }
    }

    for (const path of disk.keys()) {
        if (inRegion(path) && !files.has(path)) {
            problems.push(`skills/${skill.id}/${path}: stale`);
        }
    }

    return problems;
}

/**
 * Verifies that synced and generated files are up to date and every skill is valid. Writes nothing.
 *
 * @param {Record<string, string | boolean>} flags Command flags (none are used)
 * @param {{ out: (line: string) => void, err: (line: string) => void }} io Output channels
 * @returns {number} Exit code, 1 when anything is out of date or invalid
 */
export function runCheck(flags, io) {
    const harnesses = loadHarnesses();
    const skills = discoverSkills();
    const problems = [];

    for (const skill of skills) {
        problems.push(...syncDrift(skill, harnesses));
    }

    for (const finding of validateSkills(skills)) {
        for (const error of finding.errors) {
            problems.push(`${finding.skill}: ${error}`);
        }
    }

    if (problems.length > 0) {
        for (const problem of problems.slice(0, 40)) {
            io.err(problem);
        }

        io.err(`${problems.length} problem(s). Run \`node packages/cli build\` and commit the result.`);

        return 1;
    }

    io.out(`OK: ${skills.length} skill(s), ${harnesses.length} agent(s), synced and generated files are up to date.`);

    return 0;
}
