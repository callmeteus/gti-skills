import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { Ids } from "./Ids";

/**
 * Where Video Editor keeps everything it generates: `~/.gti/video-editor`,
 * or `<GTI_HOME>/video-editor`. Nothing is written into the user's repository.
 */
export const GtiHome = {
    root(): string {
        const override = process.env.GTI_HOME?.trim();
        return override ? resolve(override) : join(homedir(), ".gti");
    },

    rootForSkill(): string {
        return join(GtiHome.root(), "video-editor");
    },

    sessionsDir(): string {
        return join(GtiHome.rootForSkill(), "sessions");
    },

    projectsDir(): string {
        return join(GtiHome.rootForSkill(), "projects");
    },

    /** Stable folder name for a workspace: its folder name plus a hash of its path. */
    workspaceKey(workspace: string): string {
        const absolute = resolve(workspace);
        const digest = createHash("sha256")
            .update(process.platform === "win32" ? absolute.toLowerCase() : absolute)
            .digest("hex")
            .slice(0, 10);
        return `${Ids.slug(basename(absolute)).slice(0, 40) || "workspace"}-${digest}`;
    }
};
