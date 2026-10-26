import { CommandRegistry } from "../commands";

/**
 * CLI help text.
 *
 * @returns Help
 */
export function helpText(): string {
    const commands = CommandRegistry.map((item) => `  ${item.id.padEnd(12)} ${item.summary}`).join("\n");

    return `ArtDirector - local-first HTML/CSS/SVG graphic design studio

Usage:
  artdirector <command> [flags]
  artdirector studio [--port 4730]
  artdirector generate --template horror-drip-promo
  artdirector export --id <variant> --format png
  artdirector demo [--out dir]

Workflow commands:
${commands}

Also:
  status        Print project, session, and variants as JSON
  variants      List variants
  demo          Run the end-to-end demonstration
  help          Show this help

All commands accept --json. Pass --lang en|pt|es (on init or studio) to set the studio language. Artwork is HTML rendered in a browser.
ArtDirector never calls an image-generation API.
`;
}
