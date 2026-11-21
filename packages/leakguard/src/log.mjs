import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Builds the environment context used by config, logging and the installer. `LEAKGUARD_HOME_OVERRIDE`
 * replaces the user home for agent config roots, `GTI_HOME` replaces `~/.gti` for runtime state.
 * Both overrides exist so tests never touch a real home directory.
 *
 * @param {{ cwd?: string, home?: string, stateDir?: string, env?: NodeJS.ProcessEnv }} [options] Overrides
 * @returns {{ cwd: string, home: string, stateDir: string, env: NodeJS.ProcessEnv }} Context
 */
export function makeContext(options = {}) {
    const env = options.env ?? process.env;
    const home = options.home ?? env.LEAKGUARD_HOME_OVERRIDE ?? homedir();
    const cwd = options.cwd ?? process.cwd();
    const stateDir = options.stateDir ?? (
        env.GTI_HOME
            ? join(env.GTI_HOME, "leak-guard")
            : join(home, ".gti", "leak-guard")
    );

    return { cwd, home, stateDir, env };
}

/**
 * Path of the newline delimited JSON decision log.
 *
 * @param {{ stateDir: string }} ctx Context
 * @returns {string} Absolute path
 */
export function eventsPath(ctx) {
    return join(ctx.stateDir, "events.jsonl");
}

/**
 * Paths of the two optional config files. Project config overrides user config.
 *
 * @param {{ cwd: string, stateDir: string }} ctx Context
 * @returns {{ user: string, project: string }} Absolute paths
 */
export function configPaths(ctx) {
    return {
        user: join(ctx.stateDir, "config.json"),
        project: join(resolve(ctx.cwd), ".leakguard.json")
    };
}

/**
 * Appends one JSON object as a single line. Logging is best effort and never throws into a hook.
 *
 * @param {Record<string, unknown>} record Event record
 * @param {{ stateDir: string }} ctx Context
 * @returns {boolean} Whether the write succeeded
 */
export function appendEvent(record, ctx) {
    try {
        mkdirSync(ctx.stateDir, { recursive: true });
        appendFileSync(eventsPath(ctx), `${JSON.stringify(record)}\n`, "utf8");
        return true;
    } catch (error) {
        process.stderr.write(`leakguard: event log write failed: ${error.message}\n`);
        return false;
    }
}

/**
 * Reads the decision log, skipping malformed lines.
 *
 * @param {{ stateDir: string }} ctx Context
 * @returns {Record<string, unknown>[]} Parsed events
 */
export function readEvents(ctx) {
    try {
        return readFileSync(eventsPath(ctx), "utf8")
            .split("\n")
            .filter(Boolean)
            .flatMap((line) => {
                try {
                    return [JSON.parse(line)];
                } catch {
                    return [];
                }
            });
    } catch {
        return [];
    }
}
