/**
 * Typed errors with stable codes for CLI and HTTP responses.
 */
export class ArtDirectorError extends Error {
    /**
     * Creates a typed ArtDirector error.
     *
     * @param code Stable machine-readable code
     * @param message Human-readable explanation
     * @param status HTTP status to use when the server maps this error
     */
    constructor(
        public readonly code: string,
        message: string,
        public readonly status = 400
    ) {
        super(message);
        this.name = "ArtDirectorError";
    }
}

/**
 * Helpers for constructing common errors.
 */
export namespace ArtErrors {
    /**
     * Project files are missing or invalid.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function project(message: string): ArtDirectorError {
        return new ArtDirectorError("PROJECT", message, 400);
    }

    /**
     * Requested path is outside the project root.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function path(message: string): ArtDirectorError {
        return new ArtDirectorError("PATH", message, 403);
    }

    /**
     * Authentication failed on the local server.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function auth(message: string): ArtDirectorError {
        return new ArtDirectorError("AUTH", message, 401);
    }

    /**
     * Requested resource does not exist.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function notFound(message: string): ArtDirectorError {
        return new ArtDirectorError("NOT_FOUND", message, 404);
    }

    /**
     * Renderer or audit could not complete.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function render(message: string): ArtDirectorError {
        return new ArtDirectorError("RENDER", message, 500);
    }

    /**
     * The local studio server could not bind or start.
     *
     * @param message Explanation
     * @returns Typed error
     */
    export function server(message: string): ArtDirectorError {
        return new ArtDirectorError("SERVER", message, 500);
    }
}
