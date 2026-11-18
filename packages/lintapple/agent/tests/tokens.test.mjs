import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { missingRoles, scan, scanText } from "../scripts/tokens.mjs";

describe("color token scan", () => {
    it("finds raw colors, palette classes, and arbitrary values", () => {
        const { findings } = scanText([
            ".card { color: #f97316; background: rgb(124 58 237); }",
            '<div className="bg-red-500 hover:text-slate-700/80 border-[#123456]">',
            '<p className="text-white">',
        ].join("\n"));
        const values = findings.map((finding) => `${finding.kind}:${finding.value}`);
        assert.deepEqual(values, [
            "raw-color:#f97316",
            "raw-color:rgb(1",
            "palette-class:bg-red-500",
            "palette-class:hover:text-slate-700/80",
            "arbitrary-color:border-[#123456]",
            "raw-color:#123456",
            "palette-class:text-white",
        ]);
    });

    it("allows token definitions, token use, and comments", () => {
        const { findings, tokens } = scanText([
            ":root {",
            "  --primary: #2563eb;",
            "  --danger: oklch(0.6 0.2 25);",
            "  --space-4: 16px;",
            "}",
            ".button { background: var(--primary); color: var(--surface); }",
            "/* old color was #ff0000 */",
            '<div className="bg-primary text-muted-foreground border-border">',
        ].join("\n"));
        assert.deepEqual(findings, []);
        assert.deepEqual(tokens, ["--primary", "--danger"]);
    });

    it("skips allowed files and reports missing semantic roles", () => {
        const root = mkdtempSync(join(tmpdir(), "gti-tokens-"));
        mkdirSync(join(root, "src", "styles"), { recursive: true });
        writeFileSync(join(root, "src", "styles", "theme.css"), ":root { --primary: #2563eb; --text: #111; }\n.x { color: #222; }\n");
        writeFileSync(join(root, "src", "Card.tsx"), 'export const Card = () => <div className="bg-violet-600" />;\n');
        const report = scan(root);
        assert.deepEqual(report.files.map((file) => file.file), ["src/Card.tsx"]);
        assert.deepEqual(report.tokens, ["--primary", "--text"]);
        assert.ok(report.missing.includes("danger"));
        assert.ok(!report.missing.includes("primary"));
    });

    it("matches role names in common token naming styles", () => {
        assert.deepEqual(missingRoles(["--color-primary", "--secondary", "--info", "--warning", "--destructive", "--success", "--muted-foreground", "--background", "--foreground", "--border"]), []);
    });
});
