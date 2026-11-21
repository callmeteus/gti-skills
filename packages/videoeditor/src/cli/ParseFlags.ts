/**
 * Tiny flag parser shared with the other gti-skills engines. Values after `--`
 * are kept as one trailing string.
 *
 * @param argv Arguments after the binary name
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

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index] ?? "";

        if (token === "--") {
            rest.push(...args.slice(index + 1));
            break;
        }

        if (token.startsWith("--")) {
            const body = token.slice(2);
            const equals = body.indexOf("=");

            if (equals >= 0) {
                flags[body.slice(0, equals)] = body.slice(equals + 1);
                continue;
            }

            const next = args[index + 1];

            if (next && !next.startsWith("-")) {
                flags[body] = next;
                index += 1;
            } else {
                flags[body] = true;
            }

            continue;
        }

        rest.push(token);
    }

    return { command, flags, rest };
}

/** Reads a string flag. */
export function flagString(flags: Record<string, string | boolean>, name: string): string | undefined {
    const value = flags[name];
    return typeof value === "string" ? value : undefined;
}

/** Reads a number flag, returning undefined for missing or invalid values. */
export function flagNumber(flags: Record<string, string | boolean>, name: string): number | undefined {
    const value = flagString(flags, name);

    if (value === undefined || value.trim() === "") {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/** Reads a boolean flag. */
export function flagBool(flags: Record<string, string | boolean>, name: string): boolean {
    return flags[name] === true || flags[name] === "true";
}
