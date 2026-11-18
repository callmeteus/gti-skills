import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { Ids } from "./Ids";

/**
 * Where GTI skills keep everything they generate: `~/.gti`, or `GTI_HOME`.
 *
 * Nothing ArtDirector generates is written into the user's repository. Sessions,
 * permanent projects, guidelines, and exports live under `~/.gti/artdirector`.
 */
export namespace GtiHome {
    /**
     * @returns Absolute GTI home (`GTI_HOME` or `~/.gti`)
     */
    export function root(): string {
        const override = process.env.GTI_HOME?.trim();
        return override ? resolve(override) : join(homedir(), ".gti");
    }

    /**
     * @returns Absolute ArtDirector folder inside the GTI home
     */
    export function artdirector(): string {
        return join(root(), "artdirector");
    }

    /**
     * Stable folder name for a workspace: its name plus a short hash of its path.
     *
     * @param workspace Workspace folder
     * @returns Key such as `my-site-1a2b3c4d5e`
     */
    export function workspaceKey(workspace: string): string {
        const absolute = resolve(workspace);
        const digest = createHash("sha256").update(process.platform === "win32" ? absolute.toLowerCase() : absolute).digest("hex").slice(0, 10);
        return `${Ids.slug(basename(absolute)).slice(0, 40) || "workspace"}-${digest}`;
    }

    /**
     * @param workspace Workspace folder
     * @returns Absolute root of the permanent project for that workspace
     */
    export function projectRoot(workspace: string): string {
        return join(artdirector(), "projects", workspaceKey(workspace));
    }
}
