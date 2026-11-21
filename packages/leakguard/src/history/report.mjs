import { safe, snippet } from "./findings.mjs";

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
        if (!finding.secretHash) {
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
 * Formats one occurrence as a Markdown list item.
 *
 * @param {object} occurrence Occurrence
 * @returns {string} Markdown line
 */
function occurrenceLine(occurrence) {
    const where = occurrence.line ? `${occurrence.location}:${occurrence.line}` : occurrence.location;
    const time = occurrence.time ? `, ${occurrence.time}` : "";
    const state = occurrence.executed ? "ran" : "requested";
    return `- ${occurrence.source} - \`${where}\` (${state}${time}): ${snippet(occurrence.evidence, 160)}`;
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

    if (sources.missing.length > 0) {
        lines.push("");
        lines.push("Absent sources, skipped quietly:");
        for (const entry of sources.missing) {
            lines.push(`- ${entry.source}: \`${entry.path}\` (${entry.reason})`);
        }
    }
    if (sources.uncovered.length > 0) {
        lines.push("");
        lines.push("Transcript sources not covered because no local history folder is documented:");
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
    lines.push("## Findings grouped by secret");
    lines.push("");

    const grouped = findings.filter((finding) => finding.secretHash);
    if (grouped.length === 0) {
        lines.push("No credential literal was found. Other findings are listed below.");
    } else {
        for (const finding of grouped) {
            lines.push(`### ${finding.secretRedacted} (hash ${finding.secretHash})`);
            lines.push("");
            lines.push(`${finding.secretType ?? "credential"}, severity ${finding.severity}, ${finding.occurrences.length} occurrence(s).`);
            lines.push("");
            for (const occurrence of finding.occurrences) {
                lines.push(occurrenceLine(occurrence));
            }
            lines.push("");
        }
    }

    const other = findings.filter((finding) => !finding.secretHash);
    if (other.length > 0) {
        lines.push("## Other findings");
        lines.push("");
        for (const finding of other) {
            lines.push(`### ${finding.kind} (${finding.severity}): ${snippet(finding.title, 120)}`);
            lines.push("");
            for (const occurrence of finding.occurrences) {
                lines.push(occurrenceLine(occurrence));
            }
            lines.push("");
        }
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
