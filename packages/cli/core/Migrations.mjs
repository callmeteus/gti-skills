import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readJson, writeJson } from "./Installs.mjs";

const MigrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/**
 * @typedef {object} MigrationContext
 * @property {string} folder State folder the CLI uses now
 * @property {string} home Operating system home directory
 * @property {boolean} defaultFolder Whether the state folder is the default one, not an override
 * @property {(line: string) => void} out Output channel
 */

/**
 * @typedef {object} Migration
 * @property {string} id File name without extension; files run in name order
 * @property {string} description One line shown when the migration is pending or runs
 * @property {(context: MigrationContext) => boolean} [applies] Whether the migration concerns this machine; omitted means always
 * @property {(context: MigrationContext) => void} run Performs the migration; throws on failure
 */

/**
 * Loads every migration file by convention, in name order. A new migration is a new file in
 * `packages/cli/migrations/`; nothing else registers it.
 *
 * @param {string} [folder] Migrations folder, overridden by tests
 * @returns {Promise<Migration[]>} Migrations sorted by id
 */
export async function loadMigrations(folder = MigrationsFolder) {
    const files = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".mjs")).sort() : [];
    const migrations = [];

    for (const file of files) {
        const module = await import(pathToFileURL(join(folder, file)).href);
        migrations.push({ id: file.slice(0, -".mjs".length), description: module.description, applies: module.applies, run: module.run });
    }

    return migrations;
}

/**
 * Lists the migrations that have not run on this state folder and that apply to this machine.
 *
 * @param {MigrationContext} context Migration context
 * @param {Migration[]} migrations Loaded migrations
 * @returns {Migration[]} Pending migrations, in order
 */
export function pendingMigrations(context, migrations) {
    const applied = new Set((readJson(join(context.folder, "migrations.json"), { applied: [] }).applied ?? []).map((entry) => entry.id));

    return migrations.filter((migration) => !applied.has(migration.id) && (migration.applies?.(context) ?? true));
}

/**
 * Runs the pending migrations in order and records each one that succeeds in `migrations.json`
 * inside the state folder. Stops at the first failure so later migrations never run on a
 * half-migrated state; the failed one runs again on the next update.
 *
 * @param {MigrationContext} context Migration context
 * @param {Migration[]} migrations Loaded migrations
 * @returns {string[]} Ids of the migrations that ran
 */
export function runMigrations(context, migrations) {
    const ran = [];

    for (const migration of pendingMigrations(context, migrations)) {
        context.out(`migrate  ${migration.id}: ${migration.description}`);
        migration.run(context);

        // Só registra depois de rodar sem erro; se falhar, roda de novo no próximo update
        const file = join(context.folder, "migrations.json");
        const applied = readJson(file, { applied: [] }).applied ?? [];
        writeJson(file, { applied: [...applied, { id: migration.id, appliedAt: new Date().toISOString() }] });
        ran.push(migration.id);
    }

    return ran;
}
