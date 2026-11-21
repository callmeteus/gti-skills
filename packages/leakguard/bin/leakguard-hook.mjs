#!/usr/bin/env node
import { getAdapter } from "../src/adapters/index.mjs";
import { evaluate } from "../src/engine.mjs";
import { appendEvent, makeContext } from "../src/log.mjs";

/**
 * Reads `--agent id` or `--agent=id` from argv.
 *
 * @param {string[]} argv Arguments after the script name
 * @returns {string} Agent id or empty string
 */
function agentFromArgv(argv) {
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith("--agent=")) {
            return token.slice("--agent=".length);
        }
        if (token === "--agent") {
            return argv[index + 1] ?? "";
        }
    }
    return "";
}

/**
 * Reads all of stdin as UTF-8.
 *
 * @returns {Promise<string>} Raw stdin
 */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

/**
 * Writes an adapter response, or a plain message when no adapter is known.
 *
 * @param {object|null} adapter Adapter
 * @param {{ stdout: string, stderr: string, exitCode: number }} response Response
 */
function writeResponse(adapter, response) {
    if (response.stdout) {
        process.stdout.write(`${response.stdout}\n`);
    }
    if (response.stderr) {
        process.stderr.write(`${response.stderr}\n`);
    }
    process.exitCode = response.exitCode;
}

const agent = agentFromArgv(process.argv.slice(2));
const adapter = getAdapter(agent);

if (!adapter) {
    process.stderr.write(`leakguard: unknown or missing --agent "${agent}". Allowing the call.\n`);
    process.exitCode = 0;
} else {
    let raw = "";

    try {
        raw = await readStdin();
    } catch (error) {
        process.stderr.write(`leakguard: could not read stdin: ${error.message}\n`);
    }

    try {
        const payload = JSON.parse(raw);
        const parsed = adapter.parse(payload);

        if (!parsed) {
            writeResponse(adapter, adapter.format({ decision: "allow", reason: "Leakguard allowed this tool call." }));
        } else {
            const result = evaluate({
                tool: parsed.tool,
                input: parsed.input,
                cwd: parsed.cwd,
                agent
            });
            writeResponse(adapter, adapter.format(result));
        }
    } catch (error) {
        appendEvent({
            time: new Date().toISOString(),
            type: "hook-error",
            agent,
            message: error.message
        }, makeContext({}));
        process.stderr.write(`leakguard: internal error, allowing the call: ${error.message}\n`);
        writeResponse(adapter, adapter.format({ decision: "allow", reason: "Leakguard allowed this tool call." }));
    }
}
