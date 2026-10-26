/**
 * Small Lucide subset inlined for templates and the studio.
 * Lucide is ISC. Feather-derived icons also carry MIT. See NOTICE.md.
 */
export interface LucideIcon {
    name: string;
    svg: string;
}

const SvgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
const SvgClose = `</svg>`;

/**
 * Named Lucide paths used by ArtDirector.
 */
export const LucideIcons: LucideIcon[] = [
    {
        name: "type",
        svg: `${SvgOpen}<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>${SvgClose}`
    },
    {
        name: "layout",
        svg: `${SvgOpen}<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>${SvgClose}`
    },
    {
        name: "palette",
        svg: `${SvgOpen}<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>${SvgClose}`
    },
    {
        name: "image",
        svg: `${SvgOpen}<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>${SvgClose}`
    },
    {
        name: "check",
        svg: `${SvgOpen}<path d="M20 6 9 17l-5-5"/>${SvgClose}`
    },
    {
        name: "x",
        svg: `${SvgOpen}<path d="M18 6 6 18"/><path d="m6 6 12 12"/>${SvgClose}`
    },
    {
        name: "chevron-right",
        svg: `${SvgOpen}<path d="m9 18 6-6-6-6"/>${SvgClose}`
    },
    {
        name: "mouse-pointer-2",
        svg: `${SvgOpen}<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>${SvgClose}`
    },
    {
        name: "scan",
        svg: `${SvgOpen}<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>${SvgClose}`
    },
    {
        name: "file-down",
        svg: `${SvgOpen}<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>${SvgClose}`
    },
    {
        name: "activity",
        svg: `${SvgOpen}<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>${SvgClose}`
    },
    {
        name: "layers",
        svg: `${SvgOpen}<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>${SvgClose}`
    }
];

/**
 * Lucide lookup.
 */
export namespace Lucide {
    /**
     * Returns an icon SVG by Lucide name.
     *
     * @param name Icon name
     * @returns SVG markup
     */
    export function svg(name: string): string {
        const found = LucideIcons.find((icon) => icon.name === name);

        if (!found) {
            throw new Error(`Unknown Lucide icon in ArtDirector subset: ${name}`);
        }

        return found.svg;
    }
}
