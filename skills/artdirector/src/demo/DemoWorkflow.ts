import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
import { UnifiedRenderer } from "../renderer";
import { ProjectContext } from "../session";
import { editorialCoverHtml, infographicHtml, promoPosterHtml } from "./DemoArtworks";

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
 * Runs init → brief → shape → generate → live edit → accept → audit → export
 * without an LLM, using three authored HTML compositions.
 */
export namespace DemoWorkflow {
    /**
     * Creates demonstration artifacts under `outDir`.
     *
     * @param outDir Destination directory
     * @param render Whether to capture PNG/JPEG
     * @returns Demo result
     */
    export async function run(outDir: string, render = true): Promise<DemoResult> {
        mkdirSync(outDir, { recursive: true });
        const ctx = ProjectContext.create({
            name: "ArtDirector demonstration",
            root: outDir,
            brand: {
                name: "Northfold Press",
                tagline: "Type as image",
                voice: "editorial, exact, unhurried"
            },
            brief: {
                goal: "Show three distinct HTML-rendered visual directions",
                audience: "designers evaluating ArtDirector",
                category: ArtworkCategory.COVER,
                formatId: "cover-16x9",
                density: VisualDensity.BALANCED,
                productionMode: ProductionMode.ART_DIRECTION,
                copy: {
                    title: "The Geometry of Quiet",
                    subtitle: "Vol. 04"
                }
            }
        });

        ctx.selectDirection(VisualDirection.EDITORIAL_TYPOGRAPHIC, [
            VisualDirection.BOLD_PROMOTIONAL,
            VisualDirection.TECHNICAL_INFOGRAPHIC
        ]);

        const pieces = [
            {
                id: "editorial",
                title: "The Geometry of Quiet",
                direction: VisualDirection.EDITORIAL_TYPOGRAPHIC,
                width: 1600,
                height: 2000,
                html: editorialCoverHtml()
            },
            {
                id: "promo",
                title: "Night Market",
                direction: VisualDirection.BOLD_PROMOTIONAL,
                width: 1080,
                height: 1080,
                html: promoPosterHtml()
            },
            {
                id: "info",
                title: "How HTML Graphics Are Made",
                direction: VisualDirection.TECHNICAL_INFOGRAPHIC,
                width: 1080,
                height: 1920,
                html: infographicHtml()
            }
        ];

        const renderer = new UnifiedRenderer();
        const exports: string[] = [];
        const variants: DemoResult["variants"] = [];

        try {
            for (const piece of pieces) {
                const htmlPath = `.artdirector/variants/${piece.id}/artwork.html`;
                const abs = Paths.confine(outDir, htmlPath);
                mkdirSync(join(outDir, ".artdirector", "variants", piece.id), { recursive: true });
                writeFileSync(abs, piece.html, "utf8");
                ctx.upsertVariant({
                    id: piece.id,
                    title: piece.title,
                    direction: piece.direction,
                    status: VariantStatus.DRAFT,
                    createdAt: new Date().toISOString(),
                    htmlPath,
                    width: piece.width,
                    height: piece.height,
                    notes: "Demonstration artifact. HTML/CSS/SVG only."
                });
            }

            const liveHtml = applyLiveEdit(editorialCoverHtml());
            const livePath = Paths.confine(outDir, ".artdirector/variants/editorial/artwork.html");
            writeFileSync(livePath, liveHtml, "utf8");
            ctx.enqueueEvent({
                id: Ids.short(),
                type: LiveEventType.GENERATE,
                createdAt: new Date().toISOString(),
                acknowledged: true,
                action: ArtCommand.BOLDER,
                prompt: "Increase the issue number scale and ink density on the kicker.",
                variantId: "editorial",
                count: 1
            });
            const accepted = ctx.variant("editorial");
            accepted.status = VariantStatus.ACCEPTED;
            ctx.upsertVariant(accepted);
            const project = ctx.project();
            project.acceptedVariantId = "editorial";
            project.activeVariantId = "editorial";
            ctx.writeProject(project);
            ctx.setPhase(SessionPhase.DONE);

            for (const piece of pieces) {
                const htmlPath = Paths.confine(outDir, `.artdirector/variants/${piece.id}/artwork.html`);
                const report = await ArtworkAudit.run(
                    htmlPath,
                    {
                        width: piece.width,
                        height: piece.height
                    },
                    renderer
                );
                let pngPath: string | undefined;

                if (render) {
                    const png = join(outDir, "exports", `${piece.id}.png`);
                    const jpg = join(outDir, "exports", `${piece.id}.jpg`);
                    await renderer.render({
                        html: piece.id === "editorial" ? liveHtml : piece.html,
                        outputPath: png,
                        format: ExportFormat.PNG
                    });
                    await renderer.render({
                        html: piece.id === "editorial" ? liveHtml : piece.html,
                        outputPath: jpg,
                        format: ExportFormat.JPEG,
                        quality: 88
                    });
                    pngPath = png;
                    exports.push(png, jpg);
                }

                variants.push({
                    id: piece.id,
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
            acceptedId: "editorial",
            liveEdit: "Kicker type increased from 13px to 18px and tracking tightened after Live Mode accept.",
            exports
        };
    }
}

/**
 * Applies the scripted Live Mode edit to the editorial piece.
 *
 * @param html Original HTML
 * @returns Edited HTML
 */
function applyLiveEdit(html: string): string {
    return html
        .replace("font-size: 13px;", "font-size: 18px;")
        .replace("letter-spacing: 0.42em;", "letter-spacing: 0.28em;")
        .replace("Northfold Press / Vol. 04 Autumn", "Northfold Press / Vol. 04 accepted live");
}
