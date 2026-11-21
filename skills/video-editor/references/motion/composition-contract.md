# Composition contract

A motion composition is one standalone HTML file. It uses HTML, CSS, inline SVG, and small JavaScript. It renders the same frame every time for the same time value.

## Required shape

```html
<!doctype html>
<html><head><meta charset="utf-8"><style>... ...</style></head>
<body>
  <main id="stage" data-width="1080" data-height="1920" data-duration="1" data-fps="30">
    ... authored, readable, multi-line markup ...
  </main>
  <script>
    window.__ready = false;
    window.__seek = function (t) {
      // derive every visual property from t alone
    };
    window.__ready = true;
    window.__seek(0);
  </script>
</body></html>
```

The renderer sets the browser viewport to `data-width` by `data-height`, waits for `window.__ready === true` and a `__seek` function, then calls `__seek(t)` once per frame at `t = index / fps` and screenshots the page.

## Determinism rules

- Derive transforms, opacity, and text from `t` only. No `setTimeout`, `requestAnimationFrame`, `Date.now()`, random values, or `.play()`.
- Use a progress helper such as `clamp(t, start, duration)` and compute a value from it. Forward seeking and backward seeking must look identical.
- Set every animated property on every call, including at `t = 0` and at the end. Do not rely on a previous frame.
- Keep `data-duration` at least as long as the last animated moment. The renderer may be given a shorter `--duration`; that controls how many frames it captures.
- Keep copy as native HTML text in clearly marked sections so it is easy to replace. Do not generate the title from a string inside JavaScript.

## Brand kit variables

`motion new` injects the brand kit as CSS custom properties:

| Variable | Source in `brand.json` |
|----------|------------------------|
| `--brand-<role>` | each key under `colors`, for example `--brand-primary` |
| `--font-<role>` | each key under `fonts`, for example `--font-display` |

A composition should reference these variables instead of hardcoding brand colors. It can use neutral values for background plates and shadows. `brand.json` is read from the path passed with `--brand`; missing keys fall back to the default kit.

## Safe area

Platform presets reserve a share of the frame for interface UI: Reels and Shorts 18%, TikTok 22%, YouTube 8%. For a portrait composition, keep primary text and calls to action above that bottom band. The review page draws the same band over its phone preview.

## Output

`motion render` writes a fresh file in `scope.exportsDir` unless `--out` names a destination. MP4 uses x264 with yuv420p. `--alpha` writes WebM with VP9 and yuva420p from transparent screenshots; use that for overlays. Each command prints `checks` measured by ffprobe: size, fps, duration, frame count, and codec.
