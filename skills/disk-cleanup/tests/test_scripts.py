"""Tests for the Disk Cleanup scripts.

Drive detection is tested on mount tables and volume labels written as text, so Google Drive on any letter, rclone
mounts, and btrfs subvolumes are covered on every system. The scan and the cleaner run against folders in a
temporary directory with a small platform whose home is that directory. Nothing outside it is read or deleted.
"""

import io
import json
import os
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

from cleanup import fsutil, scanners  # noqa: E402
from cleanup.clean import Guard, choose, execute  # noqa: E402
from cleanup.drives import Drive, classify, google_drive_reason, select  # noqa: E402
from cleanup.model import DEFAULT_PREFERENCES, Finding, parse_human, parse_level, within  # noqa: E402
from platforms.base import Context, Platform  # noqa: E402
from platforms.linux import group_drives, parse_mountinfo  # noqa: E402
from platforms.macos import parse_df  # noqa: E402
from platforms.base import unused_program  # noqa: E402
from platforms.windows import SKIP_PROGRAMS, parse_shadow_storage, parse_userassist, uac_launch  # noqa: E402

DAY = 86400


def write(path, data=b"x", age_days=0):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if age_days:
        old = time.time() - age_days * DAY
        os.utime(path, (old, old))
    return str(path)


class FakePlatform(Platform):
    name = "test"

    def __init__(self, home):
        super().__init__()
        self.home = Path(home)

    def protected_paths(self):
        return super().protected_paths() + [str(self.home)]

    def data_roots(self, ctx, drive):
        return [str(self.home)]


def context(home, level="aggressive", **prefs):
    drive = Drive(id="T", mountpoints=[str(home)], system=True)
    return Context(level=level, prefs={**DEFAULT_PREFERENCES, "min_duplicate_mb": 0, "min_finding_mb": 0, **prefs},
                   drives=[drive], selected=[drive], elevated=False, jobs=2)


class LevelTests(unittest.TestCase):
    def test_portuguese_and_english_names(self):
        self.assertEqual(parse_level("seguro"), "safe")
        self.assertEqual(parse_level("Agressivo"), "aggressive")
        self.assertEqual(parse_level("não ligo"), "yolo")
        self.assertEqual(parse_level("nao-ligo"), "yolo")
        with self.assertRaises(ValueError):
            parse_level("tudo")

    def test_a_level_includes_the_levels_below_it(self):
        self.assertTrue(within("safe", "aggressive"))
        self.assertTrue(within("aggressive", "yolo"))
        self.assertFalse(within("yolo", "aggressive"))

    def test_sizes_from_tool_output(self):
        self.assertEqual(parse_human("1.5GB"), int(1.5 * 1024 ** 3))
        self.assertEqual(parse_human("512 MiB"), 512 * 1024 ** 2)
        self.assertEqual(parse_human("2,5 GB"), int(2.5 * 1024 ** 3))
        self.assertEqual(parse_human("nothing"), 0)


class DriveTests(unittest.TestCase):
    def test_google_drive_is_found_by_label_on_any_letter(self):
        for letter in ("G:", "H:", "Z:"):
            drive = classify(Drive(id=letter, mountpoints=[letter + "\\"], label="Google Drive", fstype="FAT32"))
            self.assertTrue(drive.excluded, letter)
            self.assertIn("Google Drive", drive.exclude_reason)

    def test_google_drive_is_found_by_its_folders_when_the_label_was_renamed(self):
        reason = google_drive_reason(label="Trabalho", fstype="FAT32", mountpoint="K:\\",
                                     root_names=["Meu Drive", "Drives compartilhados"])
        self.assertIn("Google Drive layout", reason)

    def test_google_drive_is_found_by_the_registry_mount_point(self):
        reason = google_drive_reason(label="Data", fstype="NTFS", mountpoint="M:\\", registry_mounts=["M"])
        self.assertTrue(reason)

    def test_rclone_and_ocamlfuse_mounts_are_excluded(self):
        for fstype in ("fuse.rclone", "fuse.google-drive-ocamlfuse"):
            drive = classify(Drive(id="/mnt/g", mountpoints=["/mnt/g"], fstype=fstype))
            self.assertTrue(drive.excluded, fstype)

    def test_a_normal_data_drive_is_not_excluded(self):
        drive = classify(Drive(id="D:", mountpoints=["D:\\"], label="Dados", fstype="NTFS"), ["Fotos", "Jogos"])
        self.assertFalse(drive.excluded)

    def test_auto_mode_selects_only_the_system_drive(self):
        drives = [Drive(id="C:", mountpoints=["C:\\"], system=True), Drive(id="D:", mountpoints=["D:\\"])]
        selected, _ = select(drives, ["D:"], auto=True)
        self.assertEqual([d.id for d in selected], ["C:"])

    def test_naming_google_drive_never_selects_it(self):
        gdrive = classify(Drive(id="G:", mountpoints=["G:\\"], label="Google Drive"))
        drives = [Drive(id="C:", mountpoints=["C:\\"], system=True), Drive(id="D:", mountpoints=["D:\\"]), gdrive]
        selected, refused = select(drives, ["d", "G:"])
        self.assertEqual([d.id for d in selected], ["D:"])
        self.assertEqual(refused[0][0], "G:")
        self.assertIn("Google Drive", refused[0][1])

    def test_mountinfo_groups_btrfs_subvolumes_and_drops_virtual_file_systems(self):
        text = "\n".join([
            "29 1 0:26 /@ / rw,relatime shared:1 - btrfs /dev/nvme0n1p2 rw",
            "30 29 0:26 /@home /home rw,relatime shared:2 - btrfs /dev/nvme0n1p2 rw",
            "31 29 0:5 / /proc rw - proc proc rw",
            "32 29 7:1 / /snap/core/1 ro - squashfs /dev/loop1 ro",
            "33 29 0:40 / /var/lib/lxcfs rw - fuse.lxcfs lxcfs rw",
            "34 29 8:17 / /mnt/My\\040Data rw - ext4 /dev/sdb1 rw",
            "35 29 0:50 / /home/u/gdrive rw - fuse.rclone gdrive: rw",
        ])
        drives = group_drives(parse_mountinfo(text), labels={"/dev/sdb1": "Data"})
        by_id = {d.id: d for d in drives}
        self.assertEqual(by_id["/"].mountpoints, ["/", "/home"])
        self.assertTrue(by_id["/"].system)
        self.assertEqual(by_id["/dev/sdb1"].mountpoints, ["/mnt/My Data"])
        self.assertNotIn("/var/lib/lxcfs", [m for d in drives for m in d.mountpoints])
        rclone = classify(by_id["/home/u/gdrive"])
        self.assertTrue(rclone.excluded)

    def test_macos_df_parsing_keeps_names_with_spaces(self):
        text = ("Filesystem 1024-blocks Used Available Capacity Mounted on\n"
                "/dev/disk3s1s1 488245288 10000000 200000000 5% /\n"
                "/dev/disk5s1 976762584 1000 976761584 1% /Volumes/Backup Disk\n")
        rows = parse_df(text)
        self.assertEqual(rows[1][1], "/Volumes/Backup Disk")
        self.assertEqual(rows[0][3], 200000000 * 1024)

    def test_vssadmin_output_in_portuguese(self):
        text = ("Espaço de Armazenamento de Cópia de Sombra Usado: 12,5 GB (6%)\n"
                "Espaço de Armazenamento de Cópia de Sombra Alocado: 13 GB (6%)\n"
                "Espaço Máximo de Armazenamento de Cópia de Sombra: 46,5 GB (20%)\n")
        [(used, _allocated, maximum, percent)] = parse_shadow_storage(text)
        self.assertEqual(percent, 20)
        self.assertGreater(maximum, used)

    def test_sysinternals_du_csv(self):
        text = "Path,CurrentFileCount,CurrentFileSize,FileCount,DirectoryCount,DirectorySize,DirectorySizeOnDisk\n" \
               "C:\\Temp,3,100,10,2,5000,8192\n"
        self.assertEqual(fsutil.parse_sysinternals_du(text), 8192)


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.platform = FakePlatform(self.home)

    def tearDown(self):
        self.tmp.cleanup()

    def test_duplicates_keep_the_original_and_skip_programs_and_repositories(self):
        photo = b"photo" * 1000
        original = write(self.home / "Pictures/trip/beach.jpg", photo, age_days=100)
        write(self.home / "Downloads/beach (1).jpg", photo)
        write(self.home / "sdk/toolchains/lib/libfoo.so", b"lib" * 1000)
        write(self.home / "Android/ndk/lib/libfoo.so", b"lib" * 1000)
        write(self.home / "project/.git/HEAD", b"ref")
        write(self.home / "project/notes.md", b"same text" * 100)
        write(self.home / "Documents/notes.md", b"same text" * 100)
        ctx = context(self.home)
        findings, _ = scanners.scan_data(self.platform, ctx)
        dups = [f for f in findings if f.category == "duplicates"]
        self.assertEqual(len(dups), 1)
        self.assertEqual(dups[0].keep, original)
        self.assertEqual(dups[0].paths, [str(self.home / "Downloads/beach (1).jpg")])
        self.assertEqual(dups[0].level, "aggressive")

    def test_deep_trees_are_walked_in_worker_processes(self):
        video = b"video" * 2000
        deep = self.home / "Videos" / "a" / "b" / "c" / "d" / "e" / "f"
        write(deep / "clip.mp4", video)
        write(self.home / "Downloads" / "x" / "y" / "z" / "w" / "v" / "clip.mp4", video)
        ctx = context(self.home)
        walk = scanners.walk_data(self.platform, ctx, [str(self.home)])
        self.assertEqual(walk.files, 2)
        self.assertEqual(len(walk.by_size[len(video)]), 2)
        self.assertFalse(any("Process pool unavailable" in n for n in ctx.notes), ctx.notes)

    def test_a_copy_in_a_backup_folder_is_kept_and_needs_yolo(self):
        data = b"contract" * 1000
        write(self.home / "Documents/contract.pdf", data)
        backup = write(self.home / "Backup 2024/contract.pdf", data)
        ctx = context(self.home)
        [dup] = [f for f in scanners.scan_data(self.platform, ctx)[0] if f.category == "duplicates"]
        self.assertEqual(dup.keep, backup)
        self.assertEqual(dup.level, "yolo")
        self.assertFalse(dup.auto)

    def test_build_folders_need_their_marker_and_stale_projects_are_aggressive(self):
        write(self.home / "old-app/package.json", b"{}", age_days=400)
        write(self.home / "old-app/node_modules/lib/index.js", b"x" * 5000, age_days=400)
        os.utime(self.home / "old-app", (time.time() - 400 * DAY,) * 2)
        os.utime(self.home / "old-app/node_modules", (time.time() - 400 * DAY,) * 2)
        write(self.home / "photos/build/IMG_1.jpg", b"y" * 5000)
        ctx = context(self.home)
        dev = [f for f in scanners.scan_data(self.platform, ctx)[0] if f.category == "dev"]
        self.assertEqual([os.path.basename(f.paths[0]) for f in dev], ["node_modules"])
        self.assertEqual(dev[0].level, "aggressive")

    def test_old_installers_in_downloads(self):
        write(self.home / "Downloads/setup.exe", b"z" * 4096, age_days=60)
        write(self.home / "Downloads/new.dmg", b"z" * 4096, age_days=1)
        write(self.home / "Downloads/photos.zip", b"z" * 4096, age_days=60)
        (self.home / "Downloads/photos").mkdir()
        ctx = context(self.home)
        found = {f.title: f for f in scanners.download_findings(self.platform, ctx)}
        installers = [f for t, f in found.items() if t.startswith("Installers") and f.level == "aggressive"][0]
        self.assertEqual([os.path.basename(p) for p in installers.paths], ["setup.exe"])
        self.assertTrue(any(t.startswith("Archives in Downloads already extracted") for t in found))
        self.assertFalse(any("new.dmg" in p for f in found.values() for p in f.paths))

    def test_emptying_a_temp_folder_keeps_recent_files_and_sockets_names(self):
        old = write(self.home / "tmp/old.log", b"a" * 100, age_days=10)
        new = write(self.home / "tmp/new.log", b"b" * 100)
        kept = write(self.home / "tmp/.X11-unix/X0", b"", age_days=10)
        freed, removed, errors = fsutil.empty_folder(self.home / "tmp", older_than_days=2)
        self.assertFalse(os.path.exists(old))
        self.assertTrue(os.path.exists(new))
        self.assertTrue(os.path.exists(kept))
        self.assertEqual((removed, errors), (1, []))


class CleanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        self.platform = FakePlatform(self.home)
        drive = Drive(id="T", mountpoints=[str(self.home)], system=True)
        self.guard = Guard(self.platform, [drive], ["T"])

    def tearDown(self):
        self.tmp.cleanup()

    def finding(self, **kw):
        base = dict(category="caches", title="cache", action="delete_contents", level="safe", auto=True)
        return Finding(**{**base, **kw})

    def test_nothing_is_chosen_without_ids_categories_or_auto(self):
        chosen, _ = choose([self.finding()], "yolo")
        self.assertEqual(chosen, [])

    def test_auto_mode_takes_only_auto_findings_within_the_level(self):
        safe = self.finding(title="a")
        yolo = self.finding(title="b", level="yolo")
        volumes = self.finding(title="c", action="command", command=["docker", "volume", "prune"], auto=False)
        setting = self.finding(title="d", action="setting", category="config", command=["x"])
        admin = self.finding(title="e", admin=True)
        chosen, skipped = choose([safe, yolo, volumes, setting, admin], "aggressive", auto=True, run_commands=True)
        self.assertEqual([f.title for f in chosen], ["a"])
        reasons = {f.title: r for f, r in skipped}
        self.assertNotIn("b", reasons)  # above the level: out of scope, not pending
        self.assertIn("explicit yes", reasons["c"])
        self.assertIn("never in automatic mode", reasons["d"])
        self.assertIn("administrator", reasons["e"])

    def test_an_id_the_user_named_runs_whatever_its_level(self):
        yolo = self.finding(title="y", level="yolo")
        chosen, skipped = choose([yolo], "safe", ids=[yolo.id])
        self.assertEqual(chosen, [yolo])
        self.assertEqual(choose([yolo], "safe", categories=["caches"])[0], [])

    def test_a_setting_runs_only_by_id_with_the_system_flag(self):
        setting = self.finding(action="setting", category="config", command=["x"])
        self.assertEqual(choose([setting], "yolo", ids=[setting.id])[0], [])
        self.assertEqual(choose([setting], "yolo", ids=[setting.id], allow_system=True)[0], [setting])

    def test_manual_steps_are_never_run(self):
        manual = self.finding(action="setting", category="config", command="Settings > Storage", manual=True)
        chosen, skipped = choose([manual], "yolo", ids=[manual.id], allow_system=True)
        self.assertEqual(chosen, [])
        self.assertIn("manual", skipped[0][1])

    def test_guard_refuses_protected_denied_linked_and_foreign_paths(self):
        write(self.home / ".ssh/id_ed25519")
        write(self.home / "Documents/a.txt")
        self.assertIn("protected", self.guard.check(str(self.home / "Documents")))
        self.assertIn("never touched", self.guard.check(str(self.home / ".ssh/id_ed25519")))
        self.assertIsNone(self.guard.check(str(self.home / "Documents/a.txt")))
        if hasattr(os, "symlink"):
            os.symlink(self.home / "Documents", self.home / "link")
            self.assertIn("link", self.guard.check(str(self.home / "link")))
        other = tempfile.mkdtemp()
        try:
            self.assertIn("not on any known drive", self.guard.check(other))
        finally:
            os.rmdir(other)

    def test_guard_refuses_an_excluded_drive_and_user_exclusions(self):
        gdrive = classify(Drive(id="G", mountpoints=[str(self.home / "gd")], label="Google Drive"))
        guard = Guard(self.platform, [Drive(id="T", mountpoints=[str(self.home)], system=True), gdrive], ["T", "G"],
                      exclude=[str(self.home / "keep")])
        write(self.home / "gd/file.txt")
        write(self.home / "keep/file.txt")
        self.assertIn("Google Drive", guard.check(str(self.home / "gd/file.txt")))
        self.assertIn("preferences", guard.check(str(self.home / "keep/file.txt")))

    def test_a_duplicate_is_deleted_only_while_both_copies_still_match(self):
        keep = write(self.home / "Documents/a.pdf", b"same" * 100)
        copy = write(self.home / "Downloads/a.pdf", b"same" * 100)
        changed = write(self.home / "Downloads/b.pdf", b"same" * 100)
        digest = fsutil.hash_file(keep)
        f1 = Finding(category="duplicates", title="a", action="delete", level="aggressive", paths=[copy], keep=keep,
                     digest=digest, auto=True)
        f2 = Finding(category="duplicates", title="b", action="delete", level="aggressive", paths=[changed], keep=keep,
                     digest=digest, auto=True)
        write(changed, b"edited after the scan")
        manifest = self.home / "out/manifest.jsonl"
        results = execute([f1, f2], self.guard, manifest)
        self.assertFalse(os.path.exists(copy))
        self.assertTrue(os.path.exists(changed))
        self.assertTrue(os.path.exists(keep))
        problems = {r["title"]: r["problems"] for r in results}
        self.assertIn("changed", problems["b"][0])
        lines = [json.loads(line) for line in manifest.read_text().splitlines()]
        self.assertTrue(any(line.get("path") == copy and line["action"] == "delete" for line in lines))


class ProgramTests(unittest.TestCase):
    def test_a_program_without_a_last_use_date_is_never_called_unused(self):
        ctx = context(Path(tempfile.gettempdir()))
        self.assertIsNone(unused_program(ctx, "FL Studio", 2 * 1024 ** 3, None, "", "uninstall.exe"))
        self.assertEqual(ctx.unknown_programs, [("FL Studio", 2 * 1024 ** 3)])

    def test_only_a_real_old_date_lists_a_program(self):
        ctx = context(Path(tempfile.gettempdir()))
        now = time.time()
        old = unused_program(ctx, "Old Game", 10 ** 9, now - 400 * DAY, "Windows Prefetch", "u.exe", now=now)
        recent = unused_program(ctx, "Daily App", 10 ** 9, now - 3 * DAY, "Windows Prefetch", "u.exe", now=now)
        empty = unused_program(ctx, "Stub", 0, now - 400 * DAY, "Windows Prefetch", "u.exe", now=now)
        self.assertEqual((old.level, old.details["idle_days"], old.auto), ("aggressive", 400, False))
        self.assertIsNone(recent)
        self.assertIsNone(empty)

    def test_runtimes_updates_drivers_and_sync_clients_are_not_programs(self):
        for name in ("Microsoft Windows Desktop Runtime 10.0.2 (x64)", "Update for x64-based Windows Systems (KB5001716)",
                     "NVIDIA Software do sistema PhysX 9.23.1019", "Google Drive", "Gerenciador de Senhas do Google",
                     "Microsoft Visual Basic/C++ Runtime (x86)", "Riot Vanguard", "Microsoft GameInput", "vs_CoreEditorFonts"):
            self.assertTrue(SKIP_PROGRAMS.search(name), name)
        for name in ("FL Studio 2025", "League of Legends", "Docker Desktop", "REAPER (x64)", "Cities: Skylines"):
            self.assertFalse(SKIP_PROGRAMS.search(name), name)

    def test_userassist_value_gives_the_exe_and_its_last_run(self):
        import codecs
        name = codecs.encode("{6D809377-6AF0-444B-8957-A3773F02200E}\\Image-Line\\FL Studio 2025\\FL64.exe", "rot13")
        when = 1_760_000_000
        filetime = int((when + 11644473600) * 1e7)
        data = bytes(60) + filetime.to_bytes(8, "little") + bytes(4)
        exe, seen = parse_userassist(name, data)
        self.assertEqual(exe, "FL64.EXE")
        self.assertAlmostEqual(seen, when, delta=1)
        self.assertEqual(parse_userassist(codecs.encode("Microsoft.Windows.Explorer", "rot13"), data), (None, None))


class UninstallTests(unittest.TestCase):
    def programs(self, *names):
        return [Finding(category="programs", title=n, action="uninstall", level="safe", command=["x"]) for n in names]

    def test_names_match_one_program_ignoring_case_accents_and_versions(self):
        import disk_cleanup
        progs = self.programs("Immersed Agent", "Gunfire Reborn", "SideQuest 0.10.42", "Insomnia", "Touché")
        chosen, problems = disk_cleanup.match_programs(progs, ["immersed agent", "SIDEQUEST", "touche", "gunfire"])
        self.assertEqual([p.title for p in chosen], ["Immersed Agent", "SideQuest 0.10.42", "Touché", "Gunfire Reborn"])
        self.assertEqual(problems, [])

    def test_an_ambiguous_or_missing_name_is_reported_not_guessed(self):
        import disk_cleanup
        progs = self.programs("FL Studio 2025", "FL Studio 2026", "Insomnia")
        chosen, problems = disk_cleanup.match_programs(progs, ["fl studio", "insomnai"])
        self.assertEqual(chosen, [])
        self.assertIn("several", problems[0][1])
        self.assertIn("Insomnia", problems[1][1])

    def test_all_programs_mode_lists_programs_with_no_date_and_system_parts(self):
        ctx = context(Path(tempfile.gettempdir()))
        ctx.all_programs = True
        found = unused_program(ctx, "Immersed Agent", 10 ** 8, None, "", "u.exe", details={"system_part": True})
        self.assertEqual(found.title, "Immersed Agent")
        self.assertEqual(ctx.unknown_programs, [])

    def test_windows_uninstallers_start_through_shell_execute_for_uac(self):
        self.assertEqual(uac_launch('MsiExec.exe /X{ABC}'), 'start "" /wait MsiExec.exe /X{ABC}')


class PrefsTests(unittest.TestCase):
    def test_set_shows_old_and_new_value_and_unset_restores_the_default(self):
        import disk_cleanup
        with tempfile.TemporaryDirectory() as home:
            os.environ["GTI_HOME"] = home
            try:
                buffer = io.StringIO()
                with redirect_stdout(buffer):
                    disk_cleanup.main(["prefs", "set", "level", "agressivo"])
                    disk_cleanup.main(["prefs", "unset", "level"])
                text = buffer.getvalue()
                self.assertIn('level: "safe" -> "aggressive"', text)
                self.assertIn('level: "aggressive" -> "safe"', text)
            finally:
                del os.environ["GTI_HOME"]


if __name__ == "__main__":
    unittest.main()
