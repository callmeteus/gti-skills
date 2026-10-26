"""Unit tests for the shared video toolkit. Run from the repository root:

    python -m unittest discover -s shared/video-toolkit/tests -v
"""
import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
for folder in ("setup", "download", "transcript", "frames"):
    sys.path.insert(0, str(SCRIPTS / folder))

from lib import common  # noqa: E402
import check_dependencies  # noqa: E402
import download_video  # noqa: E402
import extract_frames  # noqa: E402
import get_transcript  # noqa: E402
import transcribe_audio  # noqa: E402


class CommonTests(unittest.TestCase):
    def test_parse_video_id_accepts_urls_and_ids(self):
        self.assertEqual(common.parse_video_id("jNQXAC9IVRw"), "jNQXAC9IVRw")
        self.assertEqual(common.parse_video_id("https://www.youtube.com/watch?v=jNQXAC9IVRw&t=4"), "jNQXAC9IVRw")
        self.assertEqual(common.parse_video_id("https://www.youtube.com/watch?list=x&v=jNQXAC9IVRw"), "jNQXAC9IVRw")
        self.assertEqual(common.parse_video_id("https://youtu.be/jNQXAC9IVRw?si=abc"), "jNQXAC9IVRw")
        self.assertEqual(common.parse_video_id("https://www.youtube.com/shorts/jNQXAC9IVRw"), "jNQXAC9IVRw")

    def test_parse_video_id_rejects_garbage(self):
        self.assertIsNone(common.parse_video_id("not a video"))
        self.assertIsNone(common.parse_video_id("https://example.com/watch?v=short"))

    def test_format_and_parse_timestamp_round_trip(self):
        self.assertEqual(common.format_timestamp(65), "01:05")
        self.assertEqual(common.format_timestamp(3725), "1:02:05")
        self.assertEqual(common.format_timestamp(-4), "00:00")
        self.assertEqual(common.parse_timestamp("1:02:05"), 3725)
        self.assertEqual(common.parse_timestamp("01:05"), 65)
        with self.assertRaises(ValueError):
            common.parse_timestamp("1:2:3:4")

    def test_timestamp_url(self):
        self.assertEqual(common.timestamp_url("abc", 61.9), "https://youtu.be/abc?t=61")

    def test_build_transcript_drops_empty_entries(self):
        result = common.build_transcript(
            [{"start": 1, "duration": 2, "text": " hi "}, {"start": 3, "duration": 1, "text": "  "}],
            "en",
            "test",
        )
        self.assertEqual(result["text"], "hi")
        self.assertEqual(len(result["timestamped"]), 1)
        self.assertEqual(result["source"], "test")

    def test_run_command_reports_missing_binary(self):
        code, _, err = common.run_command(["definitely-not-a-real-binary-xyz"])
        self.assertEqual(code, 127)
        self.assertIn("not found", err)


class DependencyPlanTests(unittest.TestCase):
    def test_whisper_package_by_platform(self):
        self.assertEqual(check_dependencies.whisper_package("Darwin", "arm64"), "mlx-whisper")
        self.assertEqual(check_dependencies.whisper_package("Darwin", "x86_64"), "openai-whisper")
        self.assertEqual(check_dependencies.whisper_package("Linux", "x86_64"), "openai-whisper")

    def test_linux_plan_uses_sudo_unless_root(self):
        available = {"apt-get": True}
        plan = check_dependencies.plan_system_install("Linux", ["yt-dlp", "ffmpeg", "ffprobe"], available, False)
        self.assertEqual(plan, [["sudo", "apt-get", "install", "-y", "ffmpeg", "yt-dlp"]])
        plan = check_dependencies.plan_system_install("Linux", ["ffmpeg"], available, True)
        self.assertEqual(plan, [["apt-get", "install", "-y", "ffmpeg"]])

    def test_windows_and_mac_plans(self):
        plan = check_dependencies.plan_system_install("Windows", ["ffmpeg"], {"winget": True}, False)
        self.assertEqual(plan, [["winget", "install", "--id", "Gyan.FFmpeg", "-e", "--source", "winget"]])
        plan = check_dependencies.plan_system_install("Darwin", ["yt-dlp"], {"brew": True}, False)
        self.assertEqual(plan, [["brew", "install", "yt-dlp"]])

    def test_plan_is_empty_without_manager_or_missing_tools(self):
        self.assertEqual(check_dependencies.plan_system_install("Linux", ["ffmpeg"], {}, False), [])
        self.assertEqual(check_dependencies.plan_system_install("Linux", [], {"apt-get": True}, False), [])
        self.assertEqual(check_dependencies.plan_system_install("Windows", ["ffmpeg"], {}, False), [])


class DownloadTests(unittest.TestCase):
    def test_build_command_modes(self):
        out = Path("work")
        metadata = download_video.build_command("u", out, "metadata", 720)
        self.assertIn("--dump-single-json", metadata)
        audio = download_video.build_command("u", out, "audio", 720)
        self.assertIn("-x", audio)
        video = download_video.build_command("u", out, "video", 480)
        self.assertIn("bv*[height<=480]+ba/b[height<=480]/b", video)
        self.assertTrue(all("--no-playlist" in cmd for cmd in (metadata, audio, video)))

    def test_summarize_metadata_trims_description_and_maps_chapters(self):
        summary = download_video.summarize_metadata({
            "id": "x",
            "title": "T",
            "uploader": "U",
            "description": "d" * 5000,
            "chapters": [{"title": "Intro", "start_time": 0, "end_time": 30}],
        })
        self.assertEqual(summary["channel"], "U")
        self.assertEqual(len(summary["description"]), 2000)
        self.assertEqual(summary["chapters"][0]["title"], "Intro")


class TranscriptTests(unittest.TestCase):
    ENTRIES = [
        {"start": 1.5, "duration": 2.0, "text": "Hello"},
        {"start": 3725.25, "duration": 1.0, "text": "Late\nline"},
    ]

    def test_srt_time(self):
        self.assertEqual(get_transcript.srt_time(3725.25), "01:02:05,250")

    def test_to_srt(self):
        srt = get_transcript.to_srt(self.ENTRIES)
        self.assertTrue(srt.startswith("1\n00:00:01,500 --> 00:00:03,500\nHello\n"))
        self.assertIn("2\n01:02:05,250 --> 01:02:06,250\nLate\nline", srt)

    def test_to_markdown_links_to_video(self):
        markdown = get_transcript.to_markdown(self.ENTRIES, "abc")
        self.assertIn("- [00:01](https://youtu.be/abc?t=1) Hello", markdown)
        self.assertIn("- [1:02:05](https://youtu.be/abc?t=3725) Late line", markdown)

    def test_pick_transcript_prefers_manual_then_generated_then_first(self):
        class Track:
            def __init__(self, code, generated):
                self.language_code = code
                self.is_generated = generated

        class Listing:
            def __init__(self, tracks):
                self.tracks = tracks

            def __iter__(self):
                return iter(self.tracks)

            def _find(self, code, generated):
                for track in self.tracks:
                    if track.language_code == code and track.is_generated == generated:
                        return track
                raise LookupError(code)

            def find_manually_created_transcript(self, codes):
                return self._find(codes[0], False)

            def find_generated_transcript(self, codes):
                return self._find(codes[0], True)

        listing = Listing([Track("en", True), Track("en", False), Track("pt", True)])
        self.assertFalse(get_transcript.pick_transcript(listing, ["en"]).is_generated)
        self.assertEqual(get_transcript.pick_transcript(listing, ["pt", "en"]).language_code, "pt")
        self.assertEqual(get_transcript.pick_transcript(listing, ["fr"]).language_code, "en")
        with self.assertRaises(LookupError):
            get_transcript.pick_transcript(Listing([]), ["en"])

    def test_render_formats(self):
        result = common.build_transcript(self.ENTRIES, "en", "test")
        self.assertIn('"language": "en"', get_transcript.render(result, "json", "abc"))
        self.assertEqual(get_transcript.render(result, "text", "abc"), result["text"])

    def test_segments_to_entries(self):
        entries = transcribe_audio.segments_to_entries([{"start": 1.0, "end": 3.5, "text": " hi"}])
        self.assertEqual(entries, [{"start": 1.0, "duration": 2.5, "text": " hi"}])
        negative = transcribe_audio.segments_to_entries([{"start": 5.0, "end": 4.0, "text": "x"}])
        self.assertEqual(negative[0]["duration"], 0.0)


class FrameTests(unittest.TestCase):
    def test_interval_times_respects_bounds_and_cap(self):
        self.assertEqual(extract_frames.interval_times(0, 50, 20, 30), [0, 20, 40])
        self.assertEqual(extract_frames.interval_times(10, 100, 10, 3), [10, 20, 30])
        self.assertEqual(extract_frames.interval_times(0, 0, 10, 5), [])

    def test_parse_scene_times(self):
        log = "[Parsed_showinfo_1 @ 0x1] n:   0 pts:  12 pts_time:0.48 pos: 1\n" \
              "[Parsed_showinfo_1 @ 0x1] n:   1 pts: 900 pts_time:36 pos: 2\n"
        self.assertEqual(extract_frames.parse_scene_times(log), [0.48, 36.0])

    def test_thin_times_keeps_order_and_cap(self):
        times = [float(index) for index in range(100)]
        thinned = extract_frames.thin_times(times, 10)
        self.assertEqual(len(thinned), 10)
        self.assertEqual(thinned, sorted(thinned))
        self.assertEqual(extract_frames.thin_times([1.0, 2.0], 10), [1.0, 2.0])


if __name__ == "__main__":
    unittest.main()
