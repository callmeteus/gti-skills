import { describe, expect, it } from "vitest";

import { flagBool, flagNumber, flagString, parseArgv } from "../../src/cli/ParseFlags";

describe("parseArgv", () => {
    it("reads a command, string flags, boolean flags, and rest", () => {
        const parsed = parseArgv(["scene", "add", "--source", "a.mp4", "--open", "--duration=4", "--", "-x"]);

        expect(parsed.command).toBe("scene");
        expect(parsed.rest).toEqual(["add", "-x"]);
        expect(flagString(parsed.flags, "source")).toBe("a.mp4");
        expect(flagNumber(parsed.flags, "duration")).toBe(4);
        expect(flagBool(parsed.flags, "open")).toBe(true);
    });

    it("defaults to help and ignores invalid numbers", () => {
        const parsed = parseArgv(["help", "--volume", "abc"]);

        expect(parsed.command).toBe("help");
        expect(flagNumber(parsed.flags, "volume")).toBeUndefined();
        expect(flagString(parsed.flags, "volume")).toBe("abc");
    });
});
