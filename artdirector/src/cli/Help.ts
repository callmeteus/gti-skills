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
  artdirector generate --template social-post
  artdirector export --id <variant> --format png
  artdirector install --agent opencode
  artdirector demo [--out dir]

Workflow commands:
${commands}

Also:
  status        Print project, session, and variants as JSON
  variants      List variants
  install       Copy the unified skill into an agent
  demo          Run the end-to-end demonstration
  help          Show this help

All commands accept --json. Artwork is HTML rendered in a browser.
ArtDirector never calls an image-generation API.
`;
}
