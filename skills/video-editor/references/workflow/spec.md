# Timeline specification

Version 1 is one JSON document. The CLI reads it from `scope.specPath` or from `--spec <path>`. All times are seconds. The agent may write the file directly instead of using `scene add` and `music add`.

Top level fields:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `version` | number | required | Must be `1` |
| `name` | string | `untitled` | Used in the default export name |
| `canvas.width` | number | 1920 | Output width in pixels |
| `canvas.height` | number | 1080 | Output height in pixels |
| `canvas.fps` | number | 30 | Output frame rate |
| `canvas.background` | string | `black` | Fill color for `contain` padding |
| `scenes` | array | required | Ordered pieces of the video, at least one |
| `music` | array | empty | Tracks mixed over the whole timeline |
| `output.format` | string | `mp4` | `mp4`, `webm`, `gif`, or `mov` |
| `output.quality` | string | `final` | `draft` is faster and lower quality |
| `output.fps` | number | canvas fps | Output frame rate override |

## Scenes

A scene is one consecutive piece of the result. Scenes play in array order; there is no overlap or free position on the track.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | string | required | Unique in the timeline |
| `source` | string | required | Video or image path, absolute or relative to the workspace |
| `in` | number | 0 | Source in point; ignored for images |
| `duration` | number | required | Length on the timeline, greater than 0 |
| `fit` | string | `cover` | `cover` crops, `contain` pads, `fill` stretches |
| `text` | array | empty | Text overlays drawn over the scene |
| `fadeIn` | number | 0 | Fade in at the scene start |
| `fadeOut` | number | 0 | Fade out at the scene end |
| `volume` | number | 1 | Scene audio volume; 0 mutes it |

Relative sources resolve in this order: the workspace, the request folder, the request `media/` folder, and `media/` plus the file name. Put media in `scope.mediaDir` when the request should be self contained.

## Text overlays

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `value` | string | required | Text to draw |
| `x` | string | `(w-text_w)/2` | ffmpeg drawtext x expression |
| `y` | string | `(h-text_h)/2` | ffmpeg drawtext y expression |
| `fontSize` | number | 72 | Font size in pixels |
| `fontColor` | string | `white` | Font color |
| `fontFile` | string | system font | Path to a `.ttf` or `.otf` file; without one the first existing common system font is used |
| `box` | boolean | false | Draw a box behind the text |
| `boxColor` | string | `black@0.5` | Box color and opacity |
| `start` | number | 0 | Seconds into the scene when the text appears |
| `end` | number | scene duration | Seconds into the scene when it disappears |

Expressions such as `h-120` or `(w-text_w)/2` are passed to ffmpeg. The planner sets `expansion=none`, so percent signs in the text are literal.

## Music tracks

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | string | required | Unique label |
| `source` | string | required | Audio or video file with an audio stream |
| `in` | number | 0 | Source in point |
| `volume` | number | 1 | Track volume |
| `fadeIn` | number | 0 | Fade in at the start |
| `fadeOut` | number | 0 | Fade out at the end of the timeline |

## What the planner does with it

Each scene is trimmed, timestamp normalized, scaled or padded to the canvas, frame rate normalized, given its overlays, then faded. Scene video segments are joined with `concat`. Scene audio is concatenated in the same order and mixed with music using `amix`. If no stream has audio, the render is silent. The full command is available from `plan --json` before anything is written.

Unsupported fields are ignored rather than guessed. Version 1 does not animate position, layer scenes, or apply per clip color filters.
