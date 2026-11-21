#!/usr/bin/env python3
"""Find growth opportunities in a Google Search Console export, standard library only.

Reads a Performance export CSV (Queries.csv or Pages.csv, English or Portuguese
headers, optional comparison columns) and lists:

1. Long questions: queries of N+ words (default 8) with impressions, most impressions first.
2. Page-2 rows: average position 8 to 20 with enough impressions.
3. Low CTR: position 10 or better with CTR under a floor (default 2%).
4. Declines: rows that lost clicks, when the export compares two periods.

Writes Markdown and JSON to ~/.gti/seo-growth/<project>/gsc/.

Usage:
    python3 gsc_queries.py Queries.csv
    python3 gsc_queries.py Queries.csv --min-words 6 --min-impressions 20 --ctr-floor 1.5
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common.gti import gti_dir, project_name, stamp  # noqa: E402

LONG_QUERY_REGEX = r"^(?:\S+\s+){7,}\S+$"
QUESTION_WORDS = (
    "how", "what", "why", "when", "where", "which", "who", "can", "does", "do", "is", "are", "should", "will",
    "como", "qual", "quais", "o que", "por que", "porque", "quando", "onde", "quanto", "quantos", "quem", "posso", "pode", "vale",
)

# Header aliases, compared after lowercasing and removing accents.
ALIASES = {
    "key": ("top queries", "query", "queries", "consultas principais", "consulta", "consultas",
            "top pages", "page", "pages", "paginas principais", "pagina", "paginas"),
    "clicks": ("clicks", "cliques"),
    "impressions": ("impressions", "impressoes"),
    "ctr": ("ctr",),
    "position": ("position", "posicao", "average position", "posicao media"),
}


def plain(text):
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    return " ".join(text.lower().replace("﻿", "").split())


def to_number(value, decimal_comma=None):
    """Parse '1,234', '1.234', '12.5%', '12,5%' and '' into a float.

    decimal_comma=True reads '3.400' as 3400 and '0,5' as 0.5; False reads commas as
    thousands; None guesses from the value alone.
    """
    text = str(value or "").strip().replace("%", "").replace(" ", "").replace(" ", "")
    if not text or text in ("-", "--"):
        return 0.0
    if decimal_comma is True:
        text = text.replace(".", "").replace(",", ".")
    elif decimal_comma is False:
        text = text.replace(",", "")
    elif "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        head, _, tail = text.rpartition(",")
        text = text.replace(",", "") if len(tail) == 3 and head.replace(",", "").isdigit() else text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def map_columns(headers):
    """Map each metric to its column. Comparison exports have two columns per metric; the first is the newer period."""
    mapping = {}
    for index, header in enumerate(headers):
        name = plain(header)
        for metric, names in ALIASES.items():
            # Comparison exports name columns like "Last 3 months Clicks" and "Previous 3 months Clicks".
            matched = name in names or (metric != "key" and any(name.endswith(" " + n) or name.startswith(n + " ") for n in names))
            if matched:
                mapping.setdefault(metric, []).append(index)
    if "key" not in mapping or "impressions" not in mapping:
        raise ValueError(f"not a Search Console export: headers are {headers}")
    return mapping


def read_rows(text):
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    headers = next(reader)
    mapping = map_columns(headers)
    key_header = plain(headers[mapping["key"][0]])
    kind = "page" if "pag" in key_header or "page" in key_header else "query"
    records = [raw for raw in reader if raw and raw[mapping["key"][0]].strip()]
    decimal_comma = dialect.delimiter == ";" or any(
        re.search(r"\d,\d+\s*%", raw[i]) for raw in records for i in mapping.get("ctr", []) if i < len(raw))
    rows = []
    for raw in records:
        row = {"key": raw[mapping["key"][0]].strip()}
        for metric in ("clicks", "impressions", "ctr", "position"):
            cols = mapping.get(metric, [])
            row[metric] = to_number(raw[cols[0]], decimal_comma) if cols and cols[0] < len(raw) else 0.0
            if len(cols) > 1 and cols[1] < len(raw):
                row[f"{metric}_previous"] = to_number(raw[cols[1]], decimal_comma)
        if "ctr" not in mapping and row["impressions"]:
            row["ctr"] = round(100 * row["clicks"] / row["impressions"], 2)
        rows.append(row)
    return kind, rows


def word_count(query):
    return len(query.split())


def is_question(query):
    q = plain(query)
    return q.endswith("?") or any(q == w or q.startswith(w + " ") for w in QUESTION_WORDS)


def analyze(kind, rows, min_words=8, min_impressions=10, ctr_floor=2.0, limit=50):
    result = {"kind": kind, "rows": len(rows), "settings": {
        "min_words": min_words, "min_impressions": min_impressions, "ctr_floor": ctr_floor, "regex": LONG_QUERY_REGEX}}
    by_impressions = sorted(rows, key=lambda r: (-r["impressions"], r["key"]))
    if kind == "query":
        long_rows = [dict(r, question=is_question(r["key"]), words=word_count(r["key"]))
                     for r in by_impressions if word_count(r["key"]) >= min_words and r["impressions"] > 0]
        result["long_questions"] = long_rows[:limit]
        result["long_questions_total"] = len(long_rows)
    page_two = [r for r in by_impressions if 8 <= r["position"] <= 20 and r["impressions"] >= min_impressions]
    low_ctr = [r for r in by_impressions if 0 < r["position"] <= 10 and r["impressions"] >= min_impressions and r["ctr"] < ctr_floor]
    result["page_two"] = page_two[:limit]
    result["page_two_total"] = len(page_two)
    result["low_ctr"] = low_ctr[:limit]
    result["low_ctr_total"] = len(low_ctr)
    if any("clicks_previous" in r for r in rows):
        declines = [dict(r, change=r["clicks"] - r["clicks_previous"]) for r in rows if r.get("clicks_previous", 0) > r["clicks"]]
        declines.sort(key=lambda r: (r["change"], r["key"]))
        result["declines"] = declines[:limit]
        result["declines_total"] = len(declines)
    return result


def _table(rows, extra=None):
    header = "| # | {} | Clicks | Impressions | CTR | Position |{}".format("Query or page", " " + extra[0] + " |" if extra else "")
    lines = [header, "|---" * (6 + (1 if extra else 0)) + "|"]
    for i, r in enumerate(rows, 1):
        cell = f" {extra[1](r)} |" if extra else ""
        key = r["key"].replace("|", "\\|")
        lines.append(f"| {i} | {key} | {int(r['clicks'])} | {int(r['impressions'])} | {r['ctr']:.2f}% | {r['position']:.1f} |{cell}")
    return lines or ["None"]


def to_markdown(result, source):
    s = result["settings"]
    lines = [f"# Search Console opportunities: {source}", "",
             f"- **Rows:** {result['rows']} ({result['kind']} export)",
             f"- **Settings:** {s['min_words']}+ words, {s['min_impressions']}+ impressions, CTR floor {s['ctr_floor']}%", ""]
    if "long_questions" in result:
        lines += [f"## Long questions ({result['long_questions_total']})", "",
                  "Answer each near the top of the page that already ranks for it (Search Console: click the query, then Pages).",
                  f"Search Console filter: Query, Custom (regex), `{s['regex']}`", ""]
        lines += _table(result["long_questions"], ("Question", lambda r: "yes" if r["question"] else "-")) if result["long_questions"] else ["None"]
        lines.append("")
    lines += [f"## Page 2: positions 8 to 20 ({result['page_two_total']})", "",
              "Compare with the top 5, add what is missing, answer in the first 40 words, add 3+ internal links.", ""]
    lines += _table(result["page_two"]) if result["page_two"] else ["None"]
    lines += ["", f"## Low CTR on page 1 ({result['low_ctr_total']})", "",
              "Rewrite the title (keyword first, 50 to 60 characters) and the meta description.", ""]
    lines += _table(result["low_ctr"]) if result["low_ctr"] else ["None"]
    if "declines" in result:
        lines += ["", f"## Lost clicks vs the previous period ({result['declines_total']})", "",
                  "Refresh: compare with the current top 10 and rewrite weak sections.", ""]
        lines += _table(result["declines"], ("Change", lambda r: str(int(r["change"])))) if result["declines"] else ["None"]
    lines.append("")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Find growth opportunities in a Google Search Console export.")
    parser.add_argument("csv", help="Queries.csv or Pages.csv from Search Console, Performance, Export")
    parser.add_argument("--min-words", type=int, default=8, help="Words for a long question (default 8)")
    parser.add_argument("--min-impressions", type=int, default=10, help="Impressions for page-2 and low-CTR rows (default 10)")
    parser.add_argument("--ctr-floor", type=float, default=2.0, help="CTR percent under which a page-1 row is low (default 2.0)")
    parser.add_argument("--limit", type=int, default=50, help="Rows per list (default 50)")
    parser.add_argument("--project", default=None, help="Project folder name under ~/.gti/seo-growth (default: git root name)")
    parser.add_argument("--out", default=None, help="Output folder (default: ~/.gti/seo-growth/<project>/gsc)")
    args = parser.parse_args(argv)

    source = Path(args.csv)
    text = source.read_text(encoding="utf-8-sig", errors="replace")
    try:
        kind, rows = read_rows(text)
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    result = analyze(kind, rows, args.min_words, args.min_impressions, args.ctr_floor, args.limit)
    out = Path(args.out) if args.out else gti_dir(args.project or project_name(), "gsc")
    out.mkdir(parents=True, exist_ok=True)
    name = f"gsc-{re.sub(r'[^a-z0-9]+', '-', source.stem.lower())}-{stamp()}"
    (out / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path = out / f"{name}.md"
    md_path.write_text(to_markdown(result, source.name), encoding="utf-8")
    parts = [f"{result['page_two_total']} page-2", f"{result['low_ctr_total']} low-CTR"]
    if "long_questions_total" in result:
        parts.insert(0, f"{result['long_questions_total']} long questions")
    print(f"{len(rows)} rows: " + ", ".join(parts) + ".")
    print(f"Report: {md_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
