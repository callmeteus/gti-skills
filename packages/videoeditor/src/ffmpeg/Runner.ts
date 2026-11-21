import { spawn } from "node:child_process";

import { VideoErrors } from "../core/Errors";

/** Result of a spawned command. */
export interface RunResult {
    code: number;
    stdout: string;
    stderr: string;
}

/**
 * Runs a command without a shell and captures its output.
 *
 * @param command Executable name or absolute path
 * @param args Arguments
 * @returns Exit code and captured output
 */
export function run(command: string, args: string[]): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true });
        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            reject(VideoErrors.ffmpeg(`Cannot run ${command}: ${error.message}`));
        });
        child.on("close", (code) => {
            resolve({ code: code ?? 1, stdout, stderr });
        });
    });
}

/**
 * Checks that an external tool is available on PATH.
 *
 * @param name Tool name, for example `ffmpeg`
 */
export async function requireTool(name: "ffmpeg" | "ffprobe"): Promise<void> {
    try {
        const result = await run(name, ["-version"]);

        if (result.code !== 0) {
            throw VideoErrors.ffmpeg(`${name} is installed but returned exit code ${result.code}.`);
        }
    } catch (error) {
        if (error instanceof Error && error.name === "VideoEditorError") {
            throw error;
        }
        throw VideoErrors.ffmpeg(`${name} was not found on PATH. Install ffmpeg and try again.`);
    }
}

/** True when both ffmpeg and ffprobe respond to `-version`. */
export async function toolsAvailable(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
    const check = async (name: "ffmpeg" | "ffprobe"): Promise<boolean> => {
        try {
            const result = await run(name, ["-version"]);
            return result.code === 0;
        } catch {
            return false;
        }
    };

    const [ffmpeg, ffprobe] = await Promise.all([check("ffmpeg"), check("ffprobe")]);
    return { ffmpeg, ffprobe };
}
