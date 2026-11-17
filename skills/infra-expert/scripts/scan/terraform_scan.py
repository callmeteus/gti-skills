"""Inventory a Terraform or OpenTofu repository and list structural problems.

Read-only. It parses every .tf file with a small block reader (no Terraform
binary, no state, no credentials) and reports:

- every folder with its role (root, local module, unused module) and the
  resources it holds per layer (network, storage, data, identity,
  observability, compute, foundation; see references/concepts/layers.md);
- the module call graph and which local modules are shared by several callers;
- findings: copied resource blocks, hardcoded IDs and ARNs (also in tracked
  .tfvars files, counted across files), files that mix layers, oversized
  files, unpinned module sources and providers, missing default tags,
  security groups open to the internet, security groups that mix inline rules
  with separate rule resources, empty placeholder roots, roots that only call
  one module (several of them can be one root with for_each), temporary
  resources with no expiry, and cross-root coupling through
  terraform_remote_state.

Only files git tracks (or untracked files git does not ignore) are read, so
gitignored secrets such as *.auto.tfvars are never opened. Outside a git
repository every file is read.

Every finding is a lead to read, not a verdict.
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from hcl import attribute, blocks, nested, strip_comments, tracked, walk  # noqa: E402
from layers import LAYERS, layer_of  # noqa: E402

AWS_ID = re.compile(r'"((?:vpc|subnet|sg|igw|nat|rtb|eni|vol|snap|i|ami|acl|eipalloc|pcx|tgw|tgw-attach|vpce|lt|fs|fsap)'
                    r'-[0-9a-f]{8,17})"')
ARN = re.compile(r'"(arn:aws[a-z-]*:[^"$]+)"')
ACCOUNT = re.compile(r'"(\d{12})"')
CIDR = re.compile(r'"(\d{1,3}(?:\.\d{1,3}){3}/\d{1,2})"')
WORLD = ("0.0.0.0/0", "::/0")
WEB_PORTS = {"80", "443"}
TEMPORARY = re.compile(r"(?:^|[-_/.])(tmp|temp|temporary|preview|sandbox|poc|scratch|ephemeral|experiment|review|pr-\d+|test)(?:$|[-_/.\d])",
                       re.IGNORECASE)
EXPIRY = re.compile(r"\b(ttl|expires?|expiry|expiration|delete_after|destroy_after)\b", re.IGNORECASE)


def rel(path, root):
    return path.relative_to(root).as_posix()


def normalize(body):
    """Body text without comments, blank lines, or indentation, for comparing copies."""
    lines = (line.strip() for line in strip_comments(body).splitlines())
    return "\n".join(line for line in lines if line)


def parse_repo(root, only):
    files = {}
    for path in walk(root, {".tf"}, only):
        text = path.read_text(encoding="utf-8", errors="replace")
        files[rel(path, root)] = {"lines": text.count("\n") + 1, "blocks": list(blocks(text))}
    return files


def tfvars_values(root, only):
    """Map each hardcoded ID, ARN, or account number in tracked .tfvars files to the files that hold it."""
    places = defaultdict(set)
    for path in walk(root, {".tfvars", ".tfvars.json"}, only):
        text = path.read_text(encoding="utf-8", errors="replace")
        for value in AWS_ID.findall(text) + ARN.findall(text) + ACCOUNT.findall(text):
            places[value].add(rel(path, root))
    return places


def folder_of(file):
    parent = str(Path(file).parent.as_posix())
    return "." if parent in ("", ".") else parent


def module_target(folder, source):
    """Resolve a local module source ("./x" or "../x") to a folder relative to the root, else None."""
    source = source.strip('"')
    if not source.startswith(("./", "../")):
        return None
    parts = [] if folder == "." else folder.split("/")
    for part in source.split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return None
            parts.pop()
        else:
            parts.append(part)
    return "/".join(parts) or "."


def summarize(files):
    folders = defaultdict(lambda: {"files": [], "resources": Counter(), "data_sources": 0, "variables": 0,
                                   "outputs": 0, "modules": [], "backend": None, "providers": [],
                                   "remote_state": [], "default_tags": False, "required_providers": False})
    for file, info in files.items():
        folder = folders[folder_of(file)]
        folder["files"].append(file)
        for block in info["blocks"]:
            kind, labels = block["kind"], block["labels"]
            if kind == "resource" and labels:
                folder["resources"][layer_of(labels[0])] += 1
            elif kind == "data" and labels:
                folder["data_sources"] += 1
                if labels[0] == "terraform_remote_state":
                    key = attribute(block["body"], "key")
                    folder["remote_state"].append({"name": labels[-1], "key": (key or "").strip('"'), "file": file})
            elif kind == "variable":
                folder["variables"] += 1
            elif kind == "output":
                folder["outputs"] += 1
            elif kind == "module" and labels:
                source = (attribute(block["body"], "source") or "").strip('"')
                version = attribute(block["body"], "version")
                folder["modules"].append({"name": labels[0], "source": source, "version": version,
                                          "file": file, "line": block["line"]})
            elif kind == "terraform":
                for backend in re.findall(r'(?m)^\s*(?:backend|cloud)\s*(?:"([^"]+)")?\s*\{', block["body"]):
                    folder["backend"] = backend or "cloud"
                if nested(block["body"], "required_providers"):
                    folder["required_providers"] = True
            elif kind == "provider" and labels:
                folder["providers"].append(labels[0])
                if nested(block["body"], "default_tags"):
                    folder["default_tags"] = True
    return folders


def roles(folders):
    callers = defaultdict(list)
    for name, folder in folders.items():
        for module in folder["modules"]:
            target = module_target(name, module["source"])
            if target is not None:
                callers[target].append(name)
    result = {}
    for name, folder in folders.items():
        if folder["backend"] or (folder["providers"] and name not in callers):
            role = "root"
        elif name in callers:
            role = "module"
        else:
            role = "unused-module"
        resources = sum(folder["resources"].values())
        kind = "helper" if role != "root" and resources == 0 else None
        if role == "module" and resources and len(set(callers[name])) >= 2:
            kind = "shared-base"
        result[name] = {"role": role, "kind": kind, "callers": sorted(set(callers[name]))}
    return result


def find_copies(files, threshold):
    by_type = defaultdict(list)
    for file, info in files.items():
        for block in info["blocks"]:
            if block["kind"] == "resource" and len(block["labels"]) >= 2:
                text = normalize(block["body"])
                if text.count("\n") >= 2:
                    by_type[block["labels"][0]].append((file, block, text))
    groups = []
    for resource_type, items in by_type.items():
        used = set()
        for i, (file, block, text) in enumerate(items):
            if i in used:
                continue
            group = [(file, block)]
            for j in range(i + 1, len(items)):
                if j in used:
                    continue
                other_file, other_block, other_text = items[j]
                if SequenceMatcher(None, text, other_text, autojunk=False).ratio() >= threshold:
                    group.append((other_file, other_block))
                    used.add(j)
            if len(group) > 1:
                groups.append({
                    "type": resource_type,
                    "places": [f"{f}:{b['line']} ({b['labels'][1]})" for f, b in group],
                    "lines_each": block["end_line"] - block["line"] + 1,
                })
    return sorted(groups, key=lambda g: -len(g["places"]) * g["lines_each"])


def find_hardcoded(files):
    found = []
    for file, info in files.items():
        for block in info["blocks"]:
            if block["kind"] in ("variable", "moved", "import", "removed"):
                continue
            body = strip_comments(block["body"])
            values = AWS_ID.findall(body) + ARN.findall(body) + ACCOUNT.findall(body)
            layer = layer_of(block["labels"][0]) if block["kind"] == "resource" and block["labels"] else None
            if layer != "network" and block["kind"] != "locals":
                values += CIDR.findall(body)
            for value in sorted(set(v for v in values if v not in WORLD)):
                found.append({"file": file, "line": block["line"], "value": value,
                              "block": " ".join([block["kind"], *block["labels"]])})
    return found


def find_open_ingress(files):
    found = []
    for file, info in files.items():
        for block in info["blocks"]:
            if block["kind"] != "resource" or not block["labels"]:
                continue
            resource_type = block["labels"][0]
            rules = []
            if resource_type == "aws_security_group":
                rules = nested(block["body"], "ingress")
            elif resource_type == "aws_vpc_security_group_ingress_rule" or (
                    resource_type == "aws_security_group_rule" and '"ingress"' in block["body"]):
                rules = [block["body"]]
            for rule in rules:
                if not any(world in rule for world in WORLD):
                    continue
                from_port = (attribute(rule, "from_port") or "").strip('"')
                to_port = (attribute(rule, "to_port") or "").strip('"')
                protocol = (attribute(rule, "protocol") or attribute(rule, "ip_protocol") or "").strip('"')
                if protocol == "-1" or not (from_port == to_port and from_port in WEB_PORTS):
                    found.append({"file": file, "line": block["line"], "resource": ".".join(block["labels"][:2]),
                                  "ports": "all" if protocol == "-1" else f"{from_port}-{to_port}"})
    return found


def find_mixed_rule_styles(files):
    """Security groups with inline ingress or egress blocks that separate rule resources also target."""
    inline = {}
    targets = defaultdict(list)
    for file, info in files.items():
        for block in info["blocks"]:
            if block["kind"] != "resource" or len(block["labels"]) < 2:
                continue
            resource_type, name = block["labels"][:2]
            folder = folder_of(file)
            if resource_type == "aws_security_group" and (nested(block["body"], "ingress") or nested(block["body"], "egress")):
                inline[(folder, name)] = f"{file}:{block['line']}"
            elif resource_type in ("aws_security_group_rule", "aws_vpc_security_group_ingress_rule",
                                   "aws_vpc_security_group_egress_rule"):
                target = re.search(r"security_group_id\s*=\s*aws_security_group\.([\w-]+)\.id", block["body"])
                if target:
                    targets[(folder, target.group(1))].append(f"{file}:{block['line']}")
    return [{"security_group": f"{folder}/{name}", "inline_at": where, "separate_rules": targets[(folder, name)]}
            for (folder, name), where in sorted(inline.items()) if targets.get((folder, name))]


def find_temporary(files):
    found = []
    for file, info in files.items():
        for block in info["blocks"]:
            if block["kind"] not in ("resource", "module") or not block["labels"]:
                continue
            name = "/".join([file, *block["labels"]])
            if TEMPORARY.search(name) and not EXPIRY.search(block["body"]):
                found.append({"file": file, "line": block["line"], "block": " ".join([block["kind"], *block["labels"]])})
    return found


def build(root, copy_threshold, large_lines):
    only = tracked(root)
    files = parse_repo(root, only)
    folders = summarize(files)
    folder_roles = roles(folders)
    findings = defaultdict(list)

    findings["copied_blocks"] = find_copies(files, copy_threshold)
    findings["hardcoded_values"] = find_hardcoded(files)
    findings["open_ingress"] = find_open_ingress(files)
    findings["temporary_without_expiry"] = find_temporary(files)
    findings["mixed_rule_styles"] = find_mixed_rule_styles(files)

    repeated = defaultdict(set)
    for item in findings["hardcoded_values"]:
        repeated[item["value"]].add(item["file"])
    for value, places in tfvars_values(root, only).items():
        repeated[value].update(places)
    findings["repeated_hardcoded_values"] = sorted(
        ({"value": value, "files": len(places), "examples": sorted(places)[:3]} for value, places in repeated.items() if len(places) >= 2),
        key=lambda item: -item["files"])

    for file, info in files.items():
        resource_layers = Counter(layer_of(b["labels"][0]) for b in info["blocks"] if b["kind"] == "resource" and b["labels"])
        main_layers = [layer for layer, n in resource_layers.items() if layer not in ("foundation", "other")]
        if len(main_layers) >= 3:
            findings["mixed_layers"].append({"file": file, "layers": dict(resource_layers)})
        resources = sum(resource_layers.values())
        if info["lines"] > large_lines or resources > 25:
            findings["large_files"].append({"file": file, "lines": info["lines"], "resources": resources})

    single_calls = defaultdict(list)
    for name, folder in folders.items():
        for module in folder["modules"]:
            source = module["source"]
            local = source.startswith(("./", "../"))
            registry = not local and "::" not in source and not source.startswith(("git@", "github.com", "bitbucket.org", "s3::", "gcs::", "http"))
            pinned = (registry and module["version"]) or "?ref=" in source or local
            if not pinned:
                findings["unpinned_modules"].append({"file": module["file"], "line": module["line"], "module": module["name"],
                                                     "source": source})
        role = folder_roles[name]["role"]
        resources = sum(folder["resources"].values())
        if role == "root" and not resources and not folder["modules"] and not folder["data_sources"]:
            findings["placeholder_roots"].append({"folder": name})
        if role == "root" and not resources and len(folder["modules"]) == 1:
            single_calls[module_target(name, folder["modules"][0]["source"]) or folder["modules"][0]["source"]].append(name)
        if role == "root":
            if not folder["required_providers"]:
                findings["unpinned_providers"].append({"folder": name})
            if "aws" in folder["providers"] and not folder["default_tags"] and folder["resources"]:
                findings["no_default_tags"].append({"folder": name})
            if not folder["backend"]:
                findings["local_state"].append({"folder": name})
        if role == "unused-module":
            findings["unused_modules"].append({"folder": name})
        for remote in folder["remote_state"]:
            findings["remote_state_coupling"].append({"folder": name, **remote})

    for module, roots in sorted(single_calls.items()):
        if len(roots) >= 2:
            findings["one_call_roots"].append({"module": module, "roots": roots})

    report = {
        "root": str(Path(root).resolve()),
        "git_tracked_only": only is not None,
        "files": len(files),
        "folders": [],
        "findings": {key: value for key, value in findings.items() if value},
    }
    for name in sorted(folders):
        folder = folders[name]
        report["folders"].append({
            "path": name,
            **folder_roles[name],
            "resources": {layer: folder["resources"][layer] for layer in LAYERS if folder["resources"][layer]},
            "data_sources": folder["data_sources"],
            "variables": folder["variables"],
            "outputs": folder["outputs"],
            "backend": folder["backend"],
            "modules": [{"name": m["name"], "source": m["source"]} for m in folder["modules"]],
        })
    return report


def print_text(report, limit):
    print(f"{report['files']} .tf files in {len(report['folders'])} folders under {report['root']}\n")
    print("Folders (role, kind, resources per layer):")
    for folder in report["folders"]:
        layers = ", ".join(f"{k} {v}" for k, v in folder["resources"].items()) or "no resources"
        if folder["modules"]:
            layers += f"; {len(folder['modules'])} module calls"
        kind = f" [{folder['kind']}]" if folder["kind"] else ""
        callers = f" <- {', '.join(folder['callers'])}" if folder["callers"] else ""
        print(f"  {folder['path']}: {folder['role']}{kind}; {layers}{callers}")
    for key, items in report["findings"].items():
        print(f"\n{key.replace('_', ' ')} ({len(items)}):")
        for item in items[:limit]:
            print("  " + "; ".join(f"{k}={v}" for k, v in item.items()))
        if len(items) > limit:
            print(f"  ... {len(items) - limit} more (use --json for all)")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default=".", help="Repository or folder to scan (default: current folder)")
    parser.add_argument("--json", action="store_true", help="Print the full inventory as JSON")
    parser.add_argument("--copy-threshold", type=float, default=0.9,
                        help="Similarity from 0 to 1 above which two resource blocks count as copies (default 0.9)")
    parser.add_argument("--large-lines", type=int, default=400, help="Line count above which a file is oversized (default 400)")
    parser.add_argument("--limit", type=int, default=15, help="Rows to print per finding in text mode (default 15)")
    args = parser.parse_args()

    if not Path(args.root).is_dir():
        raise SystemExit(f"not a folder: {args.root}")
    report = build(args.root, args.copy_threshold, args.large_lines)
    if args.json:
        print(json.dumps(report, indent=2))
    elif not report["files"]:
        print("no .tf files found", file=sys.stderr)
    else:
        print_text(report, args.limit)


if __name__ == "__main__":
    main()
