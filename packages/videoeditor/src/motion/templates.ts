import { brandCss, escapeHtml, fillTokens } from "./brand";
import type { BrandKit, MotionTemplate } from "./types";

type Canvas = { width: number; height: number; duration: number; fps: number };

/** Shared shell: a full HTML file with a deterministic seek function. */
function shell(canvas: Canvas, brand: BrandKit, css: string, body: string, seek: string): string {
    return [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8">',
        `<title>${escapeHtml(canvas.width + "x" + canvas.height)} composition</title>`,
        "<style>",
        "*{box-sizing:border-box;margin:0;padding:0}",
        `html,body{width:${canvas.width}px;height:${canvas.height}px;overflow:hidden;background:var(--brand-background,#0E1016);color:var(--brand-text,#fff)}`,
        brandCss(brand),
        css,
        "</style></head><body>",
        `<main id="stage" data-width="${canvas.width}" data-height="${canvas.height}" data-duration="${canvas.duration}" data-fps="${canvas.fps}">`,
        body,
        "</main>",
        "<script>",
        "function clamp(t,a,b){return Math.max(0,Math.min(1,(t-a)/b));}",
        "window.__ready=false;",
        seek,
        "window.__ready=true;",
        "window.__seek(0);",
        "</script></body></html>"
    ].join("\n");
}

/** Default text for a token. */
function value(values: Record<string, string>, token: string, fallback: string): string {
    return escapeHtml(values[token] || fallback);
}

const page = (values: Record<string, string>) => ({
    title: value(values, "TITLE", "Your title here"),
    text: value(values, "TEXT", "Write something short"),
    accent: value(values, "ACCENT", "Make it matter"),
    label: value(values, "LABEL", "CHAPTER 01"),
    number: value(values, "NUMBER", "42")
});

/** Seven original parameterized templates. */
export const Templates: MotionTemplate[] = [
    {
        id: "title-card",
        title: "Title card",
        description: "Large centered title with a quiet accent line.",
        tokens: ["TITLE", "ACCENT"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8%}
h1{font:800 108px/1 var(--font-display);letter-spacing:-.04em}
.rule{width:0;height:10px;margin-top:36px;background:var(--brand-accent)}
p{margin-top:24px;font:400 46px/1.2 var(--font-body);opacity:0}
`, `<div class="center"><h1 id="t">${v.title}</h1><div class="rule" id="r"></div><p id="p">${v.accent}</p></div>`, `
window.__seek=function(t){
 const t1=clamp(t,0,.5), t2=clamp(t,.4,.6), t3=clamp(t,.7,.4);
 var h=document.getElementById('t'); h.style.opacity=t1; h.style.transform='translateY('+((1-t1)*40)+'px)';
 document.getElementById('r').style.width=(t2*60)+'%';
 var p=document.getElementById('p'); p.style.opacity=t3; p.style.transform='translateY('+((1-t3)*20)+'px)';
};`);
        }
    },
    {
        id: "lower-third",
        title: "Lower third",
        description: "Broadcast name plate inside the bottom safe area.",
        tokens: ["TEXT", "ACCENT"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.plate{position:absolute;left:6%;right:6%;bottom:22%;padding:26px 34px;background:var(--brand-primary);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
.name{font:700 76px/1.05 var(--font-display)}
.role{margin-top:10px;font:400 42px/1.1 var(--font-body);opacity:.92}
`, `<div class="plate" id="plate"><div class="name" id="name">${v.text}</div><div class="role" id="role">${v.accent}</div></div>`, `
window.__seek=function(t){
 var e=clamp(t,0,.35), x=(1-e)*-160;
 var plate=document.getElementById('plate'); plate.style.opacity=e; plate.style.transform='translateX('+x+'px)';
};`);
        }
    },
    {
        id: "kinetic-caption",
        title: "Kinetic caption",
        description: "Three short lines snapping in on beats, sized for shorts.",
        tokens: ["TEXT", "ACCENT", "LABEL"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;padding:10%}
.line{font:800 92px/1 var(--font-display);letter-spacing:-.03em;text-align:center}
.line:nth-child(2){color:var(--brand-accent)}
.tag{font:600 38px/1 var(--font-body);letter-spacing:.18em;opacity:.7}
`, `<div class="wrap"><div class="tag" id="tag">${v.label}</div><div class="line" id="l1">${v.text}</div><div class="line" id="l2">${v.accent}</div></div>`, `
window.__seek=function(t){
 var a=clamp(t,0,.3),b=clamp(t,.35,.3),c=clamp(t,.75,.3);
 [['tag',a],['l1',b],['l2',c]].forEach(function(pair){
  var el=document.getElementById(pair[0]); var v=pair[1];
  el.style.opacity=v; el.style.transform='scale('+(0.8+0.2*v)+') translateY('+((1-v)*30)+'px)';
 });
};`);
        }
    },
    {
        id: "stat-callout",
        title: "Stat callout",
        description: "Number counts up beside a short label and source note.",
        tokens: ["NUMBER", "TEXT", "LABEL", "ACCENT"],
        build(values, brand, canvas) {
            const v = page(values);
            const target = Number(values.NUMBER ?? "42");
            const safe = Number.isFinite(target) ? target : 42;
            return shell(canvas, brand, `
.card{position:absolute;inset:12%;display:flex;flex-direction:column;justify-content:center;padding:8%;background:#ffffff0d;border:2px solid #ffffff1a;border-radius:26px}
.num{font:800 200px/1 var(--font-display);color:var(--brand-accent)}
.label{font:600 64px/1.1 var(--font-display);margin-top:12px}
.note{font:400 36px/1.2 var(--font-body);opacity:.65;margin-top:24px}
.bar{height:14px;margin-top:28px;background:var(--brand-primary);border-radius:8px;width:0}
`, `<div class="card"><div class="num" id="num">0</div><div class="label" id="label">${v.text}</div><div class="note" id="note">${v.accent}</div><div class="bar" id="bar"></div></div>`, `
var TARGET=${safe};
window.__seek=function(t){
 var v=clamp(t,0,1), n=clamp(t,.2,.7);
 document.getElementById('num').textContent=Math.round(TARGET*n);
 document.getElementById('label').style.opacity=v;
 document.getElementById('note').style.opacity=clamp(t,.6,.3);
 document.getElementById('bar').style.width=(n*80)+'%';
};`);
        }
    },
    {
        id: "logo-outro",
        title: "Logo outro",
        description: "Brand mark grows once, then holds still.",
        tokens: ["TEXT", "ACCENT"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}
.mark{width:240px;height:240px;border-radius:52px;background:var(--brand-primary);display:flex;align-items:center;justify-content:center;font:800 120px/1 var(--font-display)}
.brand{font:700 82px/1 var(--font-display);letter-spacing:-.03em}
.sub{font:400 40px/1 var(--font-body);opacity:.7}
`, `<div class="stage"><div class="mark" id="mark">${v.accent.slice(0, 1)}</div><div class="brand" id="brand">${v.text}</div><div class="sub">${v.accent}</div></div>`, `
window.__seek=function(t){
 var s=clamp(t,0,.5), o=clamp(t,.4,.4);
 var m=document.getElementById('mark'); m.style.opacity=s; m.style.transform='scale('+(0.72+0.28*s)+')';
 document.getElementById('brand').style.opacity=o;
};`);
        }
    },
    {
        id: "end-screen",
        title: "End screen",
        description: "Call to action with two safe-area buttons.",
        tokens: ["TITLE", "TEXT", "ACCENT"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:10%}
h2{font:800 96px/1 var(--font-display);text-align:center}
.buttons{display:flex;gap:18px;margin-top:20px;flex-wrap:wrap;justify-content:center}
.pill{padding:20px 34px;border-radius:999px;background:var(--brand-primary);font:600 40px/1 var(--font-body)}
.pill.alt{background:#ffffff22}
`, `<div class="end"><h2 id="head">${v.title}</h2><p id="sub" style="font:400 44px/1.2 var(--font-body);opacity:.8">${v.text}</p><div class="buttons" id="buttons"><span class="pill">${v.accent}</span><span class="pill alt">Watch next</span></div></div>`, `
window.__seek=function(t){
 var a=clamp(t,0,.4),b=clamp(t,.35,.4),c=clamp(t,.6,.4);
 document.getElementById('head').style.opacity=a;
 var s=document.getElementById('sub'); s.style.opacity=b;
 var bt=document.getElementById('buttons'); bt.style.opacity=c; bt.style.transform='translateY('+((1-c)*24)+'px)';
};`);
        }
    },
    {
        id: "vertical-hook",
        title: "Vertical hook",
        description: "Portrait first line with a hard cut to the promise.",
        tokens: ["TEXT", "ACCENT", "LABEL"],
        build(values, brand, canvas) {
            const v = page(values);
            return shell(canvas, brand, `
.hook{position:absolute;inset:0;padding:14% 10%;display:flex;flex-direction:column;justify-content:flex-start;gap:24px}
.kicker{font:700 38px/1 var(--font-body);letter-spacing:.2em;color:var(--brand-accent)}
.big{font:800 116px/1 var(--font-display);letter-spacing:-.04em}
.promise{font:600 70px/1.1 var(--font-display);color:var(--brand-secondary)}
`, `<div class="hook"><div class="kicker" id="k">${v.label}</div><div class="big" id="a">${v.text}</div><div class="promise" id="b">${v.accent}</div></div>`, `
window.__seek=function(t){
 var a=clamp(t,0,.25), b=t<.5?clamp(t,.25,.2):1, c=clamp(t,.55,.3);
 document.getElementById('k').style.opacity=a;
 var ea=document.getElementById('a'); ea.style.opacity=b; ea.style.transform='translateY('+((1-b)*-40)+'px)';
 var eb=document.getElementById('b'); eb.style.opacity=c; eb.style.transform='translateY('+((1-c)*40)+'px)';
};`);
        }
    }
];

/** Finds a template by id. */
export function templateById(id: string): MotionTemplate | undefined {
    return Templates.find((template) => template.id === id.toLowerCase());
}

/** Writes a composition from a template id, values, and brand kit. */
export function compose(id: string, values: Record<string, string>, brand: BrandKit, canvas: Canvas): string {
    const template = templateById(id);

    if (!template) {
        const known = Templates.map((item) => item.id).join(", ");
        throw new Error(`Unknown motion template "${id}". Use one of: ${known}.`);
    }

    return fillTokens(template.build(values, brand, canvas), values);
}
