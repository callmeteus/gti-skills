import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const NamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LanguageRule = /respond in the user'?s language/i;
const MaxBodyLines = 500;

/**
 * Splits SKILL.md text into its frontmatter block and body.
 *
 * @param {string} text File content
 * @returns {{ block: string | null, body: string }} Frontmatter block (null when absent) and body
 */
export function splitFrontmatter(text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

    if (!match) {
        return { block: null, body: text };
    }

    return { block: match[1], body: match[2] };
}

/**
 * Parses the top-level keys of a frontmatter block, including folded and literal scalars.
 *
 * @param {string} block Frontmatter block
 * @returns {Record<string, string>} Key to scalar value (nested maps are ignored)
 */
export function parseFrontmatter(block) {
    const fields = {};
    const lines = block.split(/\r?\n/);
    let index = 0;

    while (index < lines.length) {
        const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        index += 1;

        if (!match) {
            continue;
        }

        const key = match[1];
        let value = match[2].trim();

        if (/^[>|][+-]?$/.test(value)) {
            const folded = value.startsWith(">");
            const collected = [];

            while (index < lines.length && (/^\s/.test(lines[index]) || lines[index].trim() === "")) {
                collected.push(lines[index].trim());
                index += 1;
            }

            value = collected.filter(Boolean).join(folded ? " " : "\n");
        } else
        if (value.length >= 2 && value[0] === value[value.length - 1] && "\"'".includes(value[0])) {
            value = value.slice(1, -1);
        }

        fields[key] = value;
    }

    return fields;
}

/**
 * Lists relative Markdown link targets outside fenced code blocks.
 *
 * @param {string} text Markdown text
 * @returns {string[]} Local link targets without anchors
 */
export function localLinks(text) {
    const withoutCode = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    const links = [];

    for (const match of withoutCode.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1];

        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) {
            continue;
        }

        const path = target.split("#")[0];

        if (path) {
            links.push(path);
        }
    }

    return links;
}

/**
 * Validates a SKILL.md against the Agent Skills standard and the repository rules.
 *
 * @param {string} skillDir Folder that contains SKILL.md
 * @param {string} expectedName Skill id the frontmatter name must equal
 * @returns {{ errors: string[], warnings: string[] }} Findings
 */
export function validateSkillFolder(skillDir, expectedName) {
    const file = join(skillDir, "SKILL.md");
    const errors = [];
    const warnings = [];

    if (!existsSync(file)) {
        return { errors: [`SKILL.md not found in ${skillDir}`], warnings };
    }

    const text = readFileSync(file, "utf8");
    const { block, body } = splitFrontmatter(text);

    if (block === null) {
        return { errors: ["SKILL.md must start with YAML frontmatter between --- lines"], warnings };
    }

    const fields = parseFrontmatter(block);
    const name = fields.name ?? "";
    const description = fields.description ?? "";

    if (!name) {
        errors.push("frontmatter is missing name");
    } else
    if (!NamePattern.test(name) || name.length > 64) {
        errors.push(`name "${name}" must be lowercase letters, digits, and single hyphens, max 64 characters`);
    } else
    if (name !== expectedName) {
        errors.push(`name "${name}" must equal the skill id "${expectedName}"`);
    }

    if (!description) {
        errors.push("frontmatter is missing description");
    } else
    if (description.length > 1024) {
        errors.push(`description is ${description.length} characters, the limit is 1024`);
    } else
    if (!/\buse (this skill )?(when|for)\b/i.test(description)) {
        warnings.push("description should say when to use the skill, for example \"Use when ...\"");
    }

    if (fields.compatibility && fields.compatibility.length > 500) {
        errors.push("compatibility is longer than 500 characters");
    }

    const bodyLines = body.split(/\r?\n/).length;

    if (bodyLines > MaxBodyLines) {
        errors.push(`body is ${bodyLines} lines, keep SKILL.md under ${MaxBodyLines} and move detail to references/`);
    }

    if (!LanguageRule.test(body)) {
        errors.push("missing the Core Rule: always respond in the user's language");
    }

    if (/[–—]/.test(text)) {
        errors.push("remove em dash and en dash characters, use a hyphen");
    }

    for (const target of localLinks(text)) {
        if (!existsSync(join(skillDir, target))) {
            errors.push(`broken link: ${target}`);
        }
    }

    for (const reference of listMarkdown(join(skillDir, "references"))) {
        const referenceText = readFileSync(reference, "utf8");

        for (const target of localLinks(referenceText)) {
            if (!existsSync(join(dirname(reference), target))) {
                errors.push(`broken link in ${relative(skillDir, reference).split(sep).join("/")}: ${target}`);
            }
        }

        if (/[–—]/.test(referenceText)) {
            errors.push(`em dash or en dash in ${relative(skillDir, reference).split(sep).join("/")}`);
        }
    }

    return { errors, warnings };
}

/**
 * Lists Markdown files under a folder, recursively.
 *
 * @param {string} directory Folder to scan
 * @returns {string[]} Absolute file paths
 */
function listMarkdown(directory) {
    if (!existsSync(directory)) {
        return [];
    }

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return listMarkdown(path);
        }

        return entry.name.endsWith(".md") ? [path] : [];
    });
}
