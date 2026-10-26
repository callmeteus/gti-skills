import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { ArtworkAudit } from "../audit";
import { CommandRegistry, Commands } from "../commands";
import {
    ArtCommand,
    ArtErrors,
    DefaultProjectName,
    ExportFormat,
    Ids,
    Paths,
    SessionPhase,
    VariantStatus,
    VisualDirection,
    type ArtworkVariant,
    type CommandResult
} from "../core";
import { CritiquePrompts, Directions, Formats, QualityStandard } from "../design";
import { DemoWorkflow } from "../demo";
import { HtmlDocument, UnifiedRenderer } from "../renderer";
import { startStudio } from "../server";
import { ContextResolver, type ProjectContext } from "../session";
import { Effects, TemplateApply, TemplateCatalog } from "../templates";
import { Techniques } from "../techniques";
import { helpText } from "./Help";
import { flagBool, flagString, parseArgv } from "./ParseFlags";

/**
 * Dispatches ArtDirector CLI commands. Agents should pass `--json`.
 *
 * @param argv Arguments after the binary name
 * @returns Command result
 */
export async function runCli(argv: string[]): Promise<CommandResult> {
    const parsed = parseArgv(argv);
    const json = flagBool(parsed.flags, "json") || process.env.ARTDIRECTOR_JSON === "1";
    const workspace = resolve(flagString(parsed.flags, "root") ?? process.cwd());
    const session = flagString(parsed.flags, "session");
    const request = flagString(parsed.flags, "request");
    const permanent = flagBool(parsed.flags, "permanent")
        || flagBool(parsed.flags, "repo")
        || process.env.ARTDIRECTOR_STORAGE === "repository";

    if (parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
        return finish({
            ok: true,
            command: "help",
            summary: helpText()
        }, json);
    }

    if (parsed.command === "init") {
        const resolution = ContextResolver.init({
            workspace,
            session,
            request,
            permanent,
            newRequest: flagBool(parsed.flags, "new"),
            name: flagString(parsed.flags, "name") ?? DefaultProjectName,
            brief: {
                goal: flagString(parsed.flags, "goal") ?? ""
            }
        });
        const ctx = resolution.ctx;
        applyLanguage(ctx, parsed.flags);
        return finish({
            ok: true,
            command: ArtCommand.INIT,
            summary: `Initialized ${resolution.storage} project at ${ctx.root}`,
            data: {
                project: ctx.project(),
                session: ctx.session(),
                scope: ContextResolver.describe(resolution)
            }
        }, json);
    }

    if (parsed.command === "demo") {
        const out = flagString(parsed.flags, "out") ?? join(Paths.packageRoot(), "demos", "artifacts");
        const render = !flagBool(parsed.flags, "no-render");
        const result = await DemoWorkflow.run(out, render);
        return finish({
            ok: true,
            command: "demo",
            summary: `Wrote three HTML compositions and exports under ${out}`,
            data: result as unknown as Record<string, unknown>
        }, json);
    }

    if (parsed.command === "effects") {
        const id = flagString(parsed.flags, "id");

        return finish({
            ok: true,
            command: "effects",
            summary: id ? `Effect ${id}` : "Include an effect with {{> id}} inside a style element (css) or the body (svg, html).",
            data: id
                ? { effect: Effects.read(id) }
                : { effects: Effects.list().map((item) => ({ id: item.id, kind: item.kind, summary: item.summary })) }
        }, json);
    }

    const resolution = ContextResolver.open({
        workspace,
        session,
        request,
        permanent
    });
    const ctx = resolution.ctx;
    applyLanguage(ctx, parsed.flags);

    if (parsed.command === "status" || parsed.command === ArtCommand.RESUME) {
        return finish({
            ok: true,
            command: parsed.command,
            summary: `Project ${ctx.project().name} / phase ${ctx.session().phase} / ${resolution.storage}`,
            data: {
                project: ctx.project(),
                session: ctx.session(),
                variants: ctx.variants(),
                pendingEvent: ctx.pendingEvent(),
                scope: ContextResolver.describe(resolution)
            }
        }, json);
    }

    if (parsed.command === ArtCommand.BRIEF) {
        const project = ctx.patchBrief({
            goal: flagString(parsed.flags, "goal") ?? ctx.project().brief.goal,
            audience: flagString(parsed.flags, "audience"),
            category: flagString(parsed.flags, "category") as never,
            formatId: flagString(parsed.flags, "format"),
            tone: flagString(parsed.flags, "tone")
        });
        return finish({
            ok: true,
            command: ArtCommand.BRIEF,
            summary: "Brief updated.",
            data: { project }
        }, json);
    }

    if (parsed.command === ArtCommand.SHAPE) {
        const direction = (flagString(parsed.flags, "direction") as VisualDirection | undefined)
            ?? Directions.suggest(ctx.project().brief.category)[0]?.id;
        const project = ctx.selectDirection(direction);
        return finish({
            ok: true,
            command: ArtCommand.SHAPE,
            summary: `Direction set to ${project.selectedDirection}`,
            data: {
                project,
                suggested: Directions.suggest(project.brief.category)
            }
        }, json);
    }

    if (parsed.command === "studio" || parsed.command === ArtCommand.LIVE) {
        const portFlag = flagString(parsed.flags, "port");
        const started = await startStudio({
            ctx,
            port: portFlag ? Number(portFlag) : undefined
        });
        ctx.setPhase(parsed.command === ArtCommand.LIVE ? SessionPhase.LIVE : SessionPhase.SHAPE);

        if (flagBool(parsed.flags, "open") && !started.reused) {
            openUrl(started.url);
        }

        return finish({
            ok: true,
            command: parsed.command,
            summary: `${started.reused ? "Reused" : "Started"} studio on ${started.url}`,
            data: {
                url: started.url,
                port: started.port,
                reused: started.reused,
                bind: "127.0.0.1",
                tokenPath: join(ctx.stateDir(), "token"),
                scope: ContextResolver.describe(resolution)
            }
        }, json);
    }

    if (parsed.command === ArtCommand.GENERATE) {
        const templateId = flagString(parsed.flags, "template");

        if (!templateId) {
            return finish({
                ok: true,
                command: ArtCommand.GENERATE,
                summary: "Art-direction generate: write HTML variants, then `artdirector variants add --file`.",
                data: {
                    techniques: Techniques.forBrief(ctx.project().brief),
                    quality: QualityStandard,
                    templates: TemplateCatalog.list().map((item) => ({ id: item.id, format: item.formatId })),
                    effects: Effects.list().map((item) => ({ id: item.id, summary: item.summary }))
                }
            }, json);
        }

        const spec = TemplateCatalog.read(templateId);
        const format = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
        const tokensFile = flagString(parsed.flags, "tokens");
        const extra = tokensFile
            ? JSON.parse(readFileSync(resolve(workspace, tokensFile), "utf8")) as Record<string, string>
            : undefined;
        const tokens = TemplateApply.tokens({
            brand: ctx.project().brand,
            brief: ctx.project().brief,
            formatId: spec.formatId,
            extra
        });
        const id = flagString(parsed.flags, "id") ?? templateId;
        const htmlPath = `.artdirector/variants/${id}/artwork.html`;
        const abs = Paths.confine(ctx.root, htmlPath);
        mkdirSync(dirname(abs), { recursive: true });
        const html = TemplateApply.materialize(TemplateApply.render(spec, tokens), dirname(abs), workspace);
        writeFileSync(abs, html, "utf8");
        ctx.upsertVariant({
            id,
            title: spec.title,
            direction: ctx.project().selectedDirection ?? VisualDirection.EDITORIAL_TYPOGRAPHIC,
            status: VariantStatus.DRAFT,
            createdAt: new Date().toISOString(),
            htmlPath,
            width: format.width,
            height: format.height,
            templateId
        });
        ctx.setPhase(SessionPhase.GENERATE);
        return finish({
            ok: true,
            command: ArtCommand.GENERATE,
            summary: `Rendered template ${templateId} to ${htmlPath}`,
            data: {
                htmlPath,
                tokens: TemplateApply.slots(spec.html)
            }
        }, json);
    }


    if (parsed.command === "variants") {
        if (parsed.rest[0] === "add") {
            return finish(addVariant(ctx, parsed.flags, workspace), json);
        }

        return finish({
            ok: true,
            command: "variants",
            summary: `${ctx.variants().length} variants`,
            data: {
                variants: ctx.variants(),
                scope: ContextResolver.describe(resolution)
            }
        }, json);
    }

    if (parsed.command === ArtCommand.CRITIQUE) {
        return finish({
            ok: true,
            command: ArtCommand.CRITIQUE,
            summary: "Quality floor and critique prompts. Automated checks do not prove visual quality.",
            data: {
                quality: QualityStandard,
                prompts: CritiquePrompts,
                direction: ctx.project().selectedDirection,
                techniques: Techniques.forBrief(ctx.project().brief)
            }
        }, json);
    }

    if (parsed.command === ArtCommand.AUDIT) {
        const id = flagString(parsed.flags, "id") ?? ctx.project().activeVariantId ?? ctx.variants()[0]?.id;

        if (!id) {
            throw ArtErrors.project("No variant to audit.");
        }

        const variant = ctx.variant(id);
        const report = await ArtworkAudit.run(Paths.confine(ctx.root, variant.htmlPath), variant, undefined, ctx.root);
        return finish({
            ok: report.passed,
            command: ArtCommand.AUDIT,
            summary: report.passed ? "Audit passed (deterministic checks only)." : "Audit found errors.",
            data: { report }
        }, json);
    }

    if (parsed.command === ArtCommand.EXPORT) {
        const id = flagString(parsed.flags, "id") ?? ctx.project().acceptedVariantId ?? ctx.project().activeVariantId;

        if (!id) {
            throw ArtErrors.project("No variant to export.");
        }

        const format = (flagString(parsed.flags, "format") as ExportFormat | undefined) ?? ExportFormat.PNG;
        const variant = ctx.variant(id);
        const html = readFileSync(Paths.confine(ctx.root, variant.htmlPath), "utf8");
        const ext = format === ExportFormat.JPEG ? "jpg" : format;
        const outFlag = flagString(parsed.flags, "out");
        const outputPath = outFlag
            ? resolve(isAbsolute(outFlag) ? outFlag : join(workspace, outFlag))
            : join(Paths.exportsDir(ctx.root), `${variant.id}.${ext}`);
        const renderer = new UnifiedRenderer();

        try {
            const result = await renderer.render({
                html,
                baseDir: dirname(Paths.confine(ctx.root, variant.htmlPath)),
                root: ctx.root,
                outputPath,
                format
            });
            ctx.setPhase(SessionPhase.EXPORT);
            return finish({
                ok: true,
                command: ArtCommand.EXPORT,
                summary: `Exported ${format} via ${result.engine} to ${result.path}`,
                data: {
                    path: result.path,
                    format: result.format,
                    engine: result.engine,
                    width: result.width,
                    height: result.height,
                    scope: ContextResolver.describe(resolution)
                }
            }, json);
        } finally {
            await renderer.close();
        }
    }

    if (Commands.isCommand(parsed.command)) {
        ctx.setPhase(SessionPhase.LIVE);
        const meta = CommandRegistry.find((item) => item.id === parsed.command);
        return finish({
            ok: true,
            command: parsed.command,
            summary: meta?.summary ?? parsed.command,
            data: {
                instruction: "Apply this command to the active artwork HTML, re-render, then wait for accept/reject in the studio.",
                quality: QualityStandard,
                techniques: Techniques.forBrief(ctx.project().brief)
            }
        }, json);
    }

    throw ArtErrors.project(`Unknown command: ${parsed.command}. See artdirector help.`);
}

/**
 * Registers an agent-written HTML file as a variant.
 *
 * Paths are confined to the active project root, so a temporary session can
 * never read a file from the repository and call it artwork.
 *
 * @param ctx Project context
 * @param flags Parsed flags
 * @param workspace User working directory
 * @returns Command result
 */
function addVariant(
    ctx: ProjectContext,
    flags: Record<string, string | boolean>,
    workspace: string
): CommandResult {
    const id = flagString(flags, "id") ?? Ids.short();
    const file = flagString(flags, "file");
    const requested = file
        ? resolve(isAbsolute(file) ? file : join(workspace, file))
        : join(ctx.root, ".artdirector", "variants", id, "artwork.html");
    const abs = Paths.confine(ctx.root, requested);

    if (!existsSync(abs)) {
        throw ArtErrors.project(`Variant HTML is missing: ${abs}. Write the file before registering it.`);
    }

    const source = readFileSync(abs, "utf8");
    const localized = TemplateApply.materialize(source, dirname(abs), dirname(abs));

    if (localized !== source) {
        writeFileSync(abs, localized, "utf8");
    }

    const htmlPath = Paths.posix(relative(ctx.root, abs));
    const formatFlag = flagString(flags, "format");
    // The artboard's own data-width and data-height win over the brief's default format.
    const declared = /data-width="\d+"/.test(localized) && /data-height="\d+"/.test(localized)
        ? HtmlDocument.dimensions(localized)
        : undefined;
    const dims = (formatFlag ? Formats.byId(formatFlag) : undefined)
        ?? declared
        ?? Formats.byId(ctx.project().brief.formatId ?? "")
        ?? Formats.defaultFor(ctx.project().brief.category);
    const width = Number(flagString(flags, "width") ?? dims.width);
    const height = Number(flagString(flags, "height") ?? dims.height);
    const formatId = formatFlag ?? Formats.match(width, height)?.id;
    const variant: ArtworkVariant = {
        id,
        title: flagString(flags, "title") ?? id,
        direction: (flagString(flags, "direction") as VisualDirection | undefined)
            ?? ctx.project().selectedDirection
            ?? VisualDirection.EDITORIAL_TYPOGRAPHIC,
        status: VariantStatus.DRAFT,
        createdAt: new Date().toISOString(),
        htmlPath,
        width,
        height,
        templateId: flagString(flags, "template"),
        formatId,
        notes: flagString(flags, "notes")
    };

    ctx.upsertVariant(variant);
    ctx.setPhase(SessionPhase.GENERATE);

    return {
        ok: true,
        command: "variants add",
        summary: `Registered ${id} from ${htmlPath}`,
        data: {
            variant,
            htmlPath,
            absolutePath: abs
        }
    };
}

/**
 * Prints JSON or text and returns the result.
 *
 * @param result Result
 * @param json JSON mode
 * @returns Result
 */
function finish(result: CommandResult, json: boolean): CommandResult {
    if (json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log(result.summary);
    }

    return result;
}

/**
 * Opens a URL with the platform opener. Failure is non-fatal.
 *
 * @param url Studio URL
 */
function openUrl(url: string): void {
    const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    execFile(cmd, args, () => undefined);
}

/**
 * Stores `--lang` on the project so the studio opens in the user's language.
 *
 * @param ctx Project context
 * @param flags Parsed flags
 */
function applyLanguage(ctx: ProjectContext, flags: Parameters<typeof flagString>[0]): void {
    const value = flagString(flags, "lang")?.trim().toLowerCase().slice(0, 2);

    if (value === undefined) {
        return;
    }

    if (value !== "en" && value !== "pt" && value !== "es") {
        throw ArtErrors.project(`Unsupported --lang "${flagString(flags, "lang")}". Use en, pt, or es.`);
    }

    if (ctx.project().language !== value) {
        ctx.setLanguage(value);
    }
}
