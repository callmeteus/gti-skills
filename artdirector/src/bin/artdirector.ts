#!/usr/bin/env node

import { ArtDirectorError } from "../core";
import { runCli } from "../cli";

const argv = process.argv.slice(2);

runCli(argv).catch((err: unknown) => {
    if (err instanceof ArtDirectorError) {
        console.error(JSON.stringify({
            ok: false,
            error: err.code,
            summary: err.message
        }, null, 2));
        process.exitCode = 1;
        return;
    }

    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
});
