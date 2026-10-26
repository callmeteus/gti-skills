import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

for (const dir of ["studio", "library", "skill"]) {
    const from = join(root, dir);

    if (existsSync(from)) {
        cpSync(from, join(dist, dir), { recursive: true });
    }
}

const skill = join(root, "skill", "artdirector");
const copies = [
    join(root, "templates", "opencode", ".opencode", "skills", "artdirector"),
    join(root, "templates", "cursor", ".cursor", "skills", "artdirector"),
    join(root, "templates", "claude", ".claude", "skills", "artdirector"),
    join(root, "templates", "agents", ".agents", "skills", "artdirector")
];

for (const dest of copies) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(skill, dest, { recursive: true });
}
