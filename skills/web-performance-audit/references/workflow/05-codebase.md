# Phase 5: Codebase analysis

Skip this phase when auditing a site without access to its code.

## Goal

Tie the measured problems to the build setup and the code that causes them, so each fix names a file.

## Detect the stack

| Tool | Config files |
|------|--------------|
| Webpack | `webpack.config.js`, `webpack.*.js` |
| Vite | `vite.config.js`, `vite.config.ts` |
| Rollup | `rollup.config.js`, `rollup.config.mjs` |
| esbuild | `esbuild.config.js`, build scripts calling esbuild |
| Parcel | `.parcelrc`, `parcel` field in `package.json` |
| Next.js | `next.config.js`, `next.config.mjs`, `next.config.ts` |
| Nuxt | `nuxt.config.js`, `nuxt.config.ts` |
| SvelteKit | `svelte.config.js` |
| Astro | `astro.config.mjs` |
| Remix, React Router | `remix.config.js`, `react-router.config.ts` |

Also read `package.json` for framework dependencies and build scripts. Use the framework's own tools first (Next.js `next/image`, `next/font`, and `dynamic`; Nuxt image and lazy components; Astro islands).

## Check

- **Bundle size:** run the project's analyzer if it has one, or build and list the largest output files. Map the large bundles from Phase 3 to their source.
- **Tree-shaking:** production mode, `sideEffects` in `package.json`, barrel files that re-export everything, and libraries imported wholesale (`lodash`, `moment`, icon packs). Prefer per-function imports or smaller libraries.
- **Code splitting:** routes and heavy widgets (charts, editors, maps) loaded with dynamic `import()` instead of in the main bundle.
- **Unused CSS:** CSS-in-JS runtime cost versus extracted CSS; Tailwind `content` paths covering every template.
- **Polyfills:** `@babel/preset-env` targets and `useBuiltIns`, whole `core-js` imports, and a `browserslist` that targets more browsers than the users have.
- **Images:** a responsive image component or `srcset`, modern formats, explicit `width` and `height`, and `loading="lazy"` only below the fold, never on the LCP image.
- **Fonts:** self-hosted, subset, `font-display: swap` or `optional`, and preloading only the fonts used above the fold.
- **Minification and compression:** terser, esbuild, or swc in production; Brotli or gzip in the server or CDN config.
- **Source maps:** not shipped inline in production bundles.

## When you change code

Change one cause at a time, rebuild, and trace again under the same conditions as Phase 1. Report the before and after for the metric that the change targets.
