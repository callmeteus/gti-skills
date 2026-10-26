# Templates and original work

**Art direction is the default.** For a new piece, write original HTML at the level described in [../style/visual-language.md](../style/visual-language.md), using the effects toolkit. Templates are not style references and must not be used as a shortcut to a finished look.

**Template production** is for repeatable formats the user asks for, such as a weekly carousel or a series of data cards. `artdirector generate --template <id> --json` fills a library template with the brief, the brand, and its own defaults (`{{token|default}}`), writes it into the variant folder, and copies any local images it references into `assets/`.

Ids: `infographic`, `data-viz`, `carousel-slide`.

Pass your own values with a JSON file; keys are token names and image paths may be absolute or relative to the working folder:

```bash
"<skill-dir>/scripts/artdirector" generate --template carousel-slide --tokens ./tokens.json --json
```

The JSON result lists every token the template reads under `tokens`, with its default. Layers use `data-layer` so ClickClick-style modifications remain possible.

Assets: Bunny Fonts, the effects toolkit, user files, and public-domain or CC0 photos and SVGs with a row in `.artdirector/assets.json` (`origin`, `license`, `attribution`).
