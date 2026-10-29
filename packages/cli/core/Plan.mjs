import { validateSkillFolder } from "./Frontmatter.mjs";
import { loadPacks, validateSkillPacks } from "./Packs.mjs";

/**
 * Validates every skill folder on disk and the packs each skill declares.
 *
 * @param {import("./Skills.mjs").Skill[]} skills Skills to validate
 * @param {import("./Packs.mjs").Pack[]} [packs] Pack registry, defaults to the repository registry
 * @returns {{ skill: string, errors: string[], warnings: string[] }[]} Findings per skill
 */
export function validateSkills(skills, packs = loadPacks()) {
    return skills.map((skill) => {
        const finding = validateSkillFolder(skill.dir, skill.id);

        return { skill: skill.id, errors: [...finding.errors, ...validateSkillPacks(skill, packs)], warnings: finding.warnings };
    });
}
