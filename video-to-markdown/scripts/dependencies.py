#!/usr/bin/env python3
import os
import platform
import subprocess
import sys
from pathlib import Path

class DependencyInstaller:
    def __init__(self):
        self.system = platform.system()
        self.machine = platform.machine()
        self.missing = []
        
    def run_cmd(self, cmd, check=True):
        try:
            result = subprocess.run(cmd, shell=True, check=check, 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE,
                                  text=True)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)
    
    def check_command(self, cmd):
        success, _, _ = self.run_cmd(f"which {cmd}" if self.system != "Windows" else f"where {cmd}")
        return success
    
    def check_python_package(self, package):
        try:
            __import__(package.replace('-', '_'))
            return True
        except ImportError:
            return False
    
    def install_python_packages(self):
        packages = ['youtube-transcript-api', 'requests']
        missing = []
        for pkg in packages:
            pkg_import = pkg.replace('-', '_')
            if pkg_import == 'youtube_transcript_api':
                try:
                    import youtube_transcript_api
                    continue
                except:
                    missing.append(pkg)
            elif not self.check_python_package(pkg):
                missing.append(pkg)
        
        if missing:
            print(f"Installing Python packages: {', '.join(missing)}")
            success, out, err = self.run_cmd(f"{sys.executable} -m pip install {' '.join(missing)}")
            if not success:
                print(f"Failed to install packages: {err}")
                return False
        return True
    
    def install_system_deps(self):
        if self.system == "Darwin":  # macOS
            if not self.check_command('brew'):
                print("Homebrew not found. Please install from https://brew.sh")
                return False
            deps = []
            if not self.check_command('yt-dlp'): deps.append('yt-dlp')
            if not self.check_command('ffmpeg'): deps.append('ffmpeg')
            if not self.check_command('ffprobe'): deps.append('ffmpeg')  # ffprobe comes with ffmpeg
            if deps:
                print(f"Installing: {', '.join(set(deps))}")
                self.run_cmd(f"brew install {' '.join(set(deps))}")
        elif self.system == "Linux":
            deps = []
            if not self.check_command('yt-dlp'): deps.append('yt-dlp')
            if not self.check_command('ffmpeg'): deps.append('ffmpeg')
            if deps:
                # Try apt
                if self.check_command('apt'):
                    self.run_cmd("sudo apt update")
                    self.run_cmd(f"sudo apt install -y {' '.join(deps)}")
                elif self.check_command('pacman'):
                    self.run_cmd(f"sudo pacman -S --noconfirm {' '.join(deps)}")
                elif self.check_command('dnf'):
                    self.run_cmd(f"sudo dnf install -y {' '.join(deps)}")
        elif self.system == "Windows":
            deps = []
            if not self.check_command('yt-dlp'): deps.append('yt-dlp')
            if not self.check_command('ffmpeg'): deps.append('ffmpeg')
            if deps:
                if self.check_command('winget'):
                    for dep in deps:
                        self.run_cmd(f"winget install --id Gyan.FFmpeg -e --source winget" if dep == 'ffmpeg' else f"winget install yt-dlp.yt-dlp")
                elif self.check_command('choco'):
                    self.run_cmd(f"choco install -y {' '.join(deps)}")
                else:
                    print("Please install manually: yt-dlp, ffmpeg")
                    print("Or install winget/chocolatey")
    
    def install_whisper(self):
        if self.system == "Darwin" and self.machine == "arm64":
            # Try mlx-whisper for Apple Silicon
            try:
                import mlx_whisper
                return True
            except:
                print("Installing mlx-whisper for Apple Silicon...")
                success, _, _ = self.run_cmd(f"{sys.executable} -m pip install mlx-whisper")
                return success
        else:
            try:
                import whisper
                return True
            except:
                print("Installing openai-whisper...")
                success, _, _ = self.run_cmd(f"{sys.executable} -m pip install openai-whisper")
                return success
    
    def run(self):
        print(f"Checking dependencies for video-to-markdown on {self.system}...")
        self.install_python_packages()
        self.install_system_deps()
        self.install_whisper()
        print("Dependency check complete!")

if __name__ == "__main__":
    installer = DependencyInstaller()
    installer.run()
