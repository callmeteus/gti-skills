#!/usr/bin/env python3
import os
import platform
import subprocess
import sys

class DependencyInstaller:
    def __init__(self):
        self.system = platform.system()
        self.machine = platform.machine()
        
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
        if self.system == "Windows":
            success, _, _ = self.run_cmd(f"where {cmd}")
        else:
            success, _, _ = self.run_cmd(f"which {cmd}")
        return success
    
    def install_python_packages(self):
        packages = ['youtube-transcript-api', 'requests']
        missing = []
        for pkg in packages:
            try:
                if pkg == 'youtube-transcript-api':
                    import youtube_transcript_api
                elif pkg == 'requests':
                    import requests
                continue
            except:
                missing.append(pkg)
        
        if missing:
            print(f"Installing Python packages: {', '.join(missing)}")
            success, out, err = self.run_cmd(f"{sys.executable} -m pip install {' '.join(missing)}")
            if not success:
                print(f"Failed: {err}")
                return False
        return True
    
    def install_system_deps(self):
        if self.system == "Darwin":
            if not self.check_command('brew'):
                print("Install Homebrew: https://brew.sh")
                return False
            for dep in ['yt-dlp', 'ffmpeg']:
                if not self.check_command(dep):
                    print(f"Installing {dep}...")
                    self.run_cmd(f"brew install {dep}")
        elif self.system == "Linux":
            for dep in ['yt-dlp', 'ffmpeg']:
                if not self.check_command(dep):
                    if self.check_command('apt'):
                        self.run_cmd("sudo apt update")
                        self.run_cmd(f"sudo apt install -y {dep}")
                    elif self.check_command('dnf'):
                        self.run_cmd(f"sudo dnf install -y {dep}")
                    elif self.check_command('pacman'):
                        self.run_cmd(f"sudo pacman -S --noconfirm {dep}")
        elif self.system == "Windows":
            for dep in ['yt-dlp', 'ffmpeg']:
                if not self.check_command(dep):
                    if self.check_command('winget'):
                        if dep == 'ffmpeg':
                            self.run_cmd("winget install --id Gyan.FFmpeg -e --source winget")
                        else:
                            self.run_cmd("winget install yt-dlp.yt-dlp")
                    elif self.check_command('choco'):
                        self.run_cmd(f"choco install -y {dep}")
    
    def install_whisper(self):
        if self.system == "Darwin" and self.machine == "arm64":
            try:
                import mlx_whisper
                return True
            except:
                print("Installing mlx-whisper...")
                self.run_cmd(f"{sys.executable} -m pip install mlx-whisper")
        else:
            try:
                import whisper
                return True
            except:
                print("Installing openai-whisper...")
                self.run_cmd(f"{sys.executable} -m pip install openai-whisper")
    
    def run(self):
        print(f"Checking dependencies for video-to-skill on {self.system}...")
        self.install_python_packages()
        self.install_system_deps()
        self.install_whisper()
        print("Done!")

if __name__ == "__main__":
    DependencyInstaller().run()
