import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { RepoPaths } from "./Paths.mjs";

/**
 * @typedef {object} Harness
 * @property {string} id Stable identifier, also the folder name under harnesses/
 * @property {string} name Display name
 * @property {string} projectPath Skills folder relative to a project root
 * @property {string} userPath Skills folder under the home directory, written with a leading ~/
 * @property {"official" | "community"} source Where the path was confirmed
 * @property {string} docs Documentation link
 * @property {boolean} slashCommand Whether the agent can invoke a skill as /skill-name
 * @property {string | null} verify How to confirm the agent discovered a skill, when the agent has a way
 * @property {string} notes Extra behavior worth knowing
 */

/**
 * Loads the harness registry.
 *
 * @param {string} [file] Registry file, defaults to the repository registry
 * @returns {Harness[]} Harnesses in display order
 */
export function loadHarnesses(file = RepoPaths.registry) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    const seen = new Set();

    for (const harness of data.harnesses) {
        if (!/^[a-z0-9-]+$/.test(harness.id) || seen.has(harness.id)) {
            throw new Error(`Invalid or duplicate harness id: ${harness.id}`);
        }

        seen.add(harness.id);

        if (!harness.userPath.startsWith("~/")) {
            throw new Error(`userPath of ${harness.id} must start with ~/`);
        }
    }

    return data.harnesses;
}

/**
 * Picks harnesses from a comma separated list or "all".
 *
 * @param {Harness[]} harnesses All harnesses
 * @param {string} selection Comma separated ids, or "all"
 * @returns {Harness[]} Selected harnesses
 */
export function selectHarnesses(harnesses, selection) {
    if (selection === "all") {
        return harnesses;
    }

    return selection.split(",").map((raw) => {
        const id = raw.trim();
        const found = harnesses.find((harness) => harness.id === id);

        if (!found) {
            throw new Error(`Unknown harness "${id}". Known: ${harnesses.map((harness) => harness.id).join(", ")}`);
        }

        return found;
    });
}

/**
 * Resolves the skills folder of a harness for a scope.
 *
 * @param {Harness} harness Target harness
 * @param {"project" | "user"} scope Install scope
 * @param {string} projectRoot Project root used for the project scope
 * @param {string} [home] Home directory used for the user scope
 * @returns {string} Absolute skills folder
 */
export function skillsFolder(harness, scope, projectRoot, home = homedir()) {
    if (scope === "user") {
        return join(home, ...harness.userPath.slice(2).split("/"));
    }

    return join(projectRoot, ...harness.projectPath.split("/"));
}
