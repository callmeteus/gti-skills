"""Tests for the SEO Growth scripts.

The GSC tests feed small CSV exports in English and Portuguese. The site check tests
parse HTML and robots.txt offline, then run a full audit against a local HTTP server.
"""

import http.server
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

from audit import site_check  # noqa: E402
from gsc import gsc_queries  # noqa: E402

ENGLISH_EXPORT = """Top queries,Clicks,Impressions,CTR,Position
how do i export invoices from acme to quickbooks online,0,1200,0%,9.4
acme pricing,300,2000,15%,1.2
acme invoice template,10,900,1.11%,4.1
best invoicing software,5,500,1%,14.2
acme,1000,1500,66.67%,1
what is the cheapest way to send invoices from my phone,2,40,5%,22
"""

PORTUGUESE_EXPORT = """Consultas principais;Cliques;Impressões;CTR;Posição
como emitir nota fiscal de serviço pelo celular sem pagar nada;1;3.400;0,03%;11,2
emissor de nota;50;800;6,25%;3,4
"""

COMPARISON_EXPORT = """Top pages,Last 3 months Clicks,Previous 3 months Clicks,Last 3 months Impressions,Previous 3 months Impressions,Last 3 months CTR,Previous 3 months CTR,Last 3 months Position,Previous 3 months Position
https://acme.io/blog/a,10,80,1000,1200,1%,6.67%,9,5
https://acme.io/pricing,200,150,3000,2500,6.67%,6%,2,2.5
"""


class GscQueriesTests(unittest.TestCase):
    def analyze(self, text, **kwargs):
        kind, rows = gsc_queries.read_rows(text)
        return gsc_queries.analyze(kind, rows, **kwargs)

    def test_long_questions_are_queries_of_eight_words_or_more_sorted_by_impressions(self):
        result = self.analyze(ENGLISH_EXPORT)
        keys = [r["key"] for r in result["long_questions"]]
        self.assertEqual(keys, [
            "how do i export invoices from acme to quickbooks online",
            "what is the cheapest way to send invoices from my phone",
        ])
        self.assertTrue(all(r["question"] for r in result["long_questions"]))

    def test_page_two_keeps_positions_eight_to_twenty_with_enough_impressions(self):
        result = self.analyze(ENGLISH_EXPORT, min_impressions=100)
        self.assertEqual([r["key"] for r in result["page_two"]], [
            "how do i export invoices from acme to quickbooks online",
            "best invoicing software",
        ])

    def test_low_ctr_flags_page_one_rows_under_the_floor(self):
        result = self.analyze(ENGLISH_EXPORT)
        self.assertEqual([r["key"] for r in result["low_ctr"]], [
            "how do i export invoices from acme to quickbooks online",
            "acme invoice template",
        ])

    def test_reads_portuguese_headers_semicolons_and_decimal_commas(self):
        result = self.analyze(PORTUGUESE_EXPORT)
        top = result["long_questions"][0]
        self.assertEqual(top["impressions"], 3400)
        self.assertAlmostEqual(top["position"], 11.2)
        self.assertAlmostEqual(top["ctr"], 0.03)
        self.assertTrue(top["question"])

    def test_comparison_export_reports_pages_that_lost_clicks(self):
        result = self.analyze(COMPARISON_EXPORT)
        self.assertEqual(result["kind"], "page")
        self.assertNotIn("long_questions", result)
        self.assertEqual([(r["key"], r["change"]) for r in result["declines"]], [("https://acme.io/blog/a", -70)])

    def test_rejects_a_csv_that_is_not_a_search_console_export(self):
        with self.assertRaises(ValueError):
            gsc_queries.read_rows("name,email\nann,a@example.com\n")

    def test_main_writes_reports_under_gti_home(self):
        with tempfile.TemporaryDirectory() as home:
            source = Path(home) / "Queries.csv"
            source.write_text(ENGLISH_EXPORT, encoding="utf-8")
            old = os.environ.get("GTI_HOME")
            os.environ["GTI_HOME"] = home
            try:
                self.assertEqual(gsc_queries.main([str(source), "--project", "demo"]), 0)
            finally:
                if old is None:
                    os.environ.pop("GTI_HOME")
                else:
                    os.environ["GTI_HOME"] = old
            written = sorted(p.suffix for p in (Path(home) / "seo-growth" / "demo" / "gsc").iterdir())
            self.assertEqual(written, [".json", ".md"])


GOOD_PAGE = """<!doctype html><html><head>
<title>Acme Pricing: Plans for Freelancers and Small Teams</title>
<meta name="description" content="Acme costs 9 USD per month for freelancers and 29 USD for teams. Compare plans, limits, and what each one includes before you sign up.">
<meta name="viewport" content="width=device-width">
<link rel="canonical" href="/pricing">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","offers":{"@type":"Offer","price":"9"}}</script>
</head><body><h1>Pricing</h1><p>Pro plan costs 9 USD per month.</p><img src="a.png" alt="Plans"><a href="/">Home</a></body></html>"""

BAD_PAGE = """<html><head><meta name="robots" content="noindex"><link rel="canonical" href="https://acme.io/"></head>
<body><h1>One</h1><h1>Two</h1><img src="a.png"><script type="application/ld+json">{bad json</script></body></html>"""


class SiteCheckParsingTests(unittest.TestCase):
    def test_a_complete_page_has_no_medium_or_high_issues(self):
        page = site_check.parse_page(GOOD_PAGE)
        issues = site_check.page_issues(page, "https://acme.io/pricing")
        self.assertEqual([i for i in issues if i[0] != "low"], [])
        self.assertEqual(page["jsonld_types"], ["Offer", "Product"])
        self.assertIn("Pro plan costs 9 USD", page["text"])
        self.assertNotIn("schema.org", page["text"])

    def test_a_broken_page_reports_each_problem(self):
        page = site_check.parse_page(BAD_PAGE)
        messages = " | ".join(m for _, m in site_check.page_issues(page, "https://acme.io/pricing"))
        for expected in ("missing <title>", "missing meta description", "2 H1 elements", "noindex",
                         "canonical points elsewhere", "no alt attribute", "not valid JSON", "no viewport"):
            self.assertIn(expected, messages)

    def test_x_robots_tag_header_counts_as_noindex(self):
        page = site_check.parse_page(GOOD_PAGE)
        issues = site_check.page_issues(page, "https://acme.io/pricing", {"x-robots-tag": "noindex, nofollow"})
        self.assertIn(("high", "noindex (meta robots or X-Robots-Tag)"), issues)

    def test_default_deny_robots_blocks_ai_bots_and_is_flagged(self):
        robots = "User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\n\nSitemap: https://acme.io/sitemap.xml\n"
        info = site_check.analyze_robots(robots, "https://acme.io/", ["/pricing"])
        self.assertIn("GPTBot", info["blocked"]["/pricing"])
        self.assertNotIn("Googlebot", info["blocked"]["/pricing"])
        self.assertTrue(any("default deny" in m for _, m in info["issues"]))
        self.assertEqual(info["sitemaps"], ["https://acme.io/sitemap.xml"])

    def test_blocking_rendering_assets_is_flagged(self):
        info = site_check.analyze_robots("User-agent: *\nDisallow: /_next/\n", "https://acme.io/", ["/"])
        self.assertTrue(any("rendering assets" in m for _, m in info["issues"]))
        self.assertEqual(info["blocked"], {})

    def test_sitemap_index_returns_child_sitemaps(self):
        index = ('<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                 "<sitemap><loc>https://acme.io/s1.xml</loc></sitemap></sitemapindex>")
        pages, children = site_check.sitemap_urls(index)
        self.assertEqual((pages, children), ([], ["https://acme.io/s1.xml"]))


class _Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        ua = self.headers.get("User-Agent", "")
        host = f"http://127.0.0.1:{self.server.server_port}"
        if self.path == "/robots.txt":
            return self._send(200, f"User-agent: *\nDisallow: /admin/\nSitemap: {host}/sitemap.xml\n", "text/plain")
        if self.path == "/sitemap.xml":
            return self._send(200, ('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                                    f"<url><loc>{host}/pricing</loc></url></urlset>"), "application/xml")
        if self.path == "/old":
            self.send_response(301)
            self.send_header("Location", "/older")
            self.end_headers()
            return None
        if self.path == "/older":
            self.send_response(301)
            self.send_header("Location", "/pricing")
            self.end_headers()
            return None
        if self.path == "/pricing":
            if "GPTBot" in ua:
                return self._send(200, "<html><head><title>x</title></head><body><div id=root></div></body></html>")
            return self._send(200, GOOD_PAGE)
        return self._send(200, "<html><body>Catch-all page</body></html>")  # soft 404

    def _send(self, status, body, kind="text/html; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class SiteCheckAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_audit_finds_soft_404_redirect_chain_and_crawler_gap(self):
        report = site_check.audit(self.base, ["/pricing", "/old"], 0, "Pro plan", 0, False)
        site_messages = [m for _, m in report["site_issues"]]
        self.assertTrue(any("soft 404" in m for m in site_messages))
        self.assertEqual(report["sitemap"]["url_count"], 1)

        pricing, old = report["pages"]
        pricing_messages = [m for _, m in pricing["issues"]]
        self.assertTrue(any(m.startswith("GPTBot:") and "not in server HTML" in m for m in pricing_messages))
        self.assertFalse(any(m.startswith("ClaudeBot:") for m in pricing_messages))
        self.assertNotIn("not in the sitemap", pricing_messages)
        self.assertIn("redirect chain of 2 hops", [m for _, m in old["issues"]])

        markdown = site_check.to_markdown(report)
        self.assertIn("| GPTBot | 200 |", markdown)
        json.dumps(report)  # the report must serialize


if __name__ == "__main__":
    unittest.main()
