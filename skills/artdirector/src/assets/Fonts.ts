/**
 * Open-source fonts served from Bunny Fonts (Google Fonts mirror).
 * Individual families remain under SIL OFL or Apache 2.0 as published by their authors.
 */
export interface FontPairing {
    id: string;
    display: string;
    body: string;
    bunny: string;
}

/**
 * Pairings used by directions and templates.
 */
export const FontPairings: FontPairing[] = [
    {
        id: "editorial",
        display: "Fraunces",
        body: "IBM Plex Sans",
        bunny: "fraunces:400,600,700|ibm-plex-sans:400,500,600"
    },
    {
        id: "promo",
        display: "Archivo Black",
        body: "Space Grotesk",
        bunny: "archivo-black:400|space-grotesk:400,500,700"
    },
    {
        id: "swiss",
        display: "IBM Plex Sans",
        body: "IBM Plex Sans",
        bunny: "ibm-plex-sans:400,500,600,700|ibm-plex-mono:400,500"
    },
    {
        id: "geometric",
        display: "Syne",
        body: "IBM Plex Sans",
        bunny: "syne:400,600,700,800|ibm-plex-sans:400,500"
    },
    {
        id: "premium",
        display: "Newsreader",
        body: "IBM Plex Sans",
        bunny: "newsreader:400,600,700|ibm-plex-sans:400,500"
    },
    {
        id: "technical",
        display: "IBM Plex Sans",
        body: "IBM Plex Mono",
        bunny: "ibm-plex-sans:400,500,600|ibm-plex-mono:400,500"
    }
];

/**
 * Font helpers.
 */
export namespace Fonts {
    /**
     * CSS `@import` for a Bunny Fonts family list.
     *
     * @param families Bunny family query
     * @returns CSS import rule
     */
    export function importCss(families: string): string {
        return `@import url("https://fonts.bunny.net/css?family=${families}");`;
    }

    /**
     * Pairing by id, with editorial as fallback.
     *
     * @param id Pairing id
     * @returns Pairing
     */
    export function pairing(id: string): FontPairing {
        return FontPairings.find((item) => item.id === id) ?? (FontPairings[0] as FontPairing);
    }
}
