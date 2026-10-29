import { readFileSync } from "node:fs";

import { RepoPaths } from "./Paths.mjs";

/**
 * @typedef {object} Pack
 * @property {string} id Stable identifier used in skill.json and --pack
 * @property {string} name Display name
 * @property {string} description What kind of skills the pack holds
 */

/**
 * Loads the pack registry.
 *
 * @param {string} [file] Registry file, defaults to the repository pack registry
 * @returns {Pack[]} Packs in display order
 */
export function loadPacks(file = RepoPaths.packs) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    const seen = new Set();

    for (const pack of data.packs) {
        if (!/^[a-z0-9-]+$/.test(pack.id) || seen.has(pack.id)) {
            throw new Error(`Invalid or duplicate pack id: ${pack.id}`);
        }

        seen.add(pack.id);
    }

    return data.packs;
}

/**
 * Checks the packs a skill declares in skill.json.
 *
 * @param {import("./Skills.mjs").Skill} skill Skill to check
 * @param {Pack[]} packs Pack registry
 * @returns {string[]} Errors, empty when the skill is in at least one known pack
 */
export function validateSkillPacks(skill, packs) {
    const known = packs.map((pack) => pack.id);

    if (skill.packs.length === 0) {
        return [`skill.json has no packs; add at least one of: ${known.join(", ")}`];
    }

    return skill.packs.filter((id) => !known.includes(id)).map((id) => `skill.json names unknown pack "${id}"; known: ${known.join(", ")}`);
}

/**
 * Picks skills from --skill and --pack. Both take a comma separated list or "all", and the
 * result is the union of both. With neither, every skill is selected.
 *
 * @param {import("./Skills.mjs").Skill[]} skills All skills
 * @param {Pack[]} packs Pack registry
 * @param {Record<string, string | boolean>} flags Command flags
 * @returns {import("./Skills.mjs").Skill[]} Selected skills, in id order
 */
export function selectSkills(skills, packs, flags) {
    const skillList = typeof flags.skill === "string" ? flags.skill.split(",").map((id) => id.trim()) : [];
    const packList = typeof flags.pack === "string" ? flags.pack.split(",").map((id) => id.trim()) : [];

    if ((skillList.length === 0 && packList.length === 0) || skillList.includes("all") || packList.includes("all")) {
        return skills;
    }

    for (const id of skillList) {
        if (!skills.some((skill) => skill.id === id)) {
            throw new Error(`Unknown skill "${id}". Known: ${skills.map((skill) => skill.id).join(", ")}`);
        }
    }

    for (const id of packList) {
        if (!packs.some((pack) => pack.id === id)) {
            throw new Error(`Unknown pack "${id}". Known: ${packs.map((pack) => pack.id).join(", ")}`);
        }
    }

    return skills.filter((skill) => skillList.includes(skill.id) || skill.packs.some((id) => packList.includes(id)));
}
