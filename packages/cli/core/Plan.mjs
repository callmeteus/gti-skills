import { validateSkillFolder } from "./Frontmatter.mjs";

/**
 * Validates every skill folder on disk.
 *
 * @param {import("./Skills.mjs").Skill[]} skills Skills to validate
 * @returns {{ skill: string, errors: string[], warnings: string[] }[]} Findings per skill
 */
export function validateSkills(skills) {
    return skills.map((skill) => ({ skill: skill.id, ...validateSkillFolder(skill.dir, skill.id) }));
}
