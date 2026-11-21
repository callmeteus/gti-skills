/**
 * Typed errors with stable codes for CLI output.
 */
export class VideoEditorError extends Error {
    constructor(
        public readonly code: string,
        message: string
    ) {
        super(message);
        this.name = "VideoEditorError";
    }
}

/**
 * Factories for the error codes the CLI reports in `--json` mode.
 */
export const VideoErrors = {
    project(message: string): VideoEditorError {
        return new VideoEditorError("PROJECT", message);
    },
    spec(message: string): VideoEditorError {
        return new VideoEditorError("SPEC", message);
    },
    path(message: string): VideoEditorError {
        return new VideoEditorError("PATH", message);
    },
    input(message: string): VideoEditorError {
        return new VideoEditorError("INPUT", message);
    },
    ffmpeg(message: string): VideoEditorError {
        return new VideoEditorError("FFMPEG", message);
    },
    render(message: string): VideoEditorError {
        return new VideoEditorError("RENDER", message);
    },
    server(message: string): VideoEditorError {
        return new VideoEditorError("SERVER", message);
    }
};
