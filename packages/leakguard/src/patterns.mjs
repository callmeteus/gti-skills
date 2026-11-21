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
    COMMAND_START + String.raw`(?<![\w.-])(?:` + escapeAlternatives(CLIENT_NAMES) + String.raw`)\b(?!:\/\/)`,
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
// A word boundary before the dot keeps process.env.CT and my.env from reading as dotenv files.
export const DOTENV = /(?<!\w)\.env(?:\.(?!example\b|sample\b|template\b)[\w-]+)*(?![.\w])/gi;

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
    {
        name: "url-password",
        re: new RegExp(
            String.raw`\b[a-z][a-z0-9+.-]*:\/\/[^\s\/@"'<>{}[\])]+:[^\s\/@"'<>{}[\])]+@[^\s\/?#"'` +
            "\\x60" + String.raw`\\<>{}[\])]+`,
            "gi"
        )
    }
];

/** A dotenv file whose contents are actually uploaded, as opposed to one key being read. */
export const DOTENV_UPLOAD = new RegExp([
    String.raw`@\.env(?:\.[\w-]+)?\b`,
    String.raw`<\s*\.env\b`,
    String.raw`(?:cat|type|Get-Content|gc)\s+[^\n|&;]*\.env\b[^\n|&;]*[;&|]+\s*(?:xargs\s+)?(?:curl|wget|iwr|Invoke-WebRequest|Invoke-RestMethod|nc|ncat|socat|scp|rsync)\b`,
    String.raw`-T\s+[^\n]*\.env\b`,
    String.raw`--upload-file[^\n]*\.env\b`,
    String.raw`-F\s+[^\n]*=\s*@?\.env\b`,
    String.raw`-InFile\s+[^\n]*\.env\b`,
    String.raw`-Body\s*\(\s*(?:Get-Content|cat)[^\n]*\.env\b`
].join("|"), "i");

/** A single credential key read from a dotenv file for use as auth, not the whole file. */
export const DOTENV_KEY_USE = new RegExp([
    String.raw`grep\s+['"]?\^?[A-Z0-9_]*(?:TOKEN|PASSWORD|SECRET|KEY|PASS)[A-Z0-9_]*=?['"]?\s+[^\n]*\.env`,
    String.raw`(?:Get-Content|gc)\s+[^\n|]*\.env\b[^\n|]*\|\s*Where-Object[^\n|]*-match`,
    String.raw`(?:set\s+-a\s*[;]\s*)?\.\s+\.?\.?\.env\b` + String.raw`[^\n]*[;]\s*set\s+\+a`
].join("|"), "i");

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

/**
 * Environment dump commands in command position. A `$env:NAME` reference is a single variable and
 * is not a dump. Only a directory listing of `env:` with no name, a bare POSIX `env`, `printenv`,
 * `export -p`, a bare cmd `set`, or the .NET environment table count as a dump.
 */
export const ENV_DUMP = new RegExp(
    BOUNDARY + String.raw`(?:(?:env|printenv|export\s+-p)(?!(?:\s*[=.]))(?=[\s;|&)\]}\x60]|$))|` +
    BOUNDARY + String.raw`set(?=\s*(?:[;|&)}\r\n]|$))|` +
    BOUNDARY + String.raw`(?:(?:Get-ChildItem|gci|dir|ls)\s+env:\s*(?:$|[;|&)}\x60]))|` +
    String.raw`\[Environment\]::GetEnvironmentVariables\s*\(`,
    "i"
);

/** Encoders used to obfuscate exfiltrated data. */
export const ENCODER = /\b(?:base64|xxd|gzip|openssl\s+base64)\b/i;

/** DNS clients that can carry data in a subdomain. They must appear as real command tokens. */
export const DNS_TOOL = new RegExp(
    COMMAND_START + String.raw`(?:nslookup|dig|host|Resolve-DnsName)\b(?![\w.=-]|\s*=)`,
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
    String.raw`\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(?:sh|bash|zsh|ksh|python3?|iex|pwsh)\b(?![^\n]{0,40}\s(?:-c|-e|--eval)\b)` +
    String.raw`|\biex\s*\(\s*New-Object\s+Net\.WebClient\b[^\n]*DownloadString`,
    "i"
);

/** Reading the environment of another process. */
export const PROC_ENV = /\/proc\/\d+\/environ\b/g;
export const PS_EWW = /\bps\s+eww\b/gi;

/**
 * True for a destination that belongs to the local machine, a private network, Tailscale or an
 * internal service name. A credential used with one of these is not an outbound exfiltration.
 *
 * @param {string} host Host with port or brackets removed
 * @returns {boolean} Whether the destination is internal
 */
export function isInternalHost(host) {
    const value = String(host ?? "").toLowerCase().replace(/^\[|\]$/g, "");
    if (value === "" || value === "localhost" || value === "::1") {
        return true;
    }
    if (/^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value)) {
        return true;
    }
    if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(value)) {
        return true;
    }
    // Tailscale CGNAT range.
    if (/^100\.(?:6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(value)) {
        return true;
    }
    if (/^169\.254\./.test(value) || /^fe80[:%]/.test(value)) {
        return true;
    }
    if (/\.(?:ts\.net|local|internal)$/.test(value)) {
        return true;
    }
    return /^[a-z0-9-]+$/.test(value);
}

/**
 * True when a destination host is named anywhere in a command even without a URL scheme. Covers
 * Tailscale names, single label service names and private IPv4 addresses in ssh and scp commands.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether an internal destination is named
 */
export function hasInternalDestination(text) {
    const source = String(text ?? "");
    const ipv4 = source.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
    if (ipv4.some(isInternalHost)) {
        return true;
    }
    return /(?:^|[^\w.-])(?:[\w-]+\.)?(?:ts\.net|local|internal)\b/i.test(source) ||
        /(?:@|host\s+)(?:[a-z0-9-]+)(?:\s|$)/i.test(source);
}

/**
 * True when a command reads a dotenv file into its environment instead of uploading it. Sourcing
 * a file so a variable can be used as a URL is different from sending the file over the network.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the dotenv file is sourced
 */
export function isSourcedDotenv(text) {
    return /(?:^|[;&|]\s*)(?:\.\s+|source\s+)(?:[^\s]*\/)?\.env\b/i.test(String(text ?? "")) ||
        /set\s+-a[^\n]*[;&][^\n]*\.env\b[^\n]*[;&][^\n]*set\s+\+a/i.test(String(text ?? ""));
}

/**
 * True when a command uploads a dotenv file itself rather than using one of its variables.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the file contents are the payload
 */
export function isUploadedDotenv(text) {
    const source = String(text ?? "");
    return /@\.env(?:\.[\w-]+)?\b/i.test(source) ||
        /(?:cat|type|Get-Content)\s+[^\n]*\.env\b[^\n]*[|;]/i.test(source) ||
        /--data(?:-binary)?\s+@\.env/i.test(source);
}

/**
 * True when a URL comes from a variable that the same command loads from its dotenv file. The
 * variable suffix marks a destination supplied by the credential store itself.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether a destination is paired with the source file
 */
export function isPairedDestination(text) {
    const source = String(text ?? "");
    // A destination assigned in the same command is attacker controlled. Only a variable loaded
    // from the dotenv file can be trusted as the credential's own service.
    if (/\b[A-Z_][A-Z0-9_]*\s*=\s*['"]?[a-z][a-z0-9+.-]*:\/\//i.test(source) ||
        /\b[A-Z][A-Z0-9_]*(?:_URL|_ADDR|_HOST)\s*=/i.test(source)) {
        return false;
    }
    const variable = /\$(?:\{)?[A-Z][A-Z0-9_]*(?:_URL|_ADDR|_HOST)(?:\})?/i.test(source) ||
        /\$(?:\{)?(?:URL|ADDR|HOST)(?:\})?/i.test(source);
    if (!variable) {
        return false;
    }
    return collectMatches(DOTENV, source).length > 0 ||
        /grep\s+['"]?\^[A-Z0-9_]+=/i.test(source);
}

/**
 * True for a command that only saves a download to a file. Such a command is not a remote script
 * execution; the download must be run by an interpreter in the same command to be one.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the command is a download only
 */
export function isDownloadOnly(text) {
    const source = String(text ?? "");
    const download = /\b(?:curl(?:\.exe)?|wget)\b[^\n]*\s(?:-o|--output|-O)\s+\S+/i.test(source) ||
        /\bInvoke-WebRequest\b[^\n]*-OutFile\b/i.test(source) ||
        /\bStart-BitsTransfer\b/i.test(source) ||
        /urllib\.request\.urlretrieve|urlretrieve\s*\(/i.test(source);
    if (!download) {
        return false;
    }
    return !/\b(?:iex|Invoke-Expression|\|\s*(?:sh|bash|zsh|ksh|python3?|node|ruby|perl)\b|DownloadString\s*\(|\beval\s*\()/i.test(source);
}

/**
 * True when the text is Python, Node, Ruby or Perl code passed with -c or -e, or through a heredoc.
 * Shell words inside such code are data unless the code itself reads a secret and sends it.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether an interpreter code payload is present
 */
export function isInterpreterCode(text) {
    const source = String(text ?? "");
    return /\b(?:python3?|node|ruby|perl)\b[^\n]{0,120}?(?:\s(?:-c|-e|--eval)\s+["']|<<)/i.test(source) ||
        /<<['"]?(?:PY|PYTHON|JS|NODE|RUBY|PERL|EOF)['"]?/i.test(source) ||
        /@['"]\s*\r?\n[\s\S]{0,4000}?\b(?:import|fetch\s*\(|urllib|requests|process\.env|readFileSync)\b/i.test(source);
}

/**
 * True when interpreter code itself reads a secret source and sends it through a network API.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the code both reads a secret and sends it
 */
export function codeReadsAndSends(text) {
    const source = String(text ?? "");
    const reads = /\b(?:open\s*\(\s*['"][^'"]*(?:\.env|\.ssh|\.aws|credential|token|secret)|readFileSync\s*\(|process\.env|os\.environ|Get-Content|getenv\s*\()/i.test(source);
    const sends = /\b(?:requests\.(?:post|put)|urllib\.request|httpx\.|fetch\s*\(|http\.request|https\.request|axios\.|net\.Socket|WebSocket)\b/i.test(source);
    return reads && sends;
}

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
        // A URL held as a JSON string value, such as original_url":"https://host/..., is data in a
        // request body and not the destination of that request.
        if (/["']\s*:\s*["']$/.test(text.slice(0, match.index))) {
            continue;
        }
        // A quoted URL such as base="https://host" would otherwise keep the closing quote in the
        // host and make an internal tailscale name look public.
        // Interpreter code builds URLs by concatenation, for example "http://" + host or
        // f"http://{host}". Those punctuation fragments are not destinations.
        const host = match[1].replace(/^["'\x60+({]+/, "").replace(/["'\x60,;)\]}]+$/g, "").toLowerCase();
        if (host) {
            hosts.add(host);
        }
    }
    // A quoted address is usually a data value, for example a DNS record content or a comparison,
    // not a destination. URLs are still read from the original text so quoted URLs stay covered.
    for (const match of blankQuoted(text).matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
        hosts.add(match[0]);
    }
    return [...hosts];
}

/**
 * True for a loopback address. Used only by the history path, where a whole dotenv upload to the
 * local machine is informational rather than remote exfiltration.
 *
 * @param {string} host Host with port or brackets removed
 * @returns {boolean} Whether the host is loopback
 */
export function isLoopbackHost(host) {
    const value = String(host ?? "").toLowerCase().replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
    return value === "::1" || /^127\./.test(value);
}

/**
 * True when the command uploads a whole dotenv file and every destination is loopback. Such a
 * command is the guard's own proof run, not an outbound exfiltration.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the upload only targets loopback
 */
export function isWholeDotenvUploadToLoopback(text) {
    const source = String(text ?? "");
    // collectMatches copies the regex, so a global DOTENV lastIndex cannot affect this check.
    if (!DOTENV_UPLOAD.test(source) || collectMatches(DOTENV, source).length === 0) {
        return false;
    }
    const hosts = extractHosts(source);
    return hosts.length > 0 && hosts.every(isLoopbackHost);
}

/**
 * Registrable domain (the last two labels) of a host, or null for an address or single label. The
 * first label of a tailscale or internal name is already covered by isInternalHost.
 *
 * @param {string} host Host with port or brackets removed
 * @returns {string|null} Lowercase registrable domain
 */
export function registrableDomain(host) {
    const value = String(host ?? "").toLowerCase().replace(/^\[|\]$/g, "").replace(/:\d+$/, "");
    if (!value || value.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(value)) {
        return null;
    }
    const labels = value.split(".").filter(Boolean);
    return labels.length < 2 ? null : labels.slice(-2).join(".");
}

/** Generic fragments that never identify a service when they are the only name token. */
const GENERIC_NAME_TOKENS = new Set([
    "API", "TOKEN", "KEY", "SECRET", "PASSWORD", "PASS", "URL", "HOST", "ADDR",
    "APP", "SERVER", "CLIENT", "ID", "USER", "USERNAME", "AUTH", "ACCESS", "VALUE"
]);

/** Short variable prefixes that stand for a longer issuer name. */
const NAME_ALIASES = { GH: "GITHUB", CF: "CLOUDFLARE" };

/**
 * Uppercase credential variable names referenced by a command. Covers dotenv grep assignments,
 * PowerShell key filters, process and OS environment reads, dollar references and plain assignments.
 *
 * @param {string} text Command text
 * @returns {string[]} Distinct uppercase names
 */
export function credentialVariableNames(text) {
    const source = String(text ?? "");
    const names = new Set();
    const add = (name) => {
        if (name && /^[A-Z][A-Z0-9_]*$/.test(name)) {
            names.add(name);
        }
    };

    for (const match of source.matchAll(/grep\s+['"]?\^?([A-Z][A-Z0-9_]*)\s*=/gi)) {
        add(match[1]);
    }
    for (const match of source.matchAll(/['"]\^?([A-Z][A-Z0-9_]*)=(?:\(\.\*\))?['"]?/gi)) {
        add(match[1]);
    }
    for (const match of source.matchAll(/(?:process\.env|os\.environ|os\.getenv|env\.get|environment\.get)\s*[\[.(]?['"]?([A-Z][A-Z0-9_]+)/gi)) {
        add(match[1]);
    }
    for (const match of source.matchAll(/\$env:([A-Z][A-Z0-9_]+)/gi)) {
        add(match[1]);
    }
    for (const match of source.matchAll(/\$?\b([A-Z][A-Z0-9_]{1,})\b/g)) {
        add(match[1]);
    }
    return [...names];
}

/**
 * True when interpreter code reads a dotenv file and then uses a stored URL or host key from it.
 * The destination belongs to the same credential store and is therefore a paired destination.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether the code uses a URL from the dotenv it reads
 */
export function isCodePairedDestination(text) {
    const source = String(text ?? "");
    if (/\b[A-Z_][A-Z0-9_]*\s*=\s*['"]?[a-z][a-z0-9+.-]*:\/\//i.test(source)) {
        return false;
    }
    const readsDotenv = /open\s*\(\s*['"][^'"]*\.env|readFileSync\s*\([^)]*\.env|--env-file|Get-Content[^\n]*\.env|\.\s+[^\s]*\.env\b/i.test(source);
    if (!readsDotenv) {
        return false;
    }
    const storedKey = /^(?:[A-Z_][A-Z0-9_]*_(?:URL|ADDR|HOST)|URL|ADDR|HOST)$/i;
    const stores = /(?:env|environ|cfg|config|secrets|settings|values|data|os\.environ|process\.env)/i;
    const keyAccess = new RegExp(`${stores.source}\\s*(?:\\.get\\s*)?[\\[(]\\s*['\"]([A-Z_][A-Z0-9_]*)['\"]`, "gi");
    for (const match of source.matchAll(keyAccess)) {
        if (storedKey.test(match[1])) {
            return true;
        }
    }
    for (const match of source.matchAll(/\bprocess\.env\.([A-Z_][A-Z0-9_]*)/gi)) {
        if (storedKey.test(match[1])) {
            return true;
        }
    }
    return /\$\{?[A-Z_][A-Z0-9_]*(?:_URL|_ADDR|_HOST)(?:\})?/i.test(source);
}

/**
 * True when an encoder expression has a secret source inside its input. Base64 of a public fetch
 * is data, not obfuscation of an exfiltration.
 *
 * @param {string} text Command text
 * @returns {boolean} Whether an encoder input reads a secret
 */
export function encoderInputHasSecret(text) {
    const source = String(text ?? "");
    const secret = /\b(?:process\.env|os\.environ|os\.getenv|Get-Content|open\s*\()|\.env\b|\$\(\s*(?:grep|cat)\b|\b(?:grep|cat)\s+[^|\n]*\.env\b/i;
    const fragments = source.match(/[^\n;]{0,200}?(?:base64|b64encode|toString\(\s*['"]base64|xxd|gzip)[^\n;]{0,200}/gi) ?? [];
    return fragments.some((fragment) => secret.test(fragment));
}

/**
 * Variable names assigned from a dotenv lookup in one part of a command. Their later dollar
 * references are secret uses even when the reference itself contains no dotenv path.
 *
 * @param {string} text Command text
 * @returns {string[]} Uppercase variable names
 */
export function dotenvSourcedVariableNames(text) {
    const source = String(text ?? "");
    const names = new Set();
    for (const match of source.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*\$\(\s*(?:cat|grep)[^)]*\.env[^)]*\)/gi)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/grep\s+['"]?\^?([A-Z][A-Z0-9_]*)\s*=/gi)) {
        names.add(match[1]);
    }
    return [...names];
}

/**
 * Splits a shell command into quote aware segments. A separator inside quotes is data, so a git
 * clone URL or a JSON value is never broken apart. Newlines inside a heredoc become segments too.
 *
 * @param {string} text Command text
 * @returns {string[]} Nonempty trimmed segments
 */
export function splitCommandSegments(text) {
    const parts = [];
    let current = "";
    let quote = null;
    let escaped = false;
    for (const char of String(text ?? "")) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\" && quote !== "'") {
            current += char;
            escaped = true;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            current += char;
            continue;
        }
        if (char === "\n" || char === ";" || char === "|" || char === "&") {
            parts.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    parts.push(current);
    return parts.map((part) => part.trim()).filter(Boolean);
}

/** Login tools that can carry a dotenv password or key to a host. */
export const LOGIN_TOOL = new RegExp(
    COMMAND_START + String.raw`(?:ssh|scp|sftp|sshpass|rsync\b[^\n]{0,80}?\b-e\s+ssh)\b`,
    "i"
);

/**
 * @param {string} text Command text
 * @returns {boolean} Whether the command runs a login tool in command position
 */
export function isLoginToolCommand(text) {
    return LOGIN_TOOL.test(String(text ?? ""));
}
