import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readInstalls, writeInstalls } from "../core/Installs.mjs";
import { discoverSkills } from "../core/Skills.mjs";

export const description = "move the state folder from ~/.gti-skills to ~/.gti/skills";

/** Files the CLI rewrites on its own, so the copy already in the new folder wins. */
const Regenerable = new Set(["state.json"]);

/**
 * @param {import("../core/Migrations.mjs").MigrationContext} context Migration context
 * @returns {boolean} Whether the old folder exists and the state folder is the default one
 */
export function applies(context) {
    return context.defaultFolder && existsSync(join(context.home, ".gti-skills"));
}

/**
 * Moves one entry, falling back to copy and delete when the rename crosses a drive or is blocked.
 *
 * @param {string} from Source path
 * @param {string} to Destination path
 */
function moveEntry(from, to) {
    try {
        renameSync(from, to);
    } catch {
        cpSync(from, to, { recursive: true });
        rmSync(from, { recursive: true, force: true });
    }
}

/**
 * Moves everything in `~/.gti-skills` into `~/.gti/skills`: install records, update state,
 * downloaded sources, and the managed MCP servers with their logins. When the new folder already
 * holds an entry (for example an `install` ran after the rename), install records are merged with
 * the new folder winning, `state.json` is dropped, and any other clash is left in the old folder
 * and reported. Then the root pointer files that installed skills keep, which hold a path into
 * `sources/`, are rewritten to the new location.
 *
 * @param {import("../core/Migrations.mjs").MigrationContext} context Migration context
 */
export function run(context) {
    const legacy = join(context.home, ".gti-skills");
    const target = context.folder;
    const clashes = [];

    mkdirSync(target, { recursive: true });

    for (const entry of readdirSync(legacy)) {
        const from = join(legacy, entry);
        const to = join(target, entry);

        if (!existsSync(to)) {
            moveEntry(from, to);
        } else if (entry === "installs.json") {
            // Já existe um installs.json na pasta nova (um install rodou depois da troca): junta os dois, a pasta nova vence
            const kept = new Map(readInstalls(target).map((record) => [record.destination, record]));

            for (const record of readInstalls(legacy)) {
                if (!kept.has(record.destination)) {
                    kept.set(record.destination, record);
                }
            }

            writeInstalls(target, [...kept.values()]);
            rmSync(from);
        } else if (Regenerable.has(entry)) {
            // O CLI recria esse arquivo sozinho, então a cópia antiga pode ser descartada
            rmSync(from);
        } else {
            // Qualquer outro conflito fica na pasta antiga para ninguém perder dados por engano
            clashes.push(entry);
        }
    }

    if (clashes.length === 0) {
        rmdirSync(legacy);
    } else {
        context.out(`migrate  left ${clashes.join(", ")} in ${legacy} because ${target} already has them`);
    }

    // Skills que dirigem um pacote guardam o caminho dele em um arquivo; aqui o prefixo antigo vira o novo
    const pointers = new Map(discoverSkills().filter((skill) => skill.rootPointer).map((skill) => [skill.id, skill.rootPointer]));
    let rewritten = 0;

    for (const record of readInstalls(target)) {
        const pointer = pointers.get(record.skill);
        const file = pointer ? join(record.destination, pointer) : null;

        if (!file || !existsSync(file)) {
            continue;
        }

        const content = readFileSync(file, "utf8");

        if (content.startsWith(legacy)) {
            writeFileSync(file, `${target}${content.slice(legacy.length)}`);
            rewritten += 1;
        }
    }

    context.out(`migrate  moved ${legacy} to ${target}${rewritten > 0 ? `, repointed ${rewritten} skill(s)` : ""}`);
}
