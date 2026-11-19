"""Look up CVE facts in OSV and in the CISA KEV feed, offline or online.

Commands:

    osv --id CVE-2026-12345 [--from-file PATH]
    query --ecosystem Debian:12 --package nginx --version 1.31.8 [--from-file PATH] [--state [PATH]]
    kev --id CVE-2026-12345 [--from-file PATH]

With --from-file the JSON response is read from that file, so the commands work
offline and tests never touch the network. With --state on query, only IDs not
already in the state file are printed; seen and last_run are then updated. When
there are no new IDs, nothing is printed.

All output is compact JSON on stdout. Errors are one line on stderr and exit 3.
Standard library only, Python 3.8+. Use python3 on macOS and Linux and python
or py -3 on Windows.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TIMEOUT = 20
OSV_VULN = "https://api.osv.dev/v1/vulns/"
OSV_QUERY = "https://api.osv.dev/v1/query"
KEV_FEED = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
DEFAULT_STATE = "__default__"


def gti_dir(skill, *parts):
    """Folder for generated files: ~/.gti/<skill>/... (GTI_HOME replaces ~/.gti). Never the user's repository."""
    base = Path(os.environ.get("GTI_HOME") or Path.home() / ".gti").expanduser()
    folder = base.joinpath(skill, *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def project_name(start=None):
    """Name of the project being worked on: the git root's folder name, or the current folder's."""
    here = Path(start or Path.cwd()).resolve()
    for folder in (here, *here.parents):
        if (folder / ".git").exists():
            return folder.name or "project"
    return here.name or "project"


def die(message):
    print(f"error: {message}", file=sys.stderr)
    sys.exit(3)


def fetch(url, payload=None, from_file=None):
    """Return the parsed JSON body from a file or from the network."""
    if from_file:
        path = Path(from_file).expanduser()
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            die(f"could not read {path}: {exc}")
    request = urllib.request.Request(url)
    if payload is not None:
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        die(f"could not fetch {url}: {exc}")


def emit(value):
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def fixed_versions(affected):
    """Fixed versions from the events of every affected range, in first-seen order."""
    found = []
    for item in affected or []:
        for rng in item.get("ranges") or []:
            for event in rng.get("events") or []:
                version = event.get("fixed")
                if version and version not in found:
                    found.append(version)
    return found


def compact_osv(payload):
    affected = []
    for item in payload.get("affected") or []:
        package = item.get("package") or {}
        ranges = [
            {"type": rng.get("type", ""), "events": rng.get("events") or []}
            for rng in item.get("ranges") or []
        ]
        affected.append({
            "package": {
                "ecosystem": package.get("ecosystem", ""),
                "name": package.get("name", ""),
            },
            "ranges": ranges,
            "fixed": fixed_versions([item]),
        })
    return {
        "id": payload.get("id", ""),
        "aliases": payload.get("aliases") or [],
        "summary": payload.get("summary", ""),
        "affected": affected,
        "severity": payload.get("severity") or [],
        "references": payload.get("references") or [],
    }


def compact_query(payload):
    matches = []
    for vuln in payload.get("vulns") or []:
        matches.append({
            "id": vuln.get("id", ""),
            "summary": vuln.get("summary", ""),
            "fixed": fixed_versions(vuln.get("affected")),
        })
    return matches


def compact_kev(payload, cve_id):
    entry = next(
        (item for item in payload.get("vulnerabilities") or [] if item.get("cveID") == cve_id),
        None,
    )
    return {
        "id": cve_id,
        "listed": entry is not None,
        "dateAdded": entry.get("dateAdded") if entry else None,
    }


def resolve_state(value):
    if value == DEFAULT_STATE:
        return gti_dir("infra-expert", project_name(), "cve") / "state.json"
    return Path(value).expanduser()


def load_state(path):
    if not path.exists():
        return {"last_run": None, "seen": []}
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        die(f"could not read state file {path}: {exc}")
    if not isinstance(state, dict):
        die(f"state file {path} must hold a JSON object")
    seen = state.get("seen") or []
    if not isinstance(seen, list):
        die(f"state file {path}: 'seen' must be a list")
    return {"last_run": state.get("last_run"), "seen": [str(item) for item in seen]}


def save_state(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def queried_with_state(matches, state_arg):
    """Filter matches against seen, update the state file, and return the new ones."""
    path = resolve_state(state_arg)
    state = load_state(path)
    seen = set(state["seen"])
    new = [match for match in matches if match["id"] not in seen]
    seen.update(match["id"] for match in matches)
    state["seen"] = sorted(seen)
    state["last_run"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    save_state(path, state)
    return new


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)

    osv_parser = commands.add_parser("osv", help="Facts about one CVE from OSV")
    osv_parser.add_argument("--id", required=True, help="CVE ID, for example CVE-2026-12345")
    osv_parser.add_argument("--from-file", metavar="PATH", help="Read the OSV response from this JSON file")

    query_parser = commands.add_parser("query", help="CVEs that match a package version in OSV")
    query_parser.add_argument("--ecosystem", required=True, help="OSV ecosystem, for example Debian:12")
    query_parser.add_argument("--package", required=True, help="Package name as OSV knows it")
    query_parser.add_argument("--version", required=True, help="Exact version read from the host")
    query_parser.add_argument("--from-file", metavar="PATH", help="Read the query response from this JSON file")
    query_parser.add_argument("--state", nargs="?", const=DEFAULT_STATE, default=None, metavar="PATH",
                              help="Print only unseen IDs and update seen and last_run (default: state.json under ~/.gti)")

    kev_parser = commands.add_parser("kev", help="Check the CISA Known Exploited Vulnerabilities feed")
    kev_parser.add_argument("--id", required=True, help="CVE ID to look for")
    kev_parser.add_argument("--from-file", metavar="PATH", help="Read the KEV feed from this JSON file")

    args = parser.parse_args()

    if args.command == "osv":
        payload = fetch(OSV_VULN + urllib.parse.quote(args.id, safe=""), from_file=args.from_file)
        emit(compact_osv(payload))
    elif args.command == "query":
        payload = fetch(OSV_QUERY, payload={
            "package": {"ecosystem": args.ecosystem, "name": args.package},
            "version": args.version,
        }, from_file=args.from_file)
        matches = compact_query(payload)
        if args.state is not None:
            new = queried_with_state(matches, args.state)
            if new:
                emit({"matches": new})
        else:
            emit({"matches": matches})
    else:
        payload = fetch(KEV_FEED, from_file=args.from_file)
        emit(compact_kev(payload, args.id))


if __name__ == "__main__":
    main()
