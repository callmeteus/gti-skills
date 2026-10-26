import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ArtworkAudit } from "../audit";
import { CommandRegistry, Commands } from "../commands";
import {
    ArtCommand,
    ArtErrors,
    ExportFormat,
    Paths,
    SessionPhase,
    VariantStatus,
    VisualDirection,
    type CommandResult
} from "../core";
import { CritiquePrompts, Directions, Formats, QualityStandard } from "../design";
import { DemoWorkflow } from "../demo";
import { SkillInstall, type AgentId } from "../install";
import { UnifiedRenderer } from "../renderer";
import { startStudio } from "../server";
import { ProjectContext } from "../session";
import { TemplateApply, TemplateCatalog } from "../templates";
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
    const root = flagString(parsed.flags, "root") ?? process.cwd();

    if (parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
        return finish({
            ok: true,
            command: "help",
            summary: helpText()
        }, json);
    }

    if (parsed.command === "init") {
        const ctx = ProjectContext.create({
            name: flagString(parsed.flags, "name") ?? "Untitled project",
            root,
            brief: {
                goal: flagString(parsed.flags, "goal") ?? ""
            }
        });
        return finish({
            ok: true,
            command: ArtCommand.INIT,
            summary: `Initialized ArtDirector project at ${ctx.root}`,
            data: {
                project: ctx.project(),
                session: ctx.session()
            }
        }, json);
    }

    if (parsed.command === "install") {
        const agent = (flagString(parsed.flags, "agent") ?? "opencode") as AgentId | "all";
        const dest = flagString(parsed.flags, "dest") ?? root;
        const installed = SkillInstall.run({
            agent,
            dest
        });

        if (agent === "opencode" || agent === "all") {
            SkillInstall.writeOpenCodeHint(dest);
        }

        return finish({
            ok: true,
            command: "install",
            summary: `Installed artdirector skill: ${installed.join(", ")}`,
            data: { installed }
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

    const ctx = openOrThrow(parsed.command, root);

    if (parsed.command === "status" || parsed.command === ArtCommand.RESUME) {
        return finish({
            ok: true,
            command: parsed.command,
            summary: `Project ${ctx.project().name} / phase ${ctx.session().phase}`,
            data: {
                project: ctx.project(),
                session: ctx.session(),
                variants: ctx.variants(),
                pendingEvent: ctx.pendingEvent()
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
        const port = Number(flagString(parsed.flags, "port") ?? 4730);
        const started = await startStudio({
            ctx,
            port
        });
        ctx.setPhase(parsed.command === ArtCommand.LIVE ? SessionPhase.LIVE : SessionPhase.SHAPE);

        if (flagBool(parsed.flags, "open")) {
            openUrl(started.url);
        }

        return finish({
            ok: true,
            command: parsed.command,
            summary: `Studio on ${started.url}`,
            data: {
                url: started.url,
                port: started.port,
                bind: "127.0.0.1",
                tokenPath: join(ctx.stateDir(), "token")
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
                    templates: TemplateCatalog.list().map((item) => item.id)
                }
            }, json);
        }

        const spec = TemplateCatalog.read(templateId);
        const format = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
        const tokens = TemplateApply.tokens({
            brand: ctx.project().brand,
            brief: ctx.project().brief,
            formatId: spec.formatId
        });
        const html = TemplateApply.render(spec, tokens);
        const id = templateId;
        const htmlPath = `.artdirector/variants/${id}/artwork.html`;
        const abs = Paths.confine(ctx.root, htmlPath);
        const { mkdirSync, writeFileSync } = await import("node:fs");
        mkdirSync(join(ctx.root, ".artdirector", "variants", id), { recursive: true });
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
            data: { htmlPath }
        }, json);
    }

    if (parsed.command === "variants") {
        return finish({
            ok: true,
            command: "variants",
            summary: `${ctx.variants().length} variants`,
            data: { variants: ctx.variants() }
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
        const report = await ArtworkAudit.run(Paths.confine(ctx.root, variant.htmlPath), variant);
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
        const outputPath = flagString(parsed.flags, "out") ?? join(Paths.exportsDir(ctx.root), `${variant.id}.${ext}`);
        const renderer = new UnifiedRenderer();

        try {
            const result = await renderer.render({
                html,
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
                    height: result.height
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
 * Opens an existing project, or explains that init is required.
 *
 * @param command Command name
 * @param root Search root
 * @returns Context
 */
function openOrThrow(command: string, root: string): ProjectContext {
    if (command === "init" || command === "help" || command === "install" || command === "demo") {
        return ProjectContext.create({
            name: "tmp",
            root
        });
    }

    return ProjectContext.open(root);
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
