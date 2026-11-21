import { riskTier, safe, snippet } from "./findings.mjs";

/** Rotation destination for each credential type the package recognises. */
const PROVIDERS = {
    stripe: { label: "Stripe", url: "https://dashboard.stripe.com/apikeys" },
    anthropic: { label: "Anthropic", url: "https://console.anthropic.com/settings/keys" },
    openai: { label: "OpenAI", url: "https://platform.openai.com/api-keys" },
    aws: { label: "AWS IAM", url: "https://console.aws.amazon.com/iam/home#/security_credentials" },
    github: { label: "GitHub", url: "https://github.com/settings/tokens" },
    slack: { label: "Slack", url: "https://api.slack.com/apps" },
    google: { label: "Google Cloud", url: "https://console.cloud.google.com/apis/credentials" },
    "private-key": {
        label: "The issuer of the keypair",
        url: "https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys"
    },
    "url-password": { label: "The service named in the connection URL", url: "" }
};

/**
 * Builds a rotation checklist. Each line names the provider page for that credential type,
 * without repeating the credential itself.
 *
 * @param {object[]} findings Deduplicated findings
 * @returns {object[]} Rotation entries
 */
export function buildRotation(findings) {
    const byType = new Map();

    for (const finding of findings) {
        if (!finding.secretHash || finding.fixture) {
            continue;
        }
        const key = finding.secretType ?? "unknown";
        if (!byType.has(key)) {
            byType.set(key, []);
        }
        byType.get(key).push(finding);
    }

    return [...byType.entries()].map(([type, entries]) => {
        const provider = PROVIDERS[type] ?? { label: "The credential issuer", url: "" };
        const secrets = [...new Map(entries.map((entry) => [entry.secretHash, entry.secretRedacted])).entries()]
            .map(([hash, redacted]) => ({ hash, redacted }));
        const occurrences = entries.reduce((sum, entry) => sum + entry.occurrences.length, 0);

        return {
            type,
            provider: provider.label,
            url: provider.url,
            secrets,
            occurrences
        };
    }).sort((left, right) => left.type.localeCompare(right.type));
}

/**
 * Best effort agent name for a finding location. Used only to group secrets in the summary table.
 *
 * @param {string} location Finding location
 * @returns {string} Agent id
 */
function agentForLocation(location) {
    const path = String(location ?? "").replace(/\\/g, "/");
    if (/\.claude\//i.test(path)) return "claude";
    if (/\.codex\//i.test(path)) return "codex";
    if (/\.copilot\//i.test(path)) return "copilot";
    if (/opencode/i.test(path)) return "opencode";
    if (/kilo/i.test(path)) return "kilo";
    if (/cursor/i.test(path)) return "cursor";
    if (/\.cline\//i.test(path)) return "cline";
    if (/antigravity/i.test(path)) return "antigravity";
    if (/kiro/i.test(path)) return "kiro";
    return "other";
}

/**
 * Folder part of a location, using forward slashes for stable Markdown.
 *
 * @param {string} location Finding location
 * @returns {string} Folder
 */
function folderOf(location) {
    const path = String(location ?? "").replace(/\\/g, "/");
    const index = path.lastIndexOf("/");
    return index > 0 ? path.slice(0, index) : path;
}

/**
 * Formats one occurrence as a Markdown list item.
 *
 * @param {object} occurrence Occurrence
 * @returns {string} Markdown line
 */
function occurrenceLine(occurrence) {
    const where = occurrence.line ? `${occurrence.location}:${occurrence.line}` : occurrence.location;
    const time = occurrence.time ? `, ${occurrence.time}` : "";
    const state = occurrence.executed ? "ran" : "requested";
    return `- ${occurrence.source} - \`${where}\` (${state}${time}): ${snippet(occurrence.evidence, 320)}`;
}

/**
 * Renders the human readable report. No raw credential is ever written: every evidence field was
 * redacted when the finding was created, and `safe` is applied again here.
 *
 * @param {object} report Report object
 * @returns {string} Markdown
 */
export function renderMarkdown(report) {
    const lines = [];
    const { options, counts, sources, findings, rotation } = report;
    const window = options.sinceDays === null ? "all time" : `last ${options.sinceDays} day(s)`;

    lines.push("# Leak scan report");
    lines.push("");
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push(`Repository: \`${options.repo}\``);
    lines.push(`Window: ${window}`);
    lines.push(`Output: \`${options.out}\``);
    lines.push("");
    const severityLine = ["critical", "high", "medium", "low", "info"]
        .map((level) => `${level}=${counts.bySeverity?.[level] ?? 0}`)
        .join(", ");
    lines.push(`Severity counts: ${severityLine}`);
    lines.push("");

    lines.push("## Summary");
    lines.push("");
    lines.push("| Kind | Count |");
    lines.push("|------|-------|");
    for (const kind of ["exfil_executed", "secret_exposed", "injection_found", "guard_event"]) {
        lines.push(`| ${kind} | ${counts.byKind[kind] ?? 0} |`);
    }
    lines.push("");
    lines.push("| Source | Files scanned | Skipped |");
    lines.push("|--------|---------------|---------|");
    for (const source of sources.scanned) {
        lines.push(`| ${source.source} | ${source.files} | ${source.skipped} |`);
    }
    lines.push("");
    lines.push(`Findings kept after deduplication: ${counts.findings}. Skipped paths: ${counts.skippedFiles}.`);

    const secrets = findings.filter((finding) => finding.secretHash);
    lines.push("");
    lines.push("## Distinct secrets");
    lines.push("");
    if (secrets.length === 0) {
        lines.push("No credential literal was found in the scanned sources.");
    } else {
        lines.push("One row per credential hash. Occurrences are the number of places the same value appeared.");
        lines.push("");
        lines.push("| Secret | Type | Severity | Places | Agents | Folders |");
        lines.push("|--------|------|----------|--------|--------|---------|");
        for (const finding of secrets) {
            const agents = [...new Set(finding.occurrences.map((occurrence) =>
                agentForLocation(occurrence.location)))].sort();
            const folders = [...new Set(finding.occurrences.map((occurrence) =>
                folderOf(occurrence.location)))].sort();
            const shown = folders.slice(0, 5).map((folder) => `\`${folder}\``).join(", ");
            const more = folders.length > 5 ? ` (+${folders.length - 5} more)` : "";
            const note = finding.local && finding.secretType === "url-password"
                ? " internal host, still an exposure if sent to a model provider"
                : "";
            lines.push(`| ${finding.secretRedacted} (hash ${finding.secretHash}) | ${finding.secretType ?? "unknown"} | ${finding.severity}${note} | ${finding.occurrences.length} | ${agents.join(", ")} | ${shown}${more} |`);
        }
    }

    if (Array.isArray(sources.coverage) && sources.coverage.length > 0) {
        lines.push("");
        lines.push("## Transcript coverage");
        lines.push("");
        lines.push("| Agent | Stores found | Rows read | Sessions | Skipped | Note |");
        lines.push("|-------|--------------|-----------|----------|---------|------|");
        for (const entry of sources.coverage) {
            const count = entry.storesFound.length;
            const paths = count === 0
                ? "none"
                : count === 1
                    ? `\`${entry.storesFound[0].split("/").pop()}\``
                    : `${count} paths`;
            const skips = entry.skipped.length === 0
                ? "0"
                : entry.skipped.map((skip) => `${skip.reason}${skip.count ? ` (${skip.count})` : ""}`).join("; ");
            lines.push(`| ${entry.agent} | ${paths} | ${entry.rowsRead} | ${entry.sessions} | ${skips} | ${entry.note || "-"} |`);
        }
        for (const entry of sources.coverage) {
            if (entry.storesFound.length === 0) {
                continue;
            }
            lines.push("");
            lines.push(`- ${entry.agent} paths: ${entry.storesFound.map((path) => `\`${path}\``).join(", ")}`);
        }
    }

    if (sources.missing.length > 0) {
        lines.push("");
        lines.push("Absent sources, skipped quietly:");
        for (const entry of sources.missing) {
            lines.push(`- ${entry.source}: \`${entry.path}\` (${entry.reason})`);
        }
    }
    if (sources.uncovered.length > 0) {
        lines.push("");
        lines.push("Transcript sources with no reader because no local history format is documented:");
        lines.push(`- ${sources.uncovered.join(", ")}`);
    }
    if (sources.errors.length > 0) {
        lines.push("");
        lines.push("Read errors:");
        for (const entry of sources.errors) {
            lines.push(`- \`${entry.path}\`: ${safe(entry.note)}`);
        }
    }
    if (sources.unknown.length > 0) {
        lines.push("");
        lines.push(`Unknown source ids ignored: ${sources.unknown.join(", ")}.`);
    }

    lines.push("");
    lines.push("## Findings by risk");
    lines.push("");

    const renderFinding = (finding) => {
        if (finding.secretHash) {
            lines.push(`### ${finding.secretRedacted} (hash ${finding.secretHash})`);
        } else {
            lines.push(`### ${finding.kind} (${finding.severity}): ${snippet(finding.title, 120)}`);
        }
        lines.push("");
        const details = [finding.kind, `severity ${finding.severity}`];
        if (finding.secretType) {
            details.push(finding.secretType);
        }
        if (finding.host) {
            details.push(`host ${finding.host}`);
        }
        if (finding.note) {
            details.push(finding.note);
        }
        lines.push(`${details.join(", ")}. ${finding.occurrences.length} occurrence(s).`);
        lines.push("");
        for (const occurrence of finding.occurrences) {
            lines.push(occurrenceLine(occurrence));
        }
        lines.push("");
    };

    const sections = [
        [0, "Executed exfiltration to a remote host"],
        [1, "Exposed credentials with a remote destination or live-looking key"],
        [2, "Requested-only or local exfiltration"],
        [3, "Low and informational findings"]
    ];
    for (const [tier, title] of sections) {
        const items = findings.filter((finding) => riskTier(finding) === tier && !finding.fixture);
        if (items.length === 0) {
            continue;
        }
        lines.push(`### ${title} (${items.length})`);
        lines.push("");
        for (const finding of items) {
            renderFinding(finding);
        }
    }

    const fixtures = findings.filter((finding) => finding.fixture);
    if (fixtures.length > 0) {
        lines.push("<details>");
        lines.push(`<summary>Test fixtures (${fixtures.length})</summary>`);
        lines.push("");
        for (const finding of fixtures) {
            renderFinding(finding);
        }
        lines.push("</details>");
        lines.push("");
    }

    lines.push("## Rotation checklist");
    lines.push("");
    if (rotation.length === 0) {
        lines.push("No credential rotation is indicated by this scan.");
    } else {
        for (const entry of rotation) {
            const page = entry.url ? ` at ${entry.url}` : "";
            lines.push(`- [ ] Rotate ${entry.type} with ${entry.provider}${page} (${entry.occurrences} occurrence(s))`);
            for (const secret of entry.secrets) {
                lines.push(`  - ${secret.redacted} (hash ${secret.hash})`);
            }
        }
        lines.push("");
        lines.push("Remove a credential from every source before rotating; a new key in the same file is exposed again on the next commit or transcript write.");
    }

    lines.push("");
    lines.push("This report is a pattern based triage list, not proof that a credential was used. Confirm each item before acting on it.");
    lines.push("");

    return lines.join("\n");
}

/**
 * Serialises the report as pretty JSON. Only redacted fields are present.
 *
 * @param {object} report Report object
 * @returns {string} JSON text
 */
export function renderJson(report) {
    return `${JSON.stringify(report, null, 2)}\n`;
}
