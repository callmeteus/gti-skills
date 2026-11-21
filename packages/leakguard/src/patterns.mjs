/**
 * Shared regular expressions for the guard detectors.
 * All patterns are case insensitive unless a pattern depends on case (AWS keys).
 * Nothing here executes commands or reads files.
 */

/** Characters that can end one command and begin another. */
const BOUNDARY = String.raw`(?:^|[\s;|&(\[\`"'=])`;

/** A command can start at the beginning, after a separator, or after a known command wrapper. */
const COMMAND_START = String.raw`(?:^|[\r\n]|[|;&]{1,2}|\$\(|\x60|[({\[]|\b(?:xargs|sudo|doas|then|do|else)\b|\benv(?:\s+[A-Za-z_][A-Za-z0-9_]*=[^\s;|&]+)*)\s*`;

/** Program names that can send data over a network. */
const CLIENT_NAMES = [
    "curl", "wget", "nc", "ncat", "netcat", "socat",
    "http", "httpie", "xh",
    "Invoke-WebRequest", "iwr", "Invoke-RestMethod", "irm",
    "scp", "rsync"
];

/** Script runtimes count as network clients only when a network library appears in the code. */
const RUNTIME_NAMES = ["python", "python3", "node", "deno", "bun"];

function escapeAlternatives(names) {
    return names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

/**
 * Matches a network client only in command position. The `http` token is rejected when it is
 * the scheme of a bare URL.
 */
const NETWORK_CLIENT_AT_COMMAND = new RegExp(
    COMMAND_START + String.raw`(?:` + escapeAlternatives(CLIENT_NAMES) + String.raw`)\b(?!:\/\/)`,
    "i"
);

const RUNTIME_AT_COMMAND = new RegExp(
    COMMAND_START + String.raw`(?:` + escapeAlternatives(RUNTIME_NAMES) + String.raw`)\b`,
    "i"
);

/** A script runtime that may perform network I/O only when a network library is also present. */
export const SCRIPT_RUNTIME = RUNTIME_AT_COMMAND;
export const NETWORK_LIBRARY = /\b(?:requests|urllib|httpx|fetch|axios|node:http|node:https|http\.client|net\.Socket|https?\.request|WebSocket)\b/i;

/**
 * Blanks the contents of quoted strings while preserving their length. Quoted words can then no
 * longer be mistaken for command tokens; the original text is still used for secret detection.
 *
 * @param {string} text Original text
 * @returns {string} Text with quoted contents replaced by spaces
 */
export function blankQuoted(text) {
    let output = "";
    let quote = null;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (quote) {
            if (char === "\\" && index + 1 < text.length) {
                output += "  ";
                index += 1;
            } else if (char === quote) {
                quote = null;
                output += char;
            } else {
                output += char === "\r" || char === "\n" ? char : " ";
            }
        } else if (char === "'" || char === '"') {
            quote = char;
            output += char;
        } else {
            output += char;
        }
    }

    return output;
}

/**
 * Interpreters and exec wrappers whose quoted argument is executed as a command. A quoted string
 * passed to any other program remains data.
 */
const INTERPRETER_QUOTED = [
    new RegExp(
        COMMAND_START + String.raw`(?:sh|bash|zsh|ksh|cmd|powershell|pwsh|python3?|node|ruby|perl)\b[^\r\n"']{0,80}?(?:--eval|-Command|-c|-e|/c)\s+["']([^"']{4,})["']`,
        "i"
    ),
    new RegExp(COMMAND_START + String.raw`(?:eval|Invoke-Expression)\s+["']([^"']{4,})["']`, "i"),
    new RegExp(COMMAND_START + String.raw`ssh\b[^\r\n"']{0,160}?["']([^"']{4,})["']`, "i"),
    new RegExp(COMMAND_START + String.raw`xargs\s+["']([^"']{4,})["']`, "i")
];

/**
 * Returns the quoted arguments that an interpreter or exec wrapper would run as commands.
 *
 * @param {string} text Original command text
 * @returns {string} Newline joined command fragments, empty when no argument is executed
 */
export function executedQuoted(text) {
    const parts = [];
    for (const pattern of INTERPRETER_QUOTED) {
        for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) {
            parts.push(match[1]);
        }
    }
    return parts.join("\n");
}

/**
 * True when the text contains a real network client. Quoted text is data unless the receiving
 * program is an interpreter or exec wrapper that runs its argument. Python and Node one-liners
 * count only when a network library is present.
 *
 * @param {string} text Original text
 * @returns {boolean} Whether a network client is present
 */
export function hasNetworkClient(text) {
    const executed = executedQuoted(text);
    const commandText = `${blankQuoted(text)}\n${executed}`;
    const networkSource = `${text}\n${executed}`;

    return NETWORK_CLIENT_AT_COMMAND.test(commandText) ||
        (RUNTIME_AT_COMMAND.test(commandText) && NETWORK_LIBRARY.test(networkSource));
}

/**
 * A dotenv file name. Excludes the template names .env.example, .env.sample and .env.template.
 * Allows compounds such as .env.local and .env.production.local.
 */
export const DOTENV = /\.env(?:\.(?!example\b|sample\b|template\b)[\w-]+)*(?![.\w])/gi;

/** Credential literals seen in real leaks, each with a stable short name. */
export const CREDENTIALS = [
    { name: "stripe", re: /\bsk_live_[0-9a-zA-Z_]{8,}\b/gi },
    { name: "anthropic", re: /\bsk-ant-[0-9a-zA-Z_]{20,}\b/gi },
    { name: "openai", re: /\bsk-(?:proj-)?[0-9a-zA-Z_]{20,}\b/gi },
    { name: "aws", re: /\bAKIA[0-9A-Z]{16}\b/g },
    { name: "github", re: /\b(?:ghp_|github_pat_|gho_)[0-9a-zA-Z_]{20,}\b/gi },
    { name: "slack", re: /\bxox[abpr]-[0-9a-zA-Z-]{10,}\b/gi },
    { name: "google", re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
    { name: "private-key", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g },
    { name: "url-password", re: /\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^\s@/]+@[^\s/@]+/gi }
];

/** Paths to local secret stores. A leading slash or backslash covers home and absolute paths. */
export const SECRET_PATHS = [
    { name: "ssh-key", re: /[\\/]\.ssh[\\/]id_[\w.-]+/gi },
    { name: "aws-credentials", re: /[\\/]\.aws[\\/]credentials\b/gi },
    { name: "gcloud", re: /[\\/]\.config[\\/]gcloud\b/gi },
    { name: "kube-config", re: /[\\/]\.kube[\\/]config\b/gi },
    { name: "docker-config", re: /[\\/]\.docker[\\/]config\.json\b/gi },
    { name: "netrc", re: /[\\/]\.netrc\b/gi },
    { name: "npmrc", re: /[\\/]\.npmrc\b/gi },
    { name: "pypirc", re: /[\\/]\.pypirc\b/gi },
    { name: "git-credentials", re: /\.git-credentials\b/gi },
    { name: "process-environ", re: /\/proc\/\d+\/environ\b/g }
];

/** Environment dump commands in command position. A bare `set` is a Windows cmd dump; `set -e` and cmdlets are not. */
export const ENV_DUMP = new RegExp(
    BOUNDARY + String.raw`(?:env|printenv|export\s+-p)(?=[\s;|&)\]}\x60]|$)|` +
    BOUNDARY + String.raw`set(?=\s*(?:[;|&)\]}\r\n]|$))|` +
    BOUNDARY + String.raw`(?:Get-ChildItem|gci)\s+env:|\$env:`,
    "i"
);

/** Encoders used to obfuscate exfiltrated data. */
export const ENCODER = /\b(?:base64|xxd|gzip|openssl\s+base64)\b/i;

/** DNS clients that can carry data in a subdomain. They must appear as real command tokens. */
export const DNS_TOOL = new RegExp(
    COMMAND_START + String.raw`(?:nslookup|dig|host|Resolve-DnsName)\b(?![\w.-])`,
    "i"
);

/** Command substitution, either POSIX dollar-parenthesis or backticks. */
export const SUBSHELL = /\$\(|`/;

/** Substitution bodies, kept separate so a caller can require that one reads a secret source. */
export const SUBSHELL_DOLLAR = /\$\(([^)]*)\)/gi;
export const SUBSHELL_BACKTICK = /`([^`]*)`/g;

/**
 * Heuristic for PowerShell syntax. In PowerShell a backtick is an escape character, not a POSIX
 * substitution, and `Host` in `Write-Host` or `$Host` is not the DNS tool `host`.
 *
 * @param {string} text Command text
 * @param {{ tool?: string, agent?: string }} [state] Detector state
 * @returns {boolean} Whether the command reads as PowerShell
 */
export function isPowerShell(text, state = {}) {
    const tool = String(state.tool ?? "").toLowerCase();
    if (/(?:powershell|pwsh|\.ps1)/.test(tool)) {
        return true;
    }
    return /\b(?:Write|Read|Get|Set|New|Remove|Invoke|Out|Select|Where|ForEach)-[A-Z][A-Za-z]*\b|\bResolve-DnsName\b|\$env:|\$Host\b|\s-Command\b/i.test(text);
}

/** Fetch a remote resource and execute it directly. */
export const REMOTE_SCRIPT = new RegExp(
    String.raw`\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(?:sh|bash|zsh|ksh|python3?|iex|pwsh)\b` +
    String.raw`|\biex\s*\(\s*New-Object\s+Net\.WebClient\b[^\n]*DownloadString`,
    "i"
);

/** Reading the environment of another process. */
export const PROC_ENV = /\/proc\/\d+\/environ\b/g;
export const PS_EWW = /\bps\s+eww\b/gi;

/**
 * Returns every distinct match of a global regular expression as raw strings.
 *
 * @param {RegExp} re A regular expression created with the g flag
 * @param {string} text Text to search
 * @returns {string[]} Matched substrings
 */
export function collectMatches(re, text) {
    const source = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    return [...text.matchAll(source)].map((match) => match[0]);
}

/**
 * Extracts hosts from URLs and bare IPv4 addresses. Used by the allowHosts policy.
 *
 * @param {string} text Text to search
 * @returns {string[]} Lowercase host names and addresses
 */
export function extractHosts(text) {
    const hosts = new Set();
    for (const match of text.matchAll(/[a-z][a-z0-9+.-]*:\/\/(?:[^\s/@]+@)?([^\s:/?#]+)/gi)) {
        hosts.add(match[1].toLowerCase());
    }
    for (const match of text.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
        hosts.add(match[0]);
    }
    return [...hosts];
}
