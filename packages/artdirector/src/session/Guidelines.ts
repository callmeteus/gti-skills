import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { ArtErrors, Ids, JsonFile } from "../core";

/**
 * A rule says what to do or what to avoid.
 */
export enum GuidelineKind {
    DO = "do",
    DONT = "dont"
}

/**
 * Where a rule applies: every piece the user makes, or only work in one workspace (one brand or project).
 */
export enum GuidelineScope {
    USER = "user",
    WORKSPACE = "workspace"
}

/**
 * Feedback a rule was learned from.
 */
export interface GuidelineEvidence {
    at: string;
    requestId?: string;
    variantId?: string;
    /** The user's words, short. */
    quote?: string;
}

/**
 * One learned or written rule.
 */
export interface Guideline {
    id: string;
    kind: GuidelineKind;
    scope: GuidelineScope;
    text: string;
    /** Why the rule exists, in the user's terms. */
    why?: string;
    /** Who wrote it: the agent learning from feedback, or the user in the studio. */
    source: "agent" | "studio";
    createdAt: string;
    updatedAt: string;
    /** How many times feedback confirmed the rule. */
    hits: number;
    evidence: GuidelineEvidence[];
}

/**
 * Input for a new rule.
 */
export interface GuidelineInput {
    kind: GuidelineKind | string;
    text: string;
    scope?: GuidelineScope | string;
    why?: string;
    source: Guideline["source"];
    evidence?: Omit<GuidelineEvidence, "at">;
}

/**
 * Result of adding a rule.
 */
export interface GuidelineAdded {
    rule: Guideline;
    /** Same rule already existed and was confirmed again. */
    reinforced: boolean;
    /** Same rule existed with the opposite kind and was flipped. */
    reversed: boolean;
}

const MaxText = 300;
const MaxWhy = 500;
const MaxEvidence = 10;

/**
 * Dos and don'ts the agent learns from the user's feedback. They outlive chats:
 * user rules live in `<guidelines home>/guidelines.json`, and workspace rules in
 * `<guidelines home>/workspaces/<key>/guidelines.json`. The home is `~/.artdirector`
 * and can be moved with `ARTDIRECTOR_GUIDELINES_HOME`.
 */
export class Guidelines {
    /**
     * @param userFile File for rules that apply everywhere
     * @param workspaceFile File for rules of one workspace
     * @param workspace Workspace folder
     */
    constructor(
        readonly userFile: string,
        readonly workspaceFile: string,
        readonly workspace: string
    ) {}

    /**
     * @param workspace Workspace folder
     * @returns Guidelines for the user and that workspace
     */
    static for(workspace: string): Guidelines {
        const home = Guidelines.home();
        const absolute = resolve(workspace);
        const digest = createHash("sha256").update(process.platform === "win32" ? absolute.toLowerCase() : absolute).digest("hex").slice(0, 10);
        const key = `${Ids.slug(basename(absolute)).slice(0, 40) || "workspace"}-${digest}`;
        return new Guidelines(join(home, "guidelines.json"), join(home, "workspaces", key, "guidelines.json"), absolute);
    }

    /**
     * @returns Folder holding every guideline file
     */
    static home(): string {
        const override = process.env.ARTDIRECTOR_GUIDELINES_HOME?.trim();
        return override ? resolve(override) : join(homedir(), ".artdirector");
    }

    /**
     * @returns Workspace rules first, then user rules; don'ts before dos inside each
     */
    list(): Guideline[] {
        const order = (rule: Guideline) => rule.kind === GuidelineKind.DONT ? 0 : 1;
        const sorted = (rules: Guideline[]) => [...rules].sort((a, b) => order(a) - order(b) || a.createdAt.localeCompare(b.createdAt));
        return [...sorted(this.read(GuidelineScope.WORKSPACE)), ...sorted(this.read(GuidelineScope.USER))];
    }

    /**
     * Adds a rule. The same rule in the same scope is confirmed instead of duplicated,
     * and flipped when its kind changed.
     *
     * @param input Rule
     * @returns Stored rule and what happened
     */
    add(input: GuidelineInput): GuidelineAdded {
        const kind = parseKind(input.kind);
        const scope = parseScope(input.scope ?? GuidelineScope.WORKSPACE);
        const text = clean(input.text, MaxText, "A guideline needs text.");
        const why = input.why?.trim() ? clean(input.why, MaxWhy, "") : undefined;
        const now = new Date().toISOString();
        const evidence = input.evidence && Object.values(input.evidence).some(Boolean)
            ? [{ at: now, ...compact(input.evidence) }]
            : [];
        const rules = this.read(scope);
        const existing = rules.find((rule) => same(rule.text, text));

        if (existing) {
            const reversed = existing.kind !== kind;
            existing.kind = kind;
            existing.text = reversed ? text : existing.text;
            existing.why = why ?? existing.why;
            existing.updatedAt = now;
            existing.hits = reversed ? 1 : existing.hits + 1;
            existing.evidence = [...(reversed ? [] : existing.evidence), ...evidence].slice(-MaxEvidence);
            this.write(scope, rules);
            return { rule: existing, reinforced: !reversed, reversed };
        }

        const rule: Guideline = {
            id: Ids.short(),
            kind,
            scope,
            text,
            source: input.source,
            createdAt: now,
            updatedAt: now,
            hits: 1,
            evidence
        };

        if (why) {
            rule.why = why;
        }

        this.write(scope, [...rules, rule]);
        return { rule, reinforced: false, reversed: false };
    }

    /**
     * Changes a rule's text, reason, kind, or scope.
     *
     * @param id Rule id
     * @param patch Fields to change
     * @returns Updated rule
     */
    update(id: string, patch: { text?: string; why?: string; kind?: string; scope?: string }): Guideline {
        const found = this.find(id);
        const rule = { ...found.rule };

        if (patch.text !== undefined) {
            rule.text = clean(patch.text, MaxText, "A guideline needs text.");
        }

        if (patch.why !== undefined) {
            rule.why = patch.why.trim() ? clean(patch.why, MaxWhy, "") : undefined;
        }

        if (patch.kind !== undefined) {
            rule.kind = parseKind(patch.kind);
        }

        if (patch.scope !== undefined) {
            rule.scope = parseScope(patch.scope);
        }

        if (!rule.why) {
            delete rule.why;
        }

        rule.updatedAt = new Date().toISOString();
        this.write(found.rule.scope, this.read(found.rule.scope).filter((item) => item.id !== id));
        const target = this.read(rule.scope).filter((item) => item.id !== id);
        this.write(rule.scope, [...target, rule]);
        return rule;
    }

    /**
     * @param id Rule id
     * @returns Removed rule
     */
    remove(id: string): Guideline {
        const found = this.find(id);
        this.write(found.rule.scope, this.read(found.rule.scope).filter((item) => item.id !== id));
        return found.rule;
    }

    /**
     * Plain list the agent reads before designing.
     *
     * @returns One line per rule
     */
    brief(): string[] {
        return this.list().map((rule) => {
            const label = rule.kind === GuidelineKind.DO ? "DO" : "DON'T";
            const why = rule.why ? ` (why: ${rule.why})` : "";
            return `${label} [${rule.scope}] ${rule.text}${why}`;
        });
    }

    /**
     * @param id Rule id
     * @returns Rule and the scope holding it
     */
    private find(id: string): { rule: Guideline } {
        const rule = this.list().find((item) => item.id === id.trim());

        if (!rule) {
            throw ArtErrors.notFound(`Guideline not found: ${id}`);
        }

        return { rule };
    }

    /**
     * @param scope Scope
     * @returns Rules stored for that scope
     */
    private read(scope: GuidelineScope): Guideline[] {
        const file = this.file(scope);

        if (!existsSync(file)) {
            return [];
        }

        try {
            const data = JsonFile.read<{ rules?: Guideline[] }>(file);
            return (data.rules ?? []).map((rule) => ({ ...rule, scope, hits: rule.hits ?? 1, evidence: rule.evidence ?? [] }));
        } catch {
            return [];
        }
    }

    /**
     * @param scope Scope
     * @param rules Rules
     */
    private write(scope: GuidelineScope, rules: Guideline[]): void {
        const file = this.file(scope);
        mkdirSync(dirname(file), { recursive: true });
        const body: Record<string, unknown> = { version: 1, rules };

        if (scope === GuidelineScope.WORKSPACE) {
            body.workspace = this.workspace;
        }

        JsonFile.write(file, body);
    }

    /**
     * @param scope Scope
     * @returns File for that scope
     */
    private file(scope: GuidelineScope): string {
        return scope === GuidelineScope.USER ? this.userFile : this.workspaceFile;
    }
}

/**
 * @param value Kind such as `do`, `dont`, or `don't`
 * @returns Kind
 */
function parseKind(value: string): GuidelineKind {
    const key = value.trim().toLowerCase().replace(/['’\s_-]/g, "");

    if (key === "do") {
        return GuidelineKind.DO;
    }

    if (key === "dont" || key === "avoid") {
        return GuidelineKind.DONT;
    }

    throw ArtErrors.project(`A guideline is "do" or "dont", not "${value}".`);
}

/**
 * @param value Scope name
 * @returns Scope
 */
function parseScope(value: string): GuidelineScope {
    const key = value.trim().toLowerCase();

    if (key === GuidelineScope.USER || key === "global") {
        return GuidelineScope.USER;
    }

    if (key === GuidelineScope.WORKSPACE || key === "project") {
        return GuidelineScope.WORKSPACE;
    }

    throw ArtErrors.project(`A guideline scope is "user" or "workspace", not "${value}".`);
}

/**
 * @param value Text
 * @param max Maximum length
 * @param empty Error for empty text
 * @returns Trimmed text
 */
function clean(value: string, max: number, empty: string): string {
    const text = value.replace(/\s+/g, " ").trim();

    if (!text) {
        throw ArtErrors.project(empty);
    }

    if (text.length > max) {
        throw ArtErrors.project(`Keep a guideline under ${max} characters; write one rule per entry.`);
    }

    return text;
}

/**
 * @param a Rule text
 * @param b Rule text
 * @returns True when both say the same thing, ignoring case and punctuation
 */
function same(a: string, b: string): boolean {
    const key = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}#]+/gu, " ").trim();
    return key(a) === key(b);
}

/**
 * @param evidence Evidence fields
 * @returns Evidence without empty fields, quote shortened
 */
function compact(evidence: Omit<GuidelineEvidence, "at">): Omit<GuidelineEvidence, "at"> {
    const out: Omit<GuidelineEvidence, "at"> = {};

    if (evidence.requestId) {
        out.requestId = evidence.requestId;
    }

    if (evidence.variantId) {
        out.variantId = evidence.variantId;
    }

    if (evidence.quote?.trim()) {
        out.quote = evidence.quote.replace(/\s+/g, " ").trim().slice(0, 200);
    }

    return out;
}
