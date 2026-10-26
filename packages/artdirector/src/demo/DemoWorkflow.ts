import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { ArtworkAudit } from "../audit";
import {
    ArtCommand,
    ArtworkCategory,
    ExportFormat,
    Ids,
    LiveEventType,
    Paths,
    ProductionMode,
    SessionPhase,
    VariantStatus,
    VisualDensity,
    VisualDirection
} from "../core";
import { Formats } from "../design";
import { UnifiedRenderer } from "../renderer";
import { ProjectContext } from "../session";
import { TemplateApply, TemplateCatalog } from "../templates";

/**
 * Result of the scripted end-to-end demonstration.
 */
export interface DemoResult {
    root: string;
    variants: Array<{
        id: string;
        direction: VisualDirection;
        htmlPath: string;
        pngPath?: string;
        auditPassed: boolean;
    }>;
    acceptedId: string;
    liveEdit: string;
    exports: string[];
}

/**
 * Library templates the pipeline check fills, with the direction recorded for each.
 */
const DemoPieces: Array<{ templateId: string; direction: VisualDirection }> = [
    { templateId: "infographic", direction: VisualDirection.TECHNICAL_INFOGRAPHIC },
    { templateId: "data-viz", direction: VisualDirection.DATA_DRIVEN_EDITORIAL },
    { templateId: "carousel-slide", direction: VisualDirection.SWISS_INSPIRED }
];

/**
 * The piece that receives the scripted Live Mode edit and is accepted.
 */
const AcceptedId = "infographic";

/**
 * Runs init → brief → shape → generate → live edit → accept → audit → export
 * without an LLM, filling three library templates with their default copy.
 * It exercises the pipeline; it is not a style reference.
 */
export namespace DemoWorkflow {
    /**
     * Creates pipeline-check artifacts under `outDir`.
     *
     * @param outDir Destination directory
     * @param render Whether to capture PNG/JPEG
     * @returns Demo result
     */
    export async function run(outDir: string, render = true): Promise<DemoResult> {
        mkdirSync(outDir, { recursive: true });
        const ctx = ProjectContext.create({
            name: "Art Director pipeline check",
            root: outDir,
            brief: {
                goal: "Exercise the full Art Director pipeline without a language model",
                category: ArtworkCategory.INFOGRAPHIC,
                formatId: "infographic-portrait",
                density: VisualDensity.BALANCED,
                productionMode: ProductionMode.TEMPLATE
            }
        });

        ctx.selectDirection(VisualDirection.TECHNICAL_INFOGRAPHIC, [
            VisualDirection.DATA_DRIVEN_EDITORIAL,
            VisualDirection.SWISS_INSPIRED
        ]);

        const renderer = new UnifiedRenderer();
        const exports: string[] = [];
        const variants: DemoResult["variants"] = [];

        try {
            for (const piece of DemoPieces) {
                const spec = TemplateCatalog.read(piece.templateId);
                const format = Formats.byId(spec.formatId) ?? Formats.defaultFor(spec.category);
                const htmlPath = `.artdirector/variants/${piece.templateId}/artwork.html`;
                const abs = Paths.confine(outDir, htmlPath);
                mkdirSync(dirname(abs), { recursive: true });
                const filled = TemplateApply.render(spec, {
                    width: String(format.width),
                    height: String(format.height)
                });
                writeFileSync(abs, TemplateApply.materialize(filled, dirname(abs), outDir), "utf8");
                ctx.upsertVariant({
                    id: piece.templateId,
                    title: spec.title,
                    direction: piece.direction,
                    status: VariantStatus.DRAFT,
                    createdAt: new Date().toISOString(),
                    htmlPath,
                    width: format.width,
                    height: format.height,
                    templateId: piece.templateId,
                    formatId: format.id,
                    notes: "Pipeline check. HTML, CSS, and SVG only."
                });
            }

            const livePath = Paths.confine(outDir, `.artdirector/variants/${AcceptedId}/artwork.html`);
            writeFileSync(livePath, applyLiveEdit(readFileSync(livePath, "utf8")), "utf8");
            ctx.enqueueEvent({
                id: Ids.short(),
                type: LiveEventType.GENERATE,
                createdAt: new Date().toISOString(),
                acknowledged: true,
                action: ArtCommand.BOLDER,
                prompt: "Make the headline larger.",
                variantId: AcceptedId,
                count: 1
            });
            const accepted = ctx.variant(AcceptedId);
            accepted.status = VariantStatus.ACCEPTED;
            ctx.upsertVariant(accepted);
            const project = ctx.project();
            project.acceptedVariantId = AcceptedId;
            project.activeVariantId = AcceptedId;
            ctx.writeProject(project);
            ctx.setPhase(SessionPhase.DONE);

            for (const piece of DemoPieces) {
                const variant = ctx.variant(piece.templateId);
                const htmlPath = Paths.confine(outDir, variant.htmlPath);
                const report = await ArtworkAudit.run(htmlPath, variant, renderer, outDir);
                let pngPath: string | undefined;

                if (render) {
                    const html = readFileSync(htmlPath, "utf8");
                    const png = join(outDir, "exports", `${piece.templateId}.png`);
                    const jpg = join(outDir, "exports", `${piece.templateId}.jpg`);
                    await renderer.render({ html, baseDir: dirname(htmlPath), root: outDir, outputPath: png, format: ExportFormat.PNG });
                    await renderer.render({ html, baseDir: dirname(htmlPath), root: outDir, outputPath: jpg, format: ExportFormat.JPEG, quality: 88 });
                    pngPath = png;
                    exports.push(png, jpg);
                }

                variants.push({
                    id: piece.templateId,
                    direction: piece.direction,
                    htmlPath,
                    pngPath,
                    auditPassed: report.passed
                });
            }
        } finally {
            await renderer.close();
        }

        return {
            root: outDir,
            variants,
            acceptedId: AcceptedId,
            liveEdit: "Title type increased from 56px to 64px after Live Mode accept.",
            exports
        };
    }
}

/**
 * Applies the scripted Live Mode edit to the accepted piece.
 *
 * @param html Original HTML
 * @returns Edited HTML
 */
function applyLiveEdit(html: string): string {
    return html
        .replace("font-size: 56px;", "font-size: 64px;")
        .replace("</body>", "    <!-- accepted live: title enlarged after Live Mode -->\n</body>");
}
