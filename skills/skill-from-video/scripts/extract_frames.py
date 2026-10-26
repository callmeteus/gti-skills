#!/usr/bin/env python3
import argparse
import subprocess
import sys
from pathlib import Path

def extract_frames(video_path, output_dir, interval=20, max_frames=30):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Extract frames every interval seconds
    cmd = [
        "ffmpeg",
        "-i", str(video_path),
        "-vf", f"fps=1/{interval}",
        "-frames:v", str(max_frames),
        "-q:v", "2",
        str(output_dir / "frame_%03d.jpg")
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error: {result.stderr}", file=sys.stderr)
            return False
        print(f"Frames extracted to {output_dir}")
        return True
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract keyframes from video")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("-o", "--output", default="./frames", help="Output directory")
    parser.add_argument("-i", "--interval", type=int, default=20, help="Seconds between frames")
    parser.add_argument("-m", "--max", type=int, default=30, help="Maximum number of frames")
    args = parser.parse_args()
    
    success = extract_frames(args.video, args.output, args.interval, args.max)
    sys.exit(0 if success else 1)
