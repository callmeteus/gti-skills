/**
 * Shared regular expressions for the guard detectors.
 * All patterns are case insensitive unless a pattern depends on case (AWS keys).
 * Nothing here executes commands or reads files.
 */

/** Characters that can end one command and begin another. */
const BOUNDARY = String.raw`(?:^|[\s;|&(\[\`"'=])`;

/** Program names that can send data over a network. */
const CLIENT_NAMES = [
    "curl", "wget", "nc", "ncat", "netcat", "socat",
    "http", "httpie", "xh",
    "Invoke-WebRequest", "iwr", "Invoke-RestMethod", "irm",
    "scp", "rsync",
    "python", "python3", "node", "deno", "bun"
];

const escapedClients = CLIENT_NAMES.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

/**
 * Matches a network client in command position. The `http` token is rejected when it is
 * the scheme of a bare URL (http://...) so ordinary links do not count as a client.
 */
export const NETWORK_CLIENT = new RegExp(
    BOUNDARY + String.raw`(?:(?:sudo|doas)\s+)?(?:\b(?:` + escapedClients + String.raw`)\b)(?!:\/\/)`,
    "i"
);

/** A script runtime that may perform network I/O only when a network library is also present. */
export const SCRIPT_RUNTIME = /\b(?:python3?|node|deno|bun)\b/i;
export const NETWORK_LIBRARY = /\b(?:requests|urllib|httpx|fetch|axios|node:http|node:https|http\.client|net\.Socket|https?\.request|WebSocket)\b/i;

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

/** Environment dump commands in command position. */
export const ENV_DUMP = new RegExp(
    BOUNDARY + String.raw`(?:env|printenv|set|export\s+-p)(?=[\s;|&)\]}\x60]|$)|` +
    BOUNDARY + String.raw`(?:Get-ChildItem|gci)\s+env:|\$env:`,
    "i"
);

/** Encoders used to obfuscate exfiltrated data. */
export const ENCODER = /\b(?:base64|xxd|gzip|openssl\s+base64)\b/i;

/** DNS clients that can carry data in a subdomain. */
export const DNS_TOOL = /\b(?:nslookup|dig|host)\b/i;

/** Command substitution, either POSIX dollar-parenthesis or backticks. */
export const SUBSHELL = /\$\(|`/;

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
