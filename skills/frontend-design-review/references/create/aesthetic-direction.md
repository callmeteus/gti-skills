# Aesthetic direction

Use this file in Mode 2 step 1, and when a Creative review checks the direction. The goal is an interface with a clear concept, executed with precision, that could not be mistaken for a default template.

## Commit before coding

Write these four answers down, in the report or a comment, before the first line of UI code:

- **Purpose:** what problem the interface solves, and who uses it.
- **Tone:** one direction, for example minimal, maximalist, retro-futuristic, organic, luxury, playful, editorial, brutalist, art deco, soft or pastel, industrial. Pick one and commit; a blend of three reads as none.
- **Constraints:** framework, performance budget, accessibility level, browsers, existing design system.
- **Differentiation:** the one thing that makes this interface distinctive and right for its context.

## Guidelines

- **Typography:** choose distinctive faces that serve the tone. Pair a display face with a refined body face. Avoid the default picks that make generated UIs look alike: Inter, Roboto, Arial, and Space Grotesk. When the design system sets a font, keep it and express the direction elsewhere.
- **Color and theme:** a cohesive palette defined as CSS variables. A dominant color with sharp accents beats a timid palette spread evenly across the screen. Keep text contrast at WCAG 2.1 AA.
- **Motion:** prefer CSS only. One well-orchestrated page load with staggered reveals beats scattered micro-interactions. Respect `prefers-reduced-motion`.
- **Spatial composition:** asymmetry, overlap, diagonal flow, and grid-breaking elements, or controlled density. Use generous negative space on purpose, not by accident.
- **Backgrounds and texture:** gradient meshes, noise and grain overlays, geometric patterns, layered transparency, and dramatic shadows are available when the direction calls for them. Each one must belong to the chosen tone; see [unslop-handoff.md](unslop-handoff.md).

## Avoid

- Overused fonts and cliched color schemes, above all the purple-to-violet gradient on white or near-black.
- Predictable layouts: centered hero, three feature cards, testimonial row, footer, with nothing specific to the product.
- Cookie-cutter design with no context-specific character.

## Match the code to the vision

A maximalist direction needs elaborate code: layered elements, orchestrated motion, custom shapes. A minimalist direction needs restraint and precision: exact spacing, careful type, few and deliberate details. Both are production code: responsive, accessible, with every state built.
