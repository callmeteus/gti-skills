import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";

import { ArtworkAudit } from "../audit";
import { CommandRegistry, LiveActions } from "../commands";
import {
    ArtCommand,
    ArtErrors,
    Auth,
    ExportFormat,
    Ids,
    LiveEventType,
    Paths,
    SessionPhase,
    VariantStatus,
    VisualDirection,
    type ArtworkVariant,
    type LiveEvent
} from "../core";
import { CritiquePrompts, DirectionCatalog, Directions, Formats, OutputFormats, QualityStandard } from "../design";
import { HtmlDocument, UnifiedRenderer } from "../renderer";
import { ProjectContext } from "../session";
import { Effects, TemplateApply, TemplateCatalog } from "../templates";
import { Techniques } from "../techniques";
import { Http } from "./Http";

/**
 * Studio API. All routes assume the caller already passed token checks.
 */
export class StudioRoutes {
    /**
     * @param ctx Project context
     * @param renderer Shared renderer
     */
    constructor(
        private readonly ctx: ProjectContext,
        private readonly renderer: UnifiedRenderer
    ) {}

    /**
     * Dispatches a `/v1` request.
     *
     * @param method HTTP method
     * @param url Request URL
     * @param req Request
     * @param res Response
     */
    async handle(method: string, url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
        const path = url.pathname;

        if (method === "GET" && path === "/v1/session") {
            Http.json(res, 200, this.snapshot());
            return;
        }

        if (method === "GET" && path === "/v1/commands") {
            Http.json(res, 200, {
                ok: true,
                commands: CommandRegistry,
                liveActions: LiveActions
            });
            return;
        }

        if (method === "GET" && path === "/v1/directions") {
            Http.json(res, 200, {
                ok: true,
                directions: DirectionCatalog,
                suggested: Directions.suggest(this.ctx.project().brief.category)
            });
            return;
        }

        if (method === "POST" && path === "/v1/brief") {
            const body = await Http.jsonBody(req);
            const project = this.ctx.patchBrief(body as never);
            Http.json(res, 200, {
                ok: true,
                project
            });
            return;
        }

        if (method === "POST" && path === "/v1/brand") {
            const body = await Http.jsonBody(req);
            const project = this.ctx.patchBrand(body as never);
            Http.json(res, 200, {
                ok: true,
                project
            });
            return;
        }

        if (method === "POST" && path === "/v1/shape") {
            const body = await Http.jsonBody(req);
            const direction = body.direction as VisualDirection;
            const combined = (body.combined as VisualDirection[] | undefined) ?? [];
            const project = this.ctx.selectDirection(direction, combined);
            Http.json(res, 200, {
                ok: true,
                project
            });
            return;
        }

        if (method === "GET" && path === "/v1/variants") {
            Http.json(res, 200, {
                ok: true,
                variants: this.ctx.variants()
            });
            return;
        }

        if (method === "POST" && path === "/v1/variants") {
            const body = await Http.jsonBody(req);
            const variant = this.addVariant(body);
            Http.json(res, 200, {
                ok: true,
                variant
            });
            return;
        }

        if (method === "POST" && path === "/v1/variants/status") {
            const body = await Http.jsonBody(req);
            const variant = this.setStatus(String(body.id), body.status as VariantStatus);
            Http.json(res, 200, {
                ok: true,
                variant
            });
            return;
        }

        if (method === "POST" && path === "/v1/generate-template") {
            const body = await Http.jsonBody(req);
            const variants = this.generateFromTemplate(
                String(body.templateId ?? ""),
                body.formatIds,
                body.extra as Record<string, string> | undefined
            );
            Http.json(res, 200, {
                ok: true,
                variants,
                variant: variants[0]
            });
            return;
        }

        if (method === "GET" && path === "/v1/events/poll") {
            await this.poll(url, res);
            return;
        }

        if (method === "POST" && path === "/v1/events") {
            const body = await Http.jsonBody(req);
            const event = this.enqueue(body);
            Http.json(res, 200, {
                ok: true,
                event
            });
            return;
        }

        if (method === "POST" && path.startsWith("/v1/events/") && path.endsWith("/reply")) {
            const id = path.split("/")[3] ?? "";
            await Http.jsonBody(req);
            const event = this.ctx.acknowledge(id);
            Http.json(res, 200, {
                ok: true,
                event
            });
            return;
        }

        if (method === "POST" && path === "/v1/audit") {
            const body = await Http.jsonBody(req);
            const variant = this.ctx.variant(String(body.id));
            const htmlPath = Paths.confine(this.ctx.root, variant.htmlPath);
            const report = await ArtworkAudit.run(htmlPath, variant, this.renderer, this.ctx.root);
            this.ctx.setPhase(SessionPhase.AUDIT);
            Http.json(res, 200, {
                ok: true,
                report
            });
            return;
        }

        if (method === "POST" && path === "/v1/export") {
            const body = await Http.jsonBody(req);
            const id = String(body.id);
            const format = (body.format as ExportFormat | undefined) ?? ExportFormat.PNG;
            const result = await this.exportVariant(id, format);
            const ext = format === ExportFormat.JPEG ? "jpg" : format;
            const filename = `${id}.${ext}`;
            const buffer = result.buffer;

            res.writeHead(200, {
                "Content-Type": exportMimeType(format),
                "Content-Length": buffer.length,
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store"
            });
            res.end(buffer);
            return;
        }

        if (method === "GET" && path === "/v1/quality") {
            Http.json(res, 200, {
                ok: true,
                quality: QualityStandard,
                critique: CritiquePrompts,
                techniques: Techniques.list()
            });
            return;
        }

        throw ArtErrors.notFound(`Unknown API route: ${method} ${path}`);
    }

    /**
     * Full studio snapshot.
     *
     * @returns Snapshot
     */
    snapshot(): Record<string, unknown> {
        const project = this.ctx.project();
        return {
            ok: true,
            project,
            session: this.ctx.session(),
            variants: this.ctx.variants().map((item) => ({
                ...item,
                htmlFile: Paths.confine(this.ctx.root, item.htmlPath)
            })),
            formats: OutputFormats.map((item) => ({
                ...item,
                short: Formats.shortName(item)
            })),
            templates: TemplateCatalog.list().map((item) => ({
                id: item.id,
                title: item.title,
                category: item.category,
                formatId: item.formatId,
                layers: item.layers
            })),
            techniques: Techniques.forBrief(project.brief),
            liveActions: LiveActions,
            pendingEvent: this.ctx.pendingEvent(),
            queue: this.ctx.pendingEvents(),
            tokenPath: Auth.tokenPath(this.ctx.root)
        };
    }

    /**
     * Serves a variant HTML file confined to the project.
     *
     * @param id Variant id
     * @param res Response
     */
    artwork(id: string, res: ServerResponse): void {
        const variant = this.ctx.variant(id);
        const file = Paths.confine(this.ctx.root, variant.htmlPath);

        if (!existsSync(file)) {
            throw ArtErrors.notFound(`Artwork file missing: ${variant.htmlPath}`);
        }

        const html = HtmlDocument.mapLocalReferences(
            Effects.expand(readFileSync(file, "utf8")),
            (reference) => `/artwork/${encodeURIComponent(id)}/${reference.split("/").map(encodeURIComponent).join("/")}`
        );

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
        });
        res.end(html);
    }

    /**
     * Serves a file referenced by an artwork (photos, cutouts), relative to the artwork folder
     * and confined to the project.
     *
     * @param id Variant id
     * @param assetPath Path relative to the artwork HTML
     * @param res Response
     */
    artworkAsset(id: string, assetPath: string, res: ServerResponse): void {
        const variant = this.ctx.variant(id);
        const htmlFile = Paths.confine(this.ctx.root, variant.htmlPath);
        const file = Paths.confine(this.ctx.root, join(dirname(htmlFile), assetPath));

        if (!Http.file(res, file)) {
            throw ArtErrors.notFound(`Artwork asset missing: ${assetPath}`);
        }
    }

    /**
     * Adds a variant from agent-written HTML (path or inline).
     *
     * @param body Request body
     * @returns Variant
     */
    private addVariant(body: Record<string, unknown>): ArtworkVariant {
        const id = String(body.id ?? Ids.short());
        const html = typeof body.html === "string" ? body.html : undefined;
        const htmlPath = String(body.htmlPath ?? `.artdirector/variants/${id}/artwork.html`);
        const abs = Paths.confine(this.ctx.root, htmlPath);

        if (html) {
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, html, { encoding: "utf8", flag: "w" });
        } else if (!existsSync(abs)) {
            throw ArtErrors.project("Variant HTML is missing. Write the file before registering it.");
        }

        const dims = Formats.byId(this.ctx.project().brief.formatId ?? "") ?? Formats.defaultFor(this.ctx.project().brief.category);
        const width = Number(body.width ?? dims.width);
        const height = Number(body.height ?? dims.height);
        const formatId = typeof body.formatId === "string" && body.formatId
            ? body.formatId
            : Formats.match(width, height)?.id;
        const variant: ArtworkVariant = {
            id,
            title: String(body.title ?? id),
            direction: (body.direction as VisualDirection) ?? this.ctx.project().selectedDirection ?? VisualDirection.EDITORIAL_TYPOGRAPHIC,
            status: VariantStatus.DRAFT,
            createdAt: new Date().toISOString(),
            htmlPath,
            width,
            height,
            templateId: typeof body.templateId === "string" ? body.templateId : undefined,
            formatId,
            notes: typeof body.notes === "string" ? body.notes : undefined
        };

        this.ctx.upsertVariant(variant);
        this.ctx.setPhase(SessionPhase.GENERATE);
        return variant;
    }

    /**
     * Updates variant status and active/accepted pointers.
     *
     * @param id Variant id
     * @param status Next status
     * @returns Variant
     */
    private setStatus(id: string, status: VariantStatus): ArtworkVariant {
        const variant = this.ctx.variant(id);
        variant.status = status;
        this.ctx.upsertVariant(variant);
        const project = this.ctx.project();

        if (status === VariantStatus.SELECTED) {
            project.activeVariantId = id;
        } else if (status === VariantStatus.ACCEPTED) {
            project.acceptedVariantId = id;
            project.activeVariantId = id;
        }

        this.ctx.writeProject(project);
        return variant;
    }

    /**
     * Fills a library template into one variant per requested size.
     *
     * @param templateId Template id
     * @param formatIds Output sizes to make together
     * @param extra Extra tokens
     * @returns Variants
     */
    private generateFromTemplate(
        templateId: string,
        formatIds?: unknown,
        extra?: Record<string, string>
    ): ArtworkVariant[] {
        this.replaceTemplatePreview();
        const spec = TemplateCatalog.read(templateId);
        const project = this.ctx.project();
        const fallback = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
        const requested = Array.isArray(formatIds)
            ? formatIds.map((item) => String(item)).filter((id) => Formats.byId(id))
            : [];
        const formats = (requested.length ? requested : [fallback.id])
            .map((id) => Formats.byId(id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const unique = [...new Map(formats.map((item) => [item.id, item])).values()];

        return unique.map((format) => {
            const id = `template-${templateId}-${format.id}`;
            const variantDir = dirname(Paths.confine(this.ctx.root, `.artdirector/variants/${id}/artwork.html`));
            mkdirSync(variantDir, { recursive: true });
            const html = TemplateApply.materialize(TemplateApply.render(spec, TemplateApply.tokens({
                brand: project.brand,
                brief: project.brief,
                formatId: format.id,
                extra
            })), variantDir, this.ctx.root);

            return this.addVariant({
                id,
                html,
                title: spec.title,
                templateId,
                formatId: format.id,
                direction: project.selectedDirection,
                width: format.width,
                height: format.height
            });
        });
    }

    /**
     * Drops previously generated template variants so a sidebar pick replaces the preview.
     */
    private replaceTemplatePreview(): void {
        const project = this.ctx.project();
        const kept: ArtworkVariant[] = [];

        for (const variant of this.ctx.variants()) {
            if (!variant.templateId) {
                kept.push(variant);
                continue;
            }

            const abs = Paths.confine(this.ctx.root, variant.htmlPath);
            rmSync(dirname(abs), { recursive: true, force: true });

            if (project.activeVariantId === variant.id) {
                project.activeVariantId = undefined;
            }

            if (project.acceptedVariantId === variant.id) {
                project.acceptedVariantId = undefined;
            }
        }

        this.ctx.writeVariants(kept);
        this.ctx.writeProject(project);
    }

    /**
     * Enqueues a live event from the studio.
     *
     * @param body Request body
     * @returns Event
     */
    private enqueue(body: Record<string, unknown>): LiveEvent {
        const event: LiveEvent = {
            id: Ids.short(),
            type: (body.type as LiveEventType) ?? LiveEventType.GENERATE,
            createdAt: new Date().toISOString(),
            acknowledged: false,
            action: (body.action as ArtCommand | "freeform" | undefined) ?? "freeform",
            prompt: typeof body.prompt === "string" ? body.prompt : undefined,
            selection: body.selection as LiveEvent["selection"],
            variantId: typeof body.variantId === "string" ? body.variantId : this.ctx.project().activeVariantId,
            count: typeof body.count === "number" ? body.count : 3
        };
        this.ctx.setPhase(SessionPhase.LIVE);
        const session = this.ctx.session();
        session.liveEnabled = true;
        this.ctx.writeSession(session);
        return this.ctx.enqueueEvent(event);
    }

    /**
     * Long-polls for the next unacknowledged event.
     *
     * @param url Request URL
     * @param res Response
     */
    private async poll(url: URL, res: ServerResponse): Promise<void> {
        const waitMs = Math.min(Number(Http.query(url, "waitMs") ?? 25000), 60000);
        const started = Date.now();

        while (Date.now() - started < waitMs) {
            const pending = this.ctx.pendingEvent();

            if (pending) {
                Http.json(res, 200, {
                    ok: true,
                    event: pending
                });
                return;
            }

            await sleep(400);
        }

        Http.json(res, 200, {
            ok: true,
            event: {
                type: LiveEventType.TIMEOUT
            }
        });
    }

    /**
     * Exports a variant through the unified renderer.
     *
     * @param id Variant id
     * @param format Format
     * @returns Render result
     */
    private async exportVariant(id: string, format: ExportFormat) {
        const variant = this.ctx.variant(id);
        const htmlPath = Paths.confine(this.ctx.root, variant.htmlPath);
        const html = readFileSync(htmlPath, "utf8");
        this.ctx.setPhase(SessionPhase.EXPORT);
        return this.renderer.render({
            html,
            baseDir: dirname(htmlPath),
            root: this.ctx.root,
            format
        });
    }
}

/**
 * MIME type for an export format.
 *
 * @param format Export format
 * @returns MIME type
 */
function exportMimeType(format: ExportFormat): string {
    switch (format) {
        case ExportFormat.JPEG:
            return "image/jpeg";
        case ExportFormat.PDF:
            return "application/pdf";
        case ExportFormat.SVG:
            return "image/svg+xml";
        case ExportFormat.HTML:
            return "text/html; charset=utf-8";
        case ExportFormat.PNG:
        default:
            return "image/png";
    }
}

/**
 * Promise sleep.
 *
 * @param ms Milliseconds
 * @returns Timer promise
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
