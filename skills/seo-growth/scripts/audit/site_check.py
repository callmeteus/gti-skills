#!/usr/bin/env python3
"""Live technical SEO check for a site, standard library only.

Checks robots.txt, the sitemap, a soft-404 probe, and for each page: status, redirect
hops, title, meta description, canonical, robots directives, H1 count, images without
alt, JSON-LD types, hreflang, and what search and AI crawlers receive compared with a
browser. Writes Markdown and JSON to ~/.gti/seo-growth/<project>/audits/.

Usage:
    python3 site_check.py https://example.com --pages /pricing /blog/post
    python3 site_check.py https://example.com --from-sitemap 30 --expect "Pro plan"
"""

from __future__ import annotations

import argparse
import gzip
import json
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.robotparser import RobotFileParser

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.gti import gti_dir, project_name, slug, stamp  # noqa: E402

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
)
CRAWLERS = {
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "GPTBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
    "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
    "ClaudeBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com",
    "PerplexityBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot",
}
ROBOTS_AGENTS = ["*", "Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot"]
ASSET_HINTS = ("/_next", "/static", "/assets", ".css", ".js")
CHALLENGE_HINTS = ("cf-challenge", "challenge-platform", "just a moment...", "attention required", "captcha")
TITLE_MIN, TITLE_MAX = 30, 60
DESC_MIN, DESC_MAX = 70, 160


# ---------------------------------------------------------------- fetching

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_OPENER = urllib.request.build_opener(_NoRedirect)


def fetch(url, ua=BROWSER_UA, timeout=20, max_hops=10):
    """GET a URL following redirects by hand. Returns a dict with status, hops, final URL, headers, body."""
    hops = []
    current = url
    for _ in range(max_hops + 1):
        request = urllib.request.Request(current, headers={"User-Agent": ua, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.8"})
        try:
            response = _OPENER.open(request, timeout=timeout)
            status, headers, raw = response.status, response.headers, response.read()
        except urllib.error.HTTPError as error:
            status, headers = error.code, error.headers
            raw = error.read() if error.fp else b""
            error.close()
        except Exception as error:  # network failure, TLS, timeout
            return {"url": url, "status": None, "error": str(error), "hops": hops, "final_url": current, "headers": {}, "body": ""}
        if status in (301, 302, 303, 307, 308) and headers.get("Location"):
            target = urllib.parse.urljoin(current, headers["Location"])
            hops.append({"status": status, "from": current, "to": target})
            current = target
            continue
        if raw[:2] == b"\x1f\x8b":
            try:
                raw = gzip.decompress(raw)
            except OSError:
                pass
        charset = headers.get_content_charset() if hasattr(headers, "get_content_charset") else None
        body = raw.decode(charset or "utf-8", errors="replace")
        return {"url": url, "status": status, "error": None, "hops": hops, "final_url": current,
                "headers": {k.lower(): v for k, v in headers.items()}, "body": body}
    return {"url": url, "status": None, "error": "too many redirects", "hops": hops, "final_url": current, "headers": {}, "body": ""}


# ---------------------------------------------------------------- parsing

class PageParser(HTMLParser):
    """Collects the SEO-relevant parts of an HTML page."""

    SKIP = {"script", "style", "noscript", "template", "svg", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None
        self._in_title = False
        self.meta = {}
        self.canonical = None
        self.hreflang = []
        self.h1 = []
        self._h1_depth = 0
        self._h1_text = []
        self.images_without_alt = 0
        self.images = 0
        self.links = []
        self.jsonld_blocks = []
        self._in_jsonld = False
        self._jsonld_text = []
        self._skip = 0
        self.text = []

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title" and self.title is None:
            self._in_title = True
            self.title = ""
        elif tag == "meta":
            key = (a.get("name") or a.get("property") or "").lower()
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link":
            rel = a.get("rel", "").lower().split()
            if "canonical" in rel and self.canonical is None:
                self.canonical = a.get("href", "")
            if "alternate" in rel and a.get("hreflang"):
                self.hreflang.append({"lang": a["hreflang"], "href": a.get("href", "")})
        elif tag == "h1":
            self._h1_depth += 1
            self._h1_text = []
        elif tag == "img":
            self.images += 1
            if "alt" not in a:
                self.images_without_alt += 1
        elif tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self._in_jsonld = True
            self._jsonld_text = []
        if tag in self.SKIP:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1" and self._h1_depth:
            self._h1_depth -= 1
            self.h1.append(" ".join("".join(self._h1_text).split()))
        elif tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            self.jsonld_blocks.append("".join(self._jsonld_text))
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_jsonld:
            self._jsonld_text.append(data)
        if self._h1_depth:
            self._h1_text.append(data)
        if not self._skip:
            self.text.append(data)


def jsonld_types(blocks):
    types = []

    def walk(node):
        if isinstance(node, dict):
            value = node.get("@type")
            if isinstance(value, str):
                types.append(value)
            elif isinstance(value, list):
                types.extend(str(v) for v in value)
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    invalid = 0
    for block in blocks:
        try:
            walk(json.loads(block))
        except ValueError:
            invalid += 1
    return sorted(set(types)), invalid


def parse_page(html):
    parser = PageParser()
    try:
        parser.feed(html)
        parser.close()
    except Exception:  # malformed HTML should not stop the audit
        pass
    types, invalid = jsonld_types(parser.jsonld_blocks)
    text = " ".join(" ".join(parser.text).split())
    return {
        "title": " ".join((parser.title or "").split()) or None,
        "description": parser.meta.get("description"),
        "robots_meta": parser.meta.get("robots", ""),
        "canonical": parser.canonical,
        "hreflang": parser.hreflang,
        "h1": parser.h1,
        "images": parser.images,
        "images_without_alt": parser.images_without_alt,
        "links": parser.links,
        "jsonld_types": types,
        "jsonld_invalid": invalid,
        "has_viewport": "viewport" in parser.meta,
        "text": text,
    }


def page_issues(page, url, headers=None):
    """Rules applied to one parsed page. Returns a list of (severity, message)."""
    issues = []
    headers = headers or {}
    title = page["title"]
    if not title:
        issues.append(("high", "missing <title>"))
    elif len(title) > TITLE_MAX:
        issues.append(("medium", f"title is {len(title)} characters (over {TITLE_MAX}, likely cut off)"))
    elif len(title) < TITLE_MIN:
        issues.append(("low", f"title is {len(title)} characters (under {TITLE_MIN}, room for the keyword)"))
    desc = page["description"]
    if not desc:
        issues.append(("medium", "missing meta description"))
    elif not DESC_MIN <= len(desc) <= DESC_MAX:
        issues.append(("low", f"meta description is {len(desc)} characters (aim for {DESC_MIN} to {DESC_MAX})"))
    if len(page["h1"]) == 0:
        issues.append(("medium", "no H1"))
    elif len(page["h1"]) > 1:
        issues.append(("low", f"{len(page['h1'])} H1 elements"))
    robots = (page["robots_meta"] + "," + headers.get("x-robots-tag", "")).lower()
    if "noindex" in robots:
        issues.append(("high", "noindex (meta robots or X-Robots-Tag)"))
    canonical = page["canonical"]
    if not canonical:
        issues.append(("medium", "no canonical tag"))
    else:
        resolved = urllib.parse.urljoin(url, canonical)
        if normalize(resolved) != normalize(url):
            issues.append(("medium", f"canonical points elsewhere: {resolved}"))
    if page["hreflang"] and not any(h["lang"].lower() == "x-default" for h in page["hreflang"]):
        issues.append(("low", "hreflang links without x-default"))
    if page["images_without_alt"]:
        issues.append(("low", f"{page['images_without_alt']} of {page['images']} images have no alt attribute"))
    if page["jsonld_invalid"]:
        issues.append(("medium", f"{page['jsonld_invalid']} JSON-LD block(s) are not valid JSON"))
    if not page["jsonld_types"]:
        issues.append(("low", "no JSON-LD structured data"))
    if not page["has_viewport"]:
        issues.append(("medium", "no viewport meta tag (mobile)"))
    return issues


def normalize(url):
    parts = urllib.parse.urlsplit(url)
    path = parts.path.rstrip("/") or "/"
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}{path}"


# ---------------------------------------------------------------- robots and sitemap

def analyze_robots(text, base, paths):
    """Parse robots.txt text. Returns blocked agents per path, risky rules, and sitemap URLs."""
    parser = RobotFileParser()
    parser.parse(text.splitlines())
    blocked = {}
    for path in paths:
        url = urllib.parse.urljoin(base, path)
        agents = [agent for agent in ROBOTS_AGENTS if not parser.can_fetch(agent, url)]
        if agents:
            blocked[path] = agents
    issues = []
    current_agents, group_rules = [], {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        field, value = (part.strip() for part in line.split(":", 1))
        field = field.lower()
        if field == "user-agent":
            if group_rules.get("_closed"):
                current_agents, group_rules = [], {}
            current_agents.append(value)
        elif field in ("disallow", "allow"):
            group_rules["_closed"] = True
            if field == "disallow" and value == "/" and "*" in current_agents:
                issues.append(("high", "robots.txt disallows everything for User-agent: * (default deny)"))
            if field == "disallow" and value and any(hint in value for hint in ASSET_HINTS):
                issues.append(("medium", f"robots.txt blocks rendering assets: Disallow: {value}"))
    sitemaps = [line.split(":", 1)[1].strip() for line in text.splitlines() if line.lower().startswith("sitemap:")]
    return {"blocked": blocked, "issues": issues, "sitemaps": sitemaps}


def sitemap_urls(xml_text, limit=50000):
    """Return (page URLs, child sitemap URLs) from a sitemap or sitemap index."""
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError:
        return None, []
    pages, children = [], []
    for element in root.iter():
        if element.tag.endswith("loc") and element.text:
            loc = element.text.strip()
            parent_is_index = root.tag.endswith("sitemapindex")
            (children if parent_is_index else pages).append(loc)
            if len(pages) >= limit:
                break
    return pages, children


def collect_sitemap(urls, limit, delay):
    pages, seen, queue, checked = [], set(), list(urls), []
    while queue and len(seen) < 20:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        result = fetch(url)
        ok = result["status"] == 200
        found, children = sitemap_urls(result["body"]) if ok else (None, [])
        checked.append({"url": url, "status": result["status"], "urls": len(found or []), "valid": found is not None})
        pages.extend(found or [])
        queue.extend(children)
        time.sleep(delay)
        if len(pages) >= limit:
            break
    return pages, checked


# ---------------------------------------------------------------- crawler comparison

def compare_crawlers(url, browser_text, expect, delay, crawlers=CRAWLERS):
    rows = []
    for name, ua in crawlers.items():
        result = fetch(url, ua=ua)
        text = parse_page(result["body"])["text"] if result["body"] else ""
        ratio = (len(text) / len(browser_text)) if browser_text else None
        row = {"crawler": name, "status": result["status"], "text_chars": len(text),
               "ratio": round(ratio, 2) if ratio is not None else None, "problems": []}
        lowered = result["body"].lower()[:20000]
        if result["status"] != 200:
            row["problems"].append(f"status {result['status'] or result['error']}")
        if any(hint in lowered for hint in CHALLENGE_HINTS):
            row["problems"].append("bot challenge page")
        if ratio is not None and ratio < 0.5:
            row["problems"].append(f"receives {int(ratio * 100)}% of the browser's text")
        if expect and expect.lower() not in text.lower():
            row["problems"].append(f'"{expect}" not in server HTML')
        rows.append(row)
        time.sleep(delay)
    return rows


# ---------------------------------------------------------------- main audit

def audit(base, paths, from_sitemap, expect, delay, skip_crawlers):
    base = base.rstrip("/")
    if not base.startswith(("http://", "https://")):
        base = "https://" + base
    report = {"site": base, "date": time.strftime("%Y-%m-%d %H:%M"), "site_issues": [], "pages": []}

    robots = fetch(base + "/robots.txt")
    report["robots"] = {"status": robots["status"]}
    robots_info = {"blocked": {}, "issues": [], "sitemaps": []}
    if robots["status"] == 200:
        robots_info = analyze_robots(robots["body"], base + "/", paths or ["/"])
        report["robots"].update(robots_info)
        report["site_issues"].extend(robots_info["issues"])
    else:
        report["site_issues"].append(("medium", f"robots.txt returned {robots['status'] or robots['error']}"))

    sitemap_sources = robots_info["sitemaps"] or [base + "/sitemap.xml"]
    sitemap_pages, checked = collect_sitemap(sitemap_sources, 50000, delay)
    report["sitemap"] = {"checked": checked, "url_count": len(sitemap_pages)}
    if not sitemap_pages:
        report["site_issues"].append(("high", "no sitemap URLs found (robots.txt Sitemap: lines or /sitemap.xml)"))
    elif not robots_info["sitemaps"] and robots["status"] == 200:
        report["site_issues"].append(("low", "sitemap is not listed in robots.txt"))
    sitemap_set = {normalize(u) for u in sitemap_pages}

    probe = fetch(f"{base}/gti-seo-check-{secrets.token_hex(4)}")
    report["soft_404"] = {"status": probe["status"]}
    if probe["status"] not in (404, 410):
        report["site_issues"].append(("high", f"unknown URL returned {probe['status']} instead of 404 (soft 404)"))

    targets = [urllib.parse.urljoin(base + "/", p) for p in (paths or [])]
    if from_sitemap:
        targets.extend(u for u in sitemap_pages[:from_sitemap] if u not in targets)
    if not targets:
        targets = [base + "/"]

    for url in targets:
        time.sleep(delay)
        result = fetch(url)
        entry = {"url": url, "status": result["status"], "final_url": result["final_url"], "hops": result["hops"], "issues": []}
        if result["error"]:
            entry["issues"].append(("high", f"fetch failed: {result['error']}"))
            report["pages"].append(entry)
            continue
        if len(result["hops"]) > 1:
            entry["issues"].append(("medium", f"redirect chain of {len(result['hops'])} hops"))
        if any(h["status"] in (302, 303, 307) for h in result["hops"]):
            entry["issues"].append(("low", "temporary redirect (302/303/307) where a permanent one may be meant"))
        if result["status"] != 200:
            entry["issues"].append(("high", f"status {result['status']}"))
        page = parse_page(result["body"])
        entry.update({k: page[k] for k in ("title", "description", "canonical", "h1", "jsonld_types", "hreflang")})
        entry["text_chars"] = len(page["text"])
        entry["internal_links"] = sum(1 for link in page["links"] if urllib.parse.urljoin(url, link).startswith(base))
        if result["status"] == 200:
            entry["issues"].extend(page_issues(page, result["final_url"], result["headers"]))
        if sitemap_set and normalize(result["final_url"]) not in sitemap_set:
            entry["issues"].append(("medium", "not in the sitemap"))
        path = urllib.parse.urlsplit(url).path or "/"
        blocked = robots_info["blocked"].get(path)
        if blocked:
            entry["issues"].append(("high", "blocked by robots.txt for: " + ", ".join(blocked)))
        if not skip_crawlers and result["status"] == 200:
            entry["crawlers"] = compare_crawlers(result["final_url"], page["text"], expect, delay)
            for row in entry["crawlers"]:
                for problem in row["problems"]:
                    entry["issues"].append(("high", f"{row['crawler']}: {problem}"))
        report["pages"].append(entry)
    return report


SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def to_markdown(report):
    lines = [f"# Site check: {report['site']}", "", f"- **Date:** {report['date']}",
             f"- **Sitemap URLs:** {report['sitemap']['url_count']}",
             f"- **robots.txt:** status {report['robots']['status']}",
             f"- **Soft 404 probe:** status {report['soft_404']['status']}", ""]
    lines += ["## Site issues", ""]
    site_issues = sorted(report["site_issues"], key=lambda i: SEVERITY_ORDER[i[0]])
    lines += [f"- **{sev}:** {msg}" for sev, msg in site_issues] or ["- None"]
    lines.append("")
    lines += ["## Pages", "", "| Page | Status | Title chars | H1 | Schema | High | Medium | Low |",
              "|------|--------|-------------|----|--------|------|--------|-----|"]
    for page in report["pages"]:
        counts = {s: sum(1 for i in page["issues"] if i[0] == s) for s in SEVERITY_ORDER}
        title_len = len(page.get("title") or "")
        lines.append(f"| {page['url']} | {page['status']} | {title_len} | {len(page.get('h1') or [])} | "
                     f"{', '.join(page.get('jsonld_types') or []) or '-'} | {counts['high']} | {counts['medium']} | {counts['low']} |")
    lines.append("")
    for page in report["pages"]:
        lines += [f"### {page['url']}", ""]
        if page.get("title"):
            lines.append(f"- **Title:** {page['title']}")
        if page.get("canonical"):
            lines.append(f"- **Canonical:** {page['canonical']}")
        for hop in page.get("hops", []):
            lines.append(f"- **Redirect:** {hop['status']} {hop['from']} -> {hop['to']}")
        for sev, msg in sorted(page["issues"], key=lambda i: SEVERITY_ORDER[i[0]]):
            lines.append(f"- **{sev}:** {msg}")
        if page.get("crawlers"):
            lines += ["", "| Crawler | Status | Text vs browser | Problems |", "|---------|--------|-----------------|----------|"]
            for row in page["crawlers"]:
                ratio = f"{int(row['ratio'] * 100)}%" if row["ratio"] is not None else "-"
                lines.append(f"| {row['crawler']} | {row['status']} | {ratio} | {'; '.join(row['problems']) or 'ok'} |")
        lines.append("")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Live technical SEO check for a site.")
    parser.add_argument("site", help="Site root, for example https://example.com")
    parser.add_argument("--pages", nargs="*", default=[], help="Paths or URLs to check (default: the home page)")
    parser.add_argument("--from-sitemap", type=int, default=0, metavar="N", help="Also check the first N sitemap URLs")
    parser.add_argument("--expect", default=None, help="Phrase every crawler must receive in the HTML, such as a price")
    parser.add_argument("--delay", type=float, default=0.5, help="Seconds between requests (default 0.5)")
    parser.add_argument("--no-crawlers", action="store_true", help="Skip the per-crawler comparison")
    parser.add_argument("--project", default=None, help="Project folder name under ~/.gti/seo-growth (default: git root name)")
    parser.add_argument("--out", default=None, help="Output folder (default: ~/.gti/seo-growth/<project>/audits)")
    args = parser.parse_args(argv)

    report = audit(args.site, args.pages, args.from_sitemap, args.expect, args.delay, args.no_crawlers)
    out = Path(args.out) if args.out else gti_dir(args.project or project_name(), "audits")
    out.mkdir(parents=True, exist_ok=True)
    name = f"site-check-{slug(urllib.parse.urlsplit(report['site']).netloc)}-{stamp()}"
    (out / f"{name}.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path = out / f"{name}.md"
    md_path.write_text(to_markdown(report), encoding="utf-8")
    high = sum(1 for i in report["site_issues"] if i[0] == "high") + sum(
        1 for p in report["pages"] for i in p["issues"] if i[0] == "high")
    print(f"Checked {len(report['pages'])} page(s), {high} high-severity issue(s).")
    print(f"Report: {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
