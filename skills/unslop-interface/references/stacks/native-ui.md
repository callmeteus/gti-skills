# Native and Rust interfaces

The passes are the same for every stack: spacing, radius, color, icons, copy, data, structure, and states. What changes is where the values live and how you measure the result. Read this file when the interface is not a web page in a browser: egui, iced, Slint, gpui, or another native toolkit.

## First, find out whether a browser can render it

| Stack | Renders through | Measure with |
|-------|-----------------|--------------|
| Tauri, Wails, Electron | A web view over a web frontend | The probe and lintapple on the frontend's dev server URL |
| Dioxus, Leptos, Yew, Sycamore | The DOM when built for the web | The probe on the web build; screenshots for a desktop-only build |
| egui, eframe | Its own painter (immediate mode) | Screenshots, the source scan, and egui's debug overlays |
| iced | Its own renderer (wgpu or software) | Screenshots, the source scan, and `explain` |
| Slint | Its own renderer, `.slint` markup | Screenshots, the source scan, and the Slint live preview |
| gpui, Makepad, Druid, Xilem, Floem | Their own renderers | Screenshots and the source scan |

When a browser can render it, use the web workflow in SKILL.md. Otherwise the probe and lintapple cannot run, because there is no DOM. Measure the way this file describes.

## Measuring without a DOM

- **Screenshots:** capture the window before the passes and after each one at the same window size. Use the operating system's capture, or the toolkit's own (egui can take a viewport screenshot through `ViewportCommand::Screenshot`). Compare the pairs and list each change in the report.
- **Layout overlays:** turn on the toolkit's debug drawing to see every widget's rectangle, then check edges, gaps, and alignment against the guide lines of pass 4. In egui, the `Style::debug` options (debug on hover, show widget rectangles). In iced, wrap an element with `.explain(color)` to draw the layout of its children. In Slint, use the live preview of the Slint language server or `slint-viewer`.
- **Source scan:** `node <skill-dir>/scripts/lintapple/tokens.mjs <source folder>` reads `.rs` and `.slint` files. It reports raw colors (`Color32::from_rgb`, `Color::from_rgb8`, `color!`, named constants such as `Color32::YELLOW`, and Slint hex literals) and treats a color `const` or `static`, or a Slint `property <color>` or `property <brush>`, as a token.
- **Say what was not measured:** the report states that the checks were visual and from source, not measured by the probe.

## Where each pass changes values

### egui

- **Tokens:** one module with the colors as `const` values (`pub const PRIMARY: Color32 = ...`) and one function that builds the `Style` and `Visuals` from them, applied once with `ctx.set_style` or `ctx.style_mut`. Never call `Color32::from_rgb` in a widget.
- **Spacing:** `style.spacing.item_spacing`, `button_padding`, `window_margin`, `menu_margin`, and `indent`, plus `Frame::inner_margin`. Use `ui.add_space` only for a gap the scale cannot express, and with a value from the scale.
- **Radius:** the corner radius of `visuals.widgets.*`, `window_*`, and `menu_*` (called `rounding` in older egui and `corner_radius` in newer versions), from one small set.
- **Type:** register the fonts once with `ctx.set_fonts`, and set `style.text_styles` to the scale instead of `RichText::size` on each label.

### iced

- **Tokens:** a custom `Theme` (or `Theme::custom` with a `Palette`) and style functions per widget kind that read from it. Widgets call `.style(theme_fn)`, never a color literal.
- **Spacing:** `.padding()` and `.spacing()` on containers, rows, and columns, from one scale defined as constants.
- **Radius:** the `border.radius` in the style functions, from the same small set.

### Slint

- **Tokens:** one `export global Palette { out property <color> primary: ...; }` (or the `Palette` of the standard widgets style) read everywhere as `Palette.primary`. No hex literal outside that global.
- **Spacing:** the `spacing` and `padding` properties of `HorizontalLayout`, `VerticalLayout`, and `GridLayout`, from constants in a global.
- **Radius:** `border-radius` from a global.

## Icons in native toolkits

Most native apps draw icons as hand-made SVG or PNG files loaded one by one (`include_bytes!`, `@image-url`). As with the web, suggest one icon library and do not swap it in yourself. Options that work without a browser:

- **An icon font:** load the font once and draw icons as text with a codepoint. Lucide, Phosphor, Font Awesome, Material Symbols, and Noto Emoji all ship font files. For egui, the `egui-phosphor` crate adds Phosphor as a font. In iced and Slint, load the font file and wrap the codepoints in named constants.
- **The library's SVG set:** copy the needed files from one library (for example Lucide's SVGs) instead of drawing new ones, so every icon shares one grid and one stroke width.

List the suggestion in the report's Suggestions section with the library you would pick and the files it would replace.

## Patterns that read the same in native apps

- A create row styled like one more item of a list becomes a "+" icon button in the list's header row, with a tooltip (`on_hover_text` in egui, `tooltip` in iced, a `TouchArea` with a popup in Slint).
- The signed-in user is an avatar (the picture from the identity provider, or initials on a circle) that opens an account menu, and sign-out is an icon button with a tooltip.
- All-caps section labels become sentence case; pill-shaped list items become the list radius of pass 2.
