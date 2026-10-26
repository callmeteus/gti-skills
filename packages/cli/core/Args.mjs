/**
 * Parses `command --flag value --switch` arguments.
 *
 * @param {string[]} argv Arguments after the script name
 * @returns {{ command: string, flags: Record<string, string | boolean> }} Parsed arguments
 */
export function parseArgs(argv) {
    const flags = {};
    let command = "";

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token.startsWith("--")) {
            command = command || token;
            continue;
        }

        const key = token.slice(2);
        const next = argv[index + 1];

        if (next === undefined || next.startsWith("--")) {
            flags[key] = true;
        } else {
            flags[key] = next;
            index += 1;
        }
    }

    return { command, flags };
}
