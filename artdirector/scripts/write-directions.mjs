import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dirs = [
    ["editorial-typographic", "Fraunces", "#14110e", "#f4efe6", "#c23b22", "THE QUIET ISSUE"],
    ["bold-promotional", "Archivo Black", "#f4ef3a", "#101010", "#f4ef3a", "NOW"],
    ["swiss-inspired", "IBM Plex Sans", "#111111", "#f7f7f5", "#d31212", "GRID 01"],
    ["minimalist-geometric", "Syne", "#1b1b1b", "#f6f3ee", "#2f5d50", "ONE SHAPE"],
    ["neo-brutalist", "Space Grotesk", "#111111", "#efe8d8", "#3d5afe", "RAW"],
    ["premium-corporate", "Newsreader", "#ece7dc", "#161412", "#c6a15b", "PRIVATE"],
    ["vintage-print", "Fraunces", "#3a2415", "#e8d7b8", "#9c2b18", "HALFTONE"],
    ["expressive-playful", "Syne", "#1a1033", "#fff4d6", "#ff5a36", "OFF-KILTER"],
    ["technical-infographic", "IBM Plex Sans", "#d7e6ef", "#0b1c28", "#3ec8e0", "SPEC 04"],
    ["data-driven-editorial", "Fraunces", "#12202b", "#f3efe6", "#0e6b5c", "72%"]
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "library", "directions");
mkdirSync(root, { recursive: true });

for (const [id, font, ink, paper, accent, word] of dirs) {
    writeFileSync(join(root, `${id}.html`), `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @import url("https://fonts.bunny.net/css?family=${encodeURIComponent(font.toLowerCase().replace(/ /g, "-"))}:600,700");
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 480px;
            height: 300px;
            background: ${paper};
            color: ${ink};
            position: relative;
            overflow: hidden;
            font-family: "${font}", sans-serif;
        }
        .bar { position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: ${accent}; }
        h1 { margin: 0; position: absolute; left: 36px; bottom: 36px; font-size: 42px; line-height: 0.9; letter-spacing: -0.04em; }
        .k { position: absolute; top: 28px; left: 36px; letter-spacing: 0.28em; font-size: 11px; text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="480" data-height="300">
        <div class="bar"></div>
        <div class="k">${id.replaceAll("-", " ")}</div>
        <h1>${word}</h1>
    </div>
</body>
</html>
`);
}
