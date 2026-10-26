import { Fonts, Lucide } from "../assets";

/**
 * Editorial poster: type as the image, warm paper, a single vermillion rule.
 *
 * @returns HTML document
 */
export function editorialCoverHtml(): string {
    const fonts = Fonts.importCss("fraunces:400,600,700|ibm-plex-sans:400,500");
    const scan = Lucide.svg("scan");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>The Geometry of Quiet</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1600px;
            height: 2000px;
            background: #f4efe6;
            color: #14110e;
            position: relative;
            overflow: hidden;
            font-family: "IBM Plex Sans", sans-serif;
        }
        .grain {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.18;
            background-image: radial-gradient(#14110e 0.6px, transparent 0.6px);
            background-size: 3px 3px;
        }
        .frame {
            position: absolute;
            inset: 72px;
            border: 1px solid #14110e;
        }
        .kicker {
            position: absolute;
            top: 110px;
            left: 110px;
            font-size: 13px;
            letter-spacing: 0.42em;
            text-transform: uppercase;
            font-weight: 500;
        }
        .rule {
            position: absolute;
            top: 160px;
            left: 110px;
            width: 72px;
            height: 8px;
            background: #c23b22;
        }
        h1 {
            position: absolute;
            top: 210px;
            left: 100px;
            right: 120px;
            margin: 0;
            font-family: Fraunces, serif;
            font-weight: 700;
            font-size: 188px;
            line-height: 0.86;
            letter-spacing: -0.04em;
        }
        h1 span { display: block; font-style: italic; font-weight: 400; font-size: 132px; }
        .colophon {
            position: absolute;
            right: 110px;
            top: 110px;
            writing-mode: vertical-rl;
            transform: rotate(180deg);
            font-size: 14px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
        }
        .footer {
            position: absolute;
            left: 110px;
            right: 110px;
            bottom: 110px;
            display: flex;
            justify-content: space-between;
            align-items: end;
            gap: 40px;
        }
        .footer p {
            margin: 0;
            max-width: 520px;
            font-size: 22px;
            line-height: 1.35;
        }
        .mark {
            width: 72px;
            height: 72px;
            color: #c23b22;
        }
        .mark svg { width: 72px; height: 72px; }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1600" data-height="2000">
        <div class="grain"></div>
        <div class="frame"></div>
        <div class="kicker" data-ad-select="kicker">Northfold Press / Vol. 04 Autumn</div>
        <div class="rule" data-ad-select="accent-rule"></div>
        <h1 data-ad-select="title">The Geometry <span>of Quiet</span></h1>
        <div class="colophon">Printed matter for people who still look</div>
        <div class="footer">
            <p data-ad-select="standfirst">An issue about margins, pause, and the decision to leave the field empty on purpose.</p>
            <div class="mark">${scan}</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Bold promotional square: acid type on near-black, neo-brutal stamp.
 *
 * @returns HTML document
 */
export function promoPosterHtml(): string {
    const fonts = Fonts.importCss("archivo-black:400|space-grotesk:500,700");
    const check = Lucide.svg("check");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Night Market</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1080px;
            height: 1080px;
            background: #101010;
            color: #f4ef3a;
            position: relative;
            overflow: hidden;
            font-family: "Space Grotesk", sans-serif;
        }
        .stripe {
            position: absolute;
            top: 0;
            left: -10%;
            width: 120%;
            height: 46px;
            background: repeating-linear-gradient(-18deg, #f4ef3a 0 16px, #101010 16px 32px);
        }
        h1 {
            position: absolute;
            top: 90px;
            left: 48px;
            right: 48px;
            margin: 0;
            font-family: "Archivo Black", sans-serif;
            font-size: 168px;
            line-height: 0.82;
            letter-spacing: -0.05em;
            text-transform: uppercase;
        }
        .when {
            position: absolute;
            left: 56px;
            bottom: 64px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .stamp {
            position: absolute;
            right: 56px;
            bottom: 56px;
            width: 220px;
            height: 220px;
            border: 8px solid #f4ef3a;
            transform: rotate(-8deg);
            display: grid;
            place-items: center;
            text-align: center;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            font-size: 18px;
        }
        .stamp svg { width: 42px; height: 42px; margin-bottom: 8px; }
        .meta {
            position: absolute;
            top: 620px;
            left: 56px;
            font-size: 22px;
            color: #f4efe6;
            max-width: 520px;
            line-height: 1.3;
        }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1080" data-height="1080">
        <div class="stripe"></div>
        <h1 data-ad-select="title">Night<br>Market</h1>
        <p class="meta" data-ad-select="body">Open air. No tickets. Bring cash and a jacket. The river walk, gate B.</p>
        <div class="when" data-ad-select="date">Sat 21 / 18:00</div>
        <div class="stamp" data-ad-select="stamp">${check}<span>Free in</span></div>
    </div>
</body>
</html>`;
}

/**
 * Technical infographic: numbered pipeline of HTML graphics on a blueprint grid.
 *
 * @returns HTML document
 */
export function infographicHtml(): string {
    const fonts = Fonts.importCss("ibm-plex-sans:400,500,600|ibm-plex-mono:400,500");
    const layers = Lucide.svg("layers");
    const activity = Lucide.svg("activity");
    const fileDown = Lucide.svg("file-down");
    const type = Lucide.svg("type");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>How HTML Graphics Are Made</title>
    <style>
        ${fonts}
        html, body { margin: 0; overflow: hidden; }
        .artboard {
            width: 1080px;
            height: 1920px;
            background: #0b1c28;
            color: #d7e6ef;
            position: relative;
            overflow: hidden;
            font-family: "IBM Plex Sans", sans-serif;
        }
        .grid {
            position: absolute;
            inset: 0;
            background-image:
                linear-gradient(rgba(62, 200, 224, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(62, 200, 224, 0.08) 1px, transparent 1px);
            background-size: 40px 40px;
        }
        header {
            position: relative;
            padding: 72px 64px 24px;
        }
        .id {
            font-family: "IBM Plex Mono", monospace;
            font-size: 13px;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: #3ec8e0;
        }
        h1 {
            margin: 16px 0 0;
            font-size: 64px;
            line-height: 0.95;
            letter-spacing: -0.03em;
            font-weight: 600;
        }
        .steps {
            position: relative;
            margin: 40px 64px;
            display: grid;
            gap: 28px;
        }
        .step {
            border: 1px solid rgba(62, 200, 224, 0.45);
            padding: 28px 28px 24px 88px;
            position: relative;
            min-height: 148px;
        }
        .num {
            position: absolute;
            left: 20px;
            top: 24px;
            font-family: "IBM Plex Mono", monospace;
            font-size: 28px;
            color: #3ec8e0;
        }
        .step h2 {
            margin: 0 0 8px;
            font-size: 26px;
            font-weight: 600;
        }
        .step p {
            margin: 0;
            font-size: 18px;
            line-height: 1.4;
            color: #9db8c6;
        }
        .icon {
            position: absolute;
            right: 22px;
            top: 22px;
            width: 28px;
            height: 28px;
            color: #3ec8e0;
        }
        .icon svg { width: 28px; height: 28px; }
        footer {
            position: absolute;
            left: 64px;
            right: 64px;
            bottom: 64px;
            font-family: "IBM Plex Mono", monospace;
            font-size: 14px;
            color: #3ec8e0;
        }
    </style>
</head>
<body>
    <div class="artboard" data-artdirector-root data-width="1080" data-height="1920">
        <div class="grid"></div>
        <header>
            <div class="id">AD-INF-01 / deterministic pipeline</div>
            <h1 data-ad-select="title">How HTML graphics are made</h1>
        </header>
        <div class="steps">
            <article class="step" data-ad-select="step-1">
                <div class="num">01</div>
                <div class="icon">${type}</div>
                <h2>Write the composition</h2>
                <p>Language models reason about hierarchy and write HTML, CSS, and SVG. No picture model is involved.</p>
            </article>
            <article class="step" data-ad-select="step-2">
                <div class="num">02</div>
                <div class="icon">${layers}</div>
                <h2>Lock the artboard</h2>
                <p>Exact pixel dimensions, licensed fonts from Bunny, Lucide marks, user or public-domain images only.</p>
            </article>
            <article class="step" data-ad-select="step-3">
                <div class="num">03</div>
                <div class="icon">${activity}</div>
                <h2>Render in a browser</h2>
                <p>Chromium paints the document. Live Mode selects real elements. Accept writes source, then re-renders.</p>
            </article>
            <article class="step" data-ad-select="step-4">
                <div class="num">04</div>
                <div class="icon">${fileDown}</div>
                <h2>Export pixels</h2>
                <p>PNG, JPEG, SVG, or PDF from the same HTML. Audit checks overflow, fonts, and assets before shipping.</p>
            </article>
        </div>
        <footer>ArtDirector / HTML in. Pixels out. Never a generative image API.</footer>
    </div>
</body>
</html>`;
}
