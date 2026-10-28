import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * @typedef {object} InstallRecord
 * @property {string} destination Absolute installed skill folder, the record key
 * @property {string} skill Skill id
 * @property {string[]} harnesses Agent ids that read this folder
 * @property {"project" | "user"} scope Install scope
 * @property {string} projectRoot Project root used for the project scope
 * @property {string | null} commit Commit the files came from, or null when unknown
 * @property {string} installedAt ISO timestamp
 */

/**
 * Resolves the folder that holds the install records, the update state, and downloaded sources.
 *
 * @param {{ home?: string, stateDir?: string }} [environment] Overrides used by tests
 * @returns {string} Absolute state folder
 */
export function stateFolder(environment = {}) {
    return environment.stateDir ?? process.env.GTI_SKILLS_HOME ?? join(environment.home ?? homedir(), ".gti-skills");
}

/**
 * Reads a JSON file, returning a fallback when it is missing or unreadable.
 *
 * @param {string} file JSON file
 * @param {any} fallback Value returned on failure
 * @returns {any} Parsed content
 */
export function readJson(file, fallback) {
    try {
        return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Writes a JSON file, creating its folder.
 *
 * @param {string} file JSON file
 * @param {any} value Value to write
 */
export function writeJson(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 4)}\n`);
}

/**
 * Reads the install records.
 *
 * @param {string} folder State folder
 * @returns {InstallRecord[]} Records sorted by destination
 */
export function readInstalls(folder) {
    const data = readJson(join(folder, "installs.json"), { installs: [] });

    return Array.isArray(data.installs) ? data.installs : [];
}

/**
 * Replaces the install records.
 *
 * @param {string} folder State folder
 * @param {InstallRecord[]} installs Records to keep
 */
export function writeInstalls(folder, installs) {
    const sorted = [...installs].sort((left, right) => left.destination < right.destination ? -1 : 1);
    writeJson(join(folder, "installs.json"), { installs: sorted });
}

/**
 * Adds or replaces install records, keyed by destination. Agents that share a folder are merged.
 *
 * @param {string} folder State folder
 * @param {InstallRecord[]} records New records
 */
export function recordInstalls(folder, records) {
    const byDestination = new Map(readInstalls(folder).map((record) => [record.destination, record]));

    for (const record of records) {
        const previous = byDestination.get(record.destination);
        const harnesses = new Set([...(previous?.harnesses ?? []), ...record.harnesses]);
        byDestination.set(record.destination, { ...record, harnesses: [...harnesses].sort() });
    }

    writeInstalls(folder, [...byDestination.values()]);
}
