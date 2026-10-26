import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

for (const dir of ["studio", "library"]) {
    const from = join(root, dir);

    if (existsSync(from)) {
        cpSync(from, join(dist, dir), { recursive: true });
    }
}
