import type { CheckStep } from "../core/Checks";
import type { MotionOverlay, MusicTrack, Scene } from "../core/Types";
import type { ExportPreset } from "../presets";

/** Data shown by the static review page. */
export interface ReviewData {
    title: string;
    request: string;
    inputs: string[];
    steps: CheckStep[];
    scenes: Scene[];
    music: MusicTrack[];
    renders: string[];
    captions: { style: string; cueCount: number; timing: string } | null;
    preset: ExportPreset | null;
    /** Motion overlays and clips added to the timeline. */
    motion: MotionOverlay[];
}

/** Turns a local render path into a src attribute a file:// page can open. */
function mediaSrc(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    return /^[A-Za-z]:\//.test(normalized) ? `file:///${normalized}` : normalized;
}

/** Escapes text before it goes into HTML. */
function esc(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Cards for all measured checks from every step. */
function checksHtml(steps: CheckStep[]): string {
    if (steps.length === 0) {
        return "<p>No steps recorded yet. Run probe, cut, reframe, loudness, captions, or export first.</p>";
    }

    return steps.slice().reverse().map((step) => {
        const rows = step.checks.map((check) => {
            const state = check.ok ? "pass" : "fail";
            const expected = check.expected !== undefined ? ` / expected ${esc(check.expected)}` : "";
            return `<li class="${state}"><b>${esc(check.name)}</b>: ${esc(check.measured)}${expected}${check.detail ? `<br><small>${esc(check.detail)}</small>` : ""}</li>`;
        }).join("");
        return `<section class="step"><h3>${esc(step.command)} <small>${esc(step.at)}</small></h3><ul class="checks">${rows || "<li>No checks</li>"}</ul></section>`;
    }).join("");
}

/** Timeline of clips, captions, and audio with clickable items. */
function timelineHtml(data: ReviewData): string {
    const items: string[] = [];
    let cursor = 0;

    for (const [index, scene] of data.scenes.entries()) {
        const start = cursor;
        cursor += scene.duration;
        items.push(
            `<li class="item clip" data-kind="clip" data-index="${index + 1}" data-time="${start.toFixed(2)}" data-label="scene ${index + 1} (${esc(scene.id)})">` +
            `<span class="tag clip">CLIP ${index + 1}</span> ${esc(scene.source)} <small>${start.toFixed(2)}s to ${cursor.toFixed(2)}s</small></li>`
        );
    }

    if (data.captions) {
        items.push(
            `<li class="item caption" data-kind="captions" data-time="0" data-label="captions (${esc(data.captions.style)})">` +
            `<span class="tag caption">CAPTIONS</span> ${esc(data.captions.cueCount)} cues, ${esc(data.captions.timing)} timing, style ${esc(data.captions.style)}</li>`
        );
    }

    for (const overlay of data.motion) {
        items.push(
            `<li class="item motion" data-kind="motion" data-time="${overlay.at.toFixed(2)}" data-label="motion overlay (${esc(overlay.id)})">` +
            `<span class="tag motion">MOTION</span> ${esc(overlay.source)} <small>at ${overlay.at.toFixed(2)}s for ${overlay.duration.toFixed(2)}s</small></li>`
        );
    }

    for (const [index, track] of data.music.entries()) {
        items.push(
            `<li class="item audio" data-kind="audio" data-index="${index + 1}" data-time="0" data-label="music ${index + 1} (${esc(track.id)})">` +
            `<span class="tag audio">AUDIO</span> ${esc(track.source)} <small>volume ${esc(track.volume ?? 1)}</small></li>`
        );
    }

    return items.length > 0 ? `<ul class="timeline">${items.join("")}</ul>` : "<p>No timeline items yet.</p>";
}

/** Entire static review page. Works from file:// with no server. */
export function renderReviewHtml(data: ReviewData): string {
    const safe = data.preset ? Math.round(data.preset.safeBottom * 100) : 18;
    const firstRender = data.renders[0];
    const player = firstRender
        ? `<video controls playsinline src="${esc(mediaSrc(firstRender))}"></video>`
        : "<div class=\"empty\">No render yet. Run export or render.</div>";
    const inputs = data.inputs.length > 0
        ? `<ul>${data.inputs.map((input) => `<li>${esc(input)}</li>`).join("")}</ul>`
        : "<p>No inputs recorded yet.</p>";
    const captionLine = data.captions
        ? `<p><b>Captions:</b> ${esc(data.captions.cueCount)} cues, ${esc(data.captions.timing)} word timing, style ${esc(data.captions.style)}.</p>`
        : "";
    const presetLine = data.preset
        ? `<p><b>Preset:</b> ${esc(data.preset.name)} ${esc(data.preset.width)}x${esc(data.preset.height)} @ ${esc(data.preset.fps)} fps, ${esc(data.preset.codec)}/${esc(data.preset.audioCodec)}, ${esc(data.preset.loudnessTarget)} LUFS.</p>`
        : "";

    const script = [
        "var selected = null;",
        "var items = document.querySelectorAll('.item');",
        "for (var i = 0; i < items.length; i++) {",
        "  items[i].addEventListener('click', function () {",
        "    for (var j = 0; j < items.length; j++) { items[j].classList.remove('selected'); }",
        "    this.classList.add('selected');",
        "    selected = this;",
        "    document.getElementById('selection').textContent = this.getAttribute('data-label');",
        "  });",
        "}",
        "function buildInstruction() {",
        "  var note = document.getElementById('note').value.trim();",
        "  if (!selected) { return 'Select a clip, caption, or audio item first.'; }",
        "  var prefix = 'In video editor request " + esc(data.request) + ", change ' + " +
        "selected.getAttribute('data-label') + ' at ' + selected.getAttribute('data-time') + 's: ';",
        "  return prefix + (note || 'describe the change here');",
        "}",
        "document.getElementById('preview').addEventListener('click', function () {",
        "  document.getElementById('instruction').value = buildInstruction();",
        "});",
        "document.getElementById('copy').addEventListener('click', function () {",
        "  var text = buildInstruction();",
        "  document.getElementById('instruction').value = text;",
        "  if (navigator.clipboard && navigator.clipboard.writeText) {",
        "    navigator.clipboard.writeText(text).catch(function () {});",
        "  }",
        "});"
    ].join("\n");

    return [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        `<title>${esc(data.title)}</title>`,
        "<style>",
        "body{font:14px system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;color:#17191f}",
        "h1{font-size:22px}h2{font-size:17px;margin-top:28px}h3{font-size:14px;margin:0 0 8px}",
        ".layout{display:grid;grid-template-columns:minmax(260px,360px) 1fr;gap:28px}",
        ".phone{position:relative;width:270px;aspect-ratio:9/16;border:10px solid #20232b;border-radius:24px;background:#000;overflow:hidden}",
        ".phone video{width:100%;height:100%;object-fit:contain}",
        ".safe{position:absolute;left:0;right:0;bottom:0;border-top:2px dashed #ffcc4d;background:rgba(255,204,77,.12);display:flex;align-items:center;justify-content:center;font-size:11px;color:#ffcc4d}",
        ".empty{display:flex;align-items:center;justify-content:center;height:100%;color:#888}",
        ".step{border:1px solid #e3e5ea;border-radius:8px;padding:12px;margin:10px 0}",
        ".checks{list-style:none;padding:0;margin:0}.checks li{padding:4px 0;border-bottom:1px solid #f0f1f4}",
        ".checks li.pass b{color:#187a3a}.checks li.fail b{color:#ba1a1a}",
        ".timeline{list-style:none;padding:0;margin:0}",
        ".item{padding:9px 12px;border:1px solid #e3e5ea;border-left-width:5px;border-radius:6px;margin:6px 0;cursor:pointer}",
        ".item.selected{background:#eef3ff;border-color:#315efb}",
        ".item.clip{border-left-color:#315efb}.item.caption{border-left-color:#d97706}.item.audio{border-left-color:#0f766e}",
        ".item.motion{border-left-color:#7c3aed}",
        ".tag{font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;color:#fff}",
        ".tag.clip{background:#315efb}.tag.caption{background:#d97706}.tag.audio{background:#0f766e}",
        ".tag.motion{background:#7c3aed}",
        ".motion-badge{position:absolute;top:10px;left:10px;background:#7c3aed;color:#fff;font-size:10px;padding:4px 7px;border-radius:4px}",
        ".note{display:flex;flex-direction:column;gap:8px;margin-top:18px}",
        "textarea,input[type=text]{width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccd0da;border-radius:6px;font:inherit}",
        "button{padding:9px 14px;border:0;border-radius:6px;background:#315efb;color:#fff;cursor:pointer}",
        "small{color:#666}ul{padding-left:18px}",
        "@media(max-width:860px){.layout{grid-template-columns:1fr}}",
        "</style></head><body>",
        `<h1>${esc(data.title)}</h1>`,
        presetLine,
        captionLine,
        '<div class="layout"><div>',
        '<div class="phone">', player,
        data.motion.length > 0
            ? `<div class="motion-badge">${data.motion.length} motion overlay(s)</div>`
            : "",
        `<div class="safe" style="height:${safe}%">platform UI safe area ${safe}%</div>`,
        "</div>",
        '<div class="note">',
        '<label>Selected: <b id="selection">none</b></label>',
        '<textarea id="note" rows="3" placeholder="Write a note for the agent"></textarea>',
        '<button id="preview">Build instruction</button><button id="copy">Copy instruction</button>',
        '<input type="text" id="instruction" readonly placeholder="Copyable instruction appears here">',
        "</div></div><div>",
        "<h2>Inputs</h2>", inputs,
        "<h2>Checks from each step</h2>", checksHtml(data.steps),
        "<h2>Timeline</h2>", timelineHtml(data),
        "</div></div>",
        `<script>${script}</script>`,
        "</body></html>"
    ].join("\n");
}
