import { spawn } from "node:child_process";

import { VideoErrors } from "../core/Errors";

/**
 * Inserts a thread limit into an ffmpeg encode command. The limit is opt in
 * through VIDEOEDITOR_FFMPEG_THREADS so normal renders keep all cores, while
 * test suites can keep x264 allocations small on modest machines.
 */
function withThreadLimit(command: string, args: string[]): string[] {
    if (command !== "ffmpeg") {
        return args;
    }
    const raw = process.env.VIDEOEDITOR_FFMPEG_THREADS;
    const limit = raw ? Number(raw) : 0;

    if (!Number.isFinite(limit) || limit <= 0 || !args.includes("-c:v")) {
        return args;
    }

    const limited = [...args];
    limited.splice(Math.max(0, limited.length - 1), 0, "-threads", String(Math.floor(limit)));
    return limited;
}

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
        const child = spawn(command, withThreadLimit(command, args), { windowsHide: true });
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
 * Runs a command and captures raw bytes from stdout, for decoder output.
 *
 * @param command Executable name or absolute path
 * @param args Arguments
 * @returns Exit code and stdout as a Buffer
 */
export function runBuffer(command: string, args: string[]): Promise<{ code: number; stdout: Buffer; stderr: string }> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, withThreadLimit(command, args), { windowsHide: true });
        const chunks: Buffer[] = [];
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
            chunks.push(Buffer.from(chunk));
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.on("error", (error) => {
            reject(VideoErrors.ffmpeg(`Cannot run ${command}: ${error.message}`));
        });
        child.on("close", (code) => {
            resolve({ code: code ?? 1, stdout: Buffer.concat(chunks), stderr });
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
