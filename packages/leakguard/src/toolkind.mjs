/**
 * Tool kind classification shared by the live guard and the history scanner.
 *
 * A tool call is not a shell command just because its input mentions a network client. Writing a
 * document that describes an exfiltration command is safe, while running that command is not. This
 * module decides which detectors a call is eligible for before any detector runs.
 */

/** Tool names that run a shell command. Compared case insensitively. */
const SHELL_TOOLS = new Set([
    // Claude
    "bash", "powershell",
    // Codex
    "shell", "exec_command", "local_shell",
    // Cursor
    "run_terminal_cmd",
    // Kiro
    "execute_bash",
    // Antigravity
    "run_command",
    // Cline
    "execute_command",
    // Copilot, OpenCode and Kilo use bash or shell, already listed above
    "terminal", "terminal_command"
]);

/** Tool names that create or modify a file. */
const WRITE_TOOLS = new Set([
    "write", "edit", "multiedit", "notebookedit",
    "write_file", "create_file", "str_replace", "str_replace_editor",
    "edit_file", "apply_patch", "write_to_file", "replace_in_file", "fs_write"
]);

/** Tool names that retrieve a remote resource. */
const FETCH_TOOLS = new Set([
    "webfetch", "web_fetch", "fetch", "read_url",
    // Browser navigation tools
    "navigate", "browser_navigate", "browser_navigate_to", "navigate_to",
    "page_navigate", "browser_goto", "goto", "browse", "open_url"
]);

/** Tool names that read local content. */
const READ_TOOLS = new Set([
    "read", "read_file", "view", "grep", "glob", "list_dir", "list_directory", "read_many_files"
]);

/** Input fields that name the target file of a write. */
const PATH_FIELDS = new Set([
    "file_path", "filePath", "path", "filename", "fileName", "file",
    "target", "notebook_path", "notebookPath", "file_name"
]);

/** A URL argument, used to decide whether an unlisted MCP tool carries a destination. */
const URL_ARGUMENT = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * True for a plain object, as opposed to an array or a primitive.
 *
 * @param {unknown} value Candidate value
 * @returns {boolean} Whether it is a record
 */
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Collects every string value inside a tool input, including nested arrays and objects. Keys that
 * start with an underscore are metadata and are skipped, matching extractText.
 *
 * @param {unknown} value Tool input or part of it
 * @param {string[]} out Accumulator
 * @param {number} depth Current depth
 * @returns {string[]} Collected strings
 */
function collectStrings(value, out = [], depth = 0) {
    if (depth > 6) {
        return out;
    }
    if (typeof value === "string") {
        out.push(value);
        return out;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectStrings(item, out, depth + 1);
        }
        return out;
    }
    if (isRecord(value)) {
        for (const [key, item] of Object.entries(value)) {
            if (!key.startsWith("_")) {
                collectStrings(item, out, depth + 1);
            }
        }
    }
    return out;
}

/**
 * Classifies a tool call into the detector group it belongs to.
 *
 * @param {string} tool Tool name
 * @param {unknown} input Tool input
 * @returns {{ kind: "shell"|"write"|"fetch"|"read"|"other" }} Tool kind
 */
export function classifyTool(tool, input) {
    const name = String(tool ?? "").toLowerCase();

    if (SHELL_TOOLS.has(name)) {
        return { kind: "shell" };
    }
    if (WRITE_TOOLS.has(name)) {
        return { kind: "write" };
    }
    if (FETCH_TOOLS.has(name)) {
        return { kind: "fetch" };
    }
    if (READ_TOOLS.has(name)) {
        return { kind: "read" };
    }

    if (isRecord(input)) {
        if (typeof input.command === "string" || typeof input.cmd === "string") {
            return { kind: "shell" };
        }
        if (typeof input.url === "string" || typeof input.URL === "string") {
            return { kind: "fetch" };
        }
        if (hasUrlArgument(input)) {
            return { kind: "other" };
        }
    }

    return { kind: "other" };
}

/**
 * The target file path of a write call, or an empty string.
 *
 * @param {unknown} input Tool input
 * @returns {string} Target path
 */
export function targetPath(input) {
    if (!isRecord(input)) {
        return "";
    }
    for (const field of PATH_FIELDS) {
        if (typeof input[field] === "string") {
            return input[field];
        }
    }
    return "";
}

/**
 * The text a write call would put into a file. Path fields are excluded so a documentation path
 * is not mistaken for file content, while nested edit arrays are included.
 *
 * @param {unknown} input Tool input
 * @returns {string} Joined content
 */
export function writeContent(input) {
    if (!isRecord(input)) {
        return "";
    }
    const parts = [];
    for (const [key, value] of Object.entries(input)) {
        if (key.startsWith("_") || PATH_FIELDS.has(key)) {
            continue;
        }
        parts.push(...collectStrings(value));
    }
    return parts.join("\n");
}

/**
 * All string arguments of a tool input, used for fetch and unlisted MCP tools.
 *
 * @param {unknown} input Tool input
 * @returns {string} Joined string arguments
 */
export function stringArgs(input) {
    return collectStrings(input).join("\n");
}

/**
 * True when at least one string argument is a URL.
 *
 * @param {unknown} input Tool input
 * @returns {boolean} Whether a URL argument is present
 */
export function hasUrlArgument(input) {
    return collectStrings(input).some((value) => URL_ARGUMENT.test(value.trim()));
}
