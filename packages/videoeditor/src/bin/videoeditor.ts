#!/usr/bin/env node

import { runCli } from "../cli";
import { VideoEditorError } from "../core";

runCli(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof VideoEditorError) {
        console.error(JSON.stringify({
            ok: false,
            error: error.code,
            summary: error.message
        }, null, 2));
        process.exitCode = 1;
        return;
    }

    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
