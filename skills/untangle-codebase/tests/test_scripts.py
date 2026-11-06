"""Tests for the untangle-codebase helper scripts.

Each test builds a small project in a temporary folder, sometimes with a git history,
and checks what the scripts report about it.
"""

import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

from map import cochange, deps, skeleton  # noqa: E402
from measure import special_cases  # noqa: E402

HAS_GIT = shutil.which("git") is not None


def write(root, files):
    for relative, text in files.items():
        path = Path(root) / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def git(root, *args):
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
           "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
    subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True, env=env)


def commit(root, files, message="change"):
    write(root, files)
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", message)


class ProjectTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="untangle-"))

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)


class DepsTest(ProjectTest):
    def test_resolves_python_absolute_relative_and_src_layout_imports(self):
        write(self.root, {
            "src/shop/__init__.py": "",
            "src/shop/cart.py": "from .pricing import total\nfrom shop.tax import rate\n",
            "src/shop/pricing.py": "import shop.tax\n",
            "src/shop/tax.py": "RATE = 1\n",
        })
        graph = deps.build_graph(self.root, depth=0)
        edges = {(e["from"], e["to"]) for e in graph["edges"]}
        self.assertIn(("src/shop/cart.py", "src/shop/pricing.py"), edges)
        self.assertIn(("src/shop/cart.py", "src/shop/tax.py"), edges)
        self.assertIn(("src/shop/pricing.py", "src/shop/tax.py"), edges)

    def test_resolves_typescript_relative_index_js_extension_and_alias_imports(self):
        write(self.root, {
            "src/app.ts": 'import { a } from "./lib";\nimport b from "./util.js";\nimport c from "@/conf";\nimport React from "react";\n',
            "src/lib/index.ts": "export const a = 1;\n",
            "src/util.ts": "export default 2;\n",
            "src/conf.ts": "export default 3;\n",
        })
        graph = deps.build_graph(self.root, depth=0, aliases=[("@/", "src/")])
        targets = {e["to"] for e in graph["edges"] if e["from"] == "src/app.ts"}
        self.assertEqual(targets, {"src/lib/index.ts", "src/util.ts", "src/conf.ts"})

    def test_resolves_go_packages_under_the_module_path(self):
        write(self.root, {
            "go.mod": "module example.com/shop\n\ngo 1.22\n",
            "cmd/api/main.go": 'package main\n\nimport (\n\t"fmt"\n\t"example.com/shop/internal/cart"\n)\n',
            "internal/cart/cart.go": "package cart\n",
        })
        graph = deps.build_graph(self.root, depth=2)
        self.assertEqual([(e["from"], e["to"]) for e in graph["edges"]], [("cmd/api", "internal/cart")])

    def test_finds_cycles_between_groups(self):
        write(self.root, {
            "billing/invoice.py": "from orders import order\n",
            "orders/order.py": "from billing import invoice\n",
            "billing/__init__.py": "", "orders/__init__.py": "",
        })
        graph = deps.build_graph(self.root, depth=1)
        self.assertEqual(graph["cycles"], [["billing", "orders"]])

    @unittest.skipUnless(HAS_GIT, "git is not installed")
    def test_flags_a_stable_group_that_imports_a_more_volatile_one(self):
        git(self.root, "init", "-q")
        commit(self.root, {"core/model.py": "from ui import view\n", "core/__init__.py": "", "ui/__init__.py": "", "ui/view.py": "X = 0\n"})
        for number in range(1, 7):
            commit(self.root, {"ui/view.py": f"X = {number}\n"})
        graph = deps.build_graph(self.root, depth=1)
        flagged = deps.volatile_imports(graph, ratio=2.0, minimum=5)
        self.assertEqual([(e["from"], e["to"]) for e in flagged], [("core", "ui")])
        self.assertEqual(flagged[0]["to_changes"], 8)  # view.py 7 + __init__.py 1


@unittest.skipUnless(HAS_GIT, "git is not installed")
class CochangeTest(ProjectTest):
    def test_reports_files_in_different_folders_that_change_together(self):
        git(self.root, "init", "-q")
        commit(self.root, {"api/routes.py": "a = 0\n", "web/forms.ts": "let a = 0;\n", "api/other.py": "b = 0\n"})
        for number in range(1, 5):
            commit(self.root, {"api/routes.py": f"a = {number}\n", "web/forms.ts": f"let a = {number};\n"})
        commit(self.root, {"api/other.py": "b = 1\n"})

        result = cochange.cochange(self.root, min_together=3, depth=1)
        pair = result["pairs"][0]
        self.assertEqual((pair["a"], pair["b"]), ("api/routes.py", "web/forms.ts"))
        self.assertTrue(pair["cross_folder"])
        self.assertEqual(pair["together"], 5)
        self.assertEqual(pair["confidence"], 1.0)

    def test_skips_commits_that_touch_too_many_files(self):
        git(self.root, "init", "-q")
        files = {f"pkg/m{n}.py": "x = 0\n" for n in range(5)}
        for number in range(4):
            commit(self.root, {name: f"x = {number}\n" for name in files})
        result = cochange.cochange(self.root, max_files=3, min_together=1)
        self.assertEqual(result["commits_used"], 0)
        self.assertEqual(result["pairs"], [])


class SkeletonTest(ProjectTest):
    def test_python_keeps_signatures_and_docstrings_and_folds_bodies(self):
        text = 'import os\nLIMIT = 3\n\nclass Store:\n    """Keeps things.\n\n    More."""\n    def get(self, key):\n        return os.getenv(key)\n'
        lines = [line for _, line in skeleton.python_skeleton(text)]
        self.assertEqual(lines, ["import os", "LIMIT = 3", "class Store:", '    """Keeps things."""', "    def get(self, key):", "        ..."])

    def test_brace_languages_keep_class_members_and_fold_function_bodies(self):
        text = (
            "export class Cart {\n"
            "  items = [];\n"
            "  add(item) {\n"
            '    if (item) { this.items.push("{" + item); }\n'
            "  }\n"
            "}\n"
            "export function total(cart) {\n"
            "  // a } in a comment\n"
            "  return cart.items.length;\n"
            "}\n"
            "const after = 1;\n"
        )
        lines = [line for _, line in skeleton.brace_skeleton(text)]
        self.assertEqual(lines, [
            "export class Cart {", "  items = [];", "  add(item) {", "    ...", "}",
            "export function total(cart) {", "  ...", "const after = 1;",
        ])

    def test_brace_on_its_own_line_uses_the_previous_line_as_header(self):
        text = "public class Cart\n{\n    public int Size()\n    {\n        return 1;\n    }\n}\n"
        lines = [line for _, line in skeleton.brace_skeleton(text)]
        self.assertEqual(lines, ["public class Cart", "{", "    public int Size()", "    {", "        ...", "}"])


class SpecialCasesTest(ProjectTest):
    def test_counts_each_category_and_ignores_type_checks(self):
        write(self.root, {
            "app.py": "import time\ntry:\n    go()\nexcept Exception:\n    pass\ntime.sleep(1)\nif user == 'admin':\n    pass\n# TODO: remove\n",
            "web.ts": 'try { a(); } catch (e) {}\nif (typeof x === "string") {}\nif (kind === "legacy") {}\n// @ts-ignore\nsetTimeout(() => f(), 100);\n',
            "tests/test_app.py": "import pytest\n@pytest.mark.skip\ndef test_x():\n    pass\n",
        })
        result = special_cases.scan(self.root)
        counts = result["counts"]
        self.assertEqual(counts["swallowed_exception"], 2)
        self.assertEqual(counts["sleep"], 2)
        self.assertEqual(counts["literal_branch"], 2)
        self.assertEqual(counts["suppression"], 1)
        self.assertEqual(counts["marker_comment"], 1)
        self.assertEqual(counts["disabled_test"], 1)

    def test_compare_reports_the_change_against_a_saved_baseline(self):
        write(self.root, {"a.py": "if mode == 'x':\n    pass\nif mode == 'y':\n    pass\n"})
        baseline_file = self.root / ".untangle" / "baseline.json"
        with redirect_stdout(io.StringIO()):
            special_cases.main([str(self.root), "--save", str(baseline_file)])
        write(self.root, {"a.py": "HANDLERS = {}\n"})

        out = io.StringIO()
        with redirect_stdout(out):
            special_cases.main([str(self.root), "--compare", str(baseline_file), "--json"])
        comparison = json.loads(out.getvalue())["comparison"]
        self.assertEqual((comparison["before"], comparison["after"], comparison["delta"]), (2, 0, -2))


if __name__ == "__main__":
    unittest.main()
