/**
 * Tiny flag parser. Values after `--` are kept as a single trailing string.
 *
 * @param argv Process arguments after the binary
 * @returns Command, flags, and rest
 */
export function parseArgv(argv: string[]): {
    command: string;
    flags: Record<string, string | boolean>;
    rest: string[];
} {
    const command = argv[0] ?? "help";
    const flags: Record<string, string | boolean> = {};
    const rest: string[] = [];
    const args = argv.slice(1);

    for (let i = 0; i < args.length; i += 1) {
        const token = args[i] ?? "";

        if (token === "--") {
            rest.push(...args.slice(i + 1));
            break;
        }

        if (token.startsWith("--")) {
            const body = token.slice(2);
            const eq = body.indexOf("=");

            if (eq >= 0) {
                flags[body.slice(0, eq)] = body.slice(eq + 1);
                continue;
            }

            const next = args[i + 1];

            if (next && !next.startsWith("-")) {
                flags[body] = next;
                i += 1;
            } else {
                flags[body] = true;
            }

            continue;
        }

        rest.push(token);
    }

    return {
        command,
        flags,
        rest
    };
}

/**
 * Reads a string flag.
 *
 * @param flags Flag map
 * @param name Flag name
 * @returns Value
 */
export function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
    const value = flags[name];
    return typeof value === "string" ? value : undefined;
}

/**
 * Reads a boolean flag.
 *
 * @param flags Flag map
 * @param name Flag name
 * @returns Whether the flag is set
 */
export function flagBool(flags: Record<string, string | boolean>, name: string): boolean {
    return flags[name] === true || flags[name] === "true";
}
