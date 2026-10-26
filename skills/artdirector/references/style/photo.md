# Photos

Most professional social pieces are photo-led. A real photo, well treated, beats any amount of vector decoration. Art Director never generates images: photos come from the user or from openly licensed sources.

## Getting photos

1. **Ask the user first** for product shots, portraits, logos, or event photos. Use them as given; do not alter people's faces.
2. **Search openly licensed photos** when the user has none and agrees. Prefer CC0 and public domain.

   ```bash
   python3 <skill-dir>/scripts/photos/find_photos.py "smiling woman guitar" --license cc0 --limit 12
   python3 <skill-dir>/scripts/photos/find_photos.py "smiling woman guitar" --license cc0 --limit 12 --download ./photos
   ```

   The first command prints candidates as JSON. The second also downloads them and writes `credits.json` with creator, source, and license. Open the thumbnails, pick, and record every photo you use in `.artdirector/assets.json`.
3. **Remove the background** when the composition needs a cutout. This runs a local segmentation model, not a generative one:

   ```bash
   python3 <skill-dir>/scripts/photos/remove_background.py ./photos/portrait.jpg --install
   ```

   It writes `portrait-cutout.png` next to the source, trimmed to the subject. The first run downloads the model (about 170 MB); tell the user before running it. `--model birefnet-portrait` gives cleaner hair edges and downloads about 1 GB.

Put photos inside the project (next to the artwork or in its `assets/` folder) and reference them with relative paths. The studio and the exporter resolve relative paths from the artwork folder.

## Treatments

| Treatment | Effect | When |
|-----------|--------|------|
| Full bleed with scrim | `fx-scrim-bottom` and friends | News, announcements, portraits with text below |
| Cutout with shadow | `fx-cutout` | Subject placed into a designed scene |
| Cutout with rim light | `fx-rim` | Dark subject on a dark scene |
| Duotone | `fx-duotone` | Unify any photo with the palette; events, education, music |
| Duotone cutout | `fx-duotone fx-duotone-cutout` | Tinted subject on a colored field |
| Halftone black and white | `fx-halftone` | Collage, zine, fashion, retro |
| Ghost duplicate | `fx-ghost`, or a larger duotone copy behind | Sports and music energy |
| Sticker | `fx-sticker` | Playful collage, creator brands |

## Grading and placement

- **Grade toward the palette:** desaturate slightly, add contrast, and push shadows toward the field color. A cool photo on a warm board looks pasted.
- **Fade, never cut:** when a photo meets a solid field, fade the edge with a mask or scrim. Hard crop lines betray a rectangle.
- **Crop with intent:** cut at the waist, the shoulders, or mid-object; let the subject touch or leave the frame edge.
- **Eyes on a third:** place the eyes in the upper third, off center.
- **Lift dark subjects:** in duotone, raise `--duo-brightness` (1.2 to 1.5) so faces do not sink into the dark color.
- **Drop backgrounds without a cutout:** a photo on a white backdrop can sit on a colored field with `mix-blend-mode: multiply`; a photo on a black backdrop can use `screen`.
- **Resolution:** a subject that fills most of a 1080 px board needs a source at least 1000 px on that side. Upscaled cutouts look soft; hide softness with grain or a duotone, or use the photo smaller.
