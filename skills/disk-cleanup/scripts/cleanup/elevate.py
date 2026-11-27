"""Runs this script again with administrator rights through the operating system's own dialog: polkit (pkexec)
on Linux, the administrator prompt on macOS, and UAC on Windows. The user types the password into that dialog;
the agent and this script never see it."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

LINUX_EXIT = {
    126: "the password dialog was closed or the password was wrong",
    127: "no polkit authentication agent is running, or the user is not allowed to administer this machine",
}


def method():
    """('pkexec' | 'osascript' | 'uac', None) when a graphical dialog is possible, else (None, reason)."""
    if sys.platform.startswith("win"):
        return ("uac", None) if shutil.which("powershell") else (None, "PowerShell is not available")
    if sys.platform == "darwin":
        return ("osascript", None) if shutil.which("osascript") else (None, "osascript is not available")
    # Without a display there is no dialog to show, whether or not pkexec happens to be installed.
    if not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        return None, "there is no graphical session to show the password dialog in"
    if not shutil.which("pkexec"):
        return None, "pkexec (polkit) is not installed"
    return "pkexec", None


def applescript_string(text):
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def powershell_string(text):
    return "'" + text.replace("'", "''") + "'"


def posix_quote(text):
    import shlex
    return shlex.quote(text)


def build(kind, python, script, args, env, prompt):
    """The command that shows the dialog and runs `python script args` elevated with `env` set."""
    if kind == "pkexec":
        # pkexec clears the environment, so HOME and GTI_HOME go through env(1).
        return ["pkexec", "env", *[f"{k}={v}" for k, v in env.items()], python, script, *args]
    if kind == "osascript":
        line = " ".join(["env", *[posix_quote(f"{k}={v}") for k, v in env.items()], posix_quote(python),
                         posix_quote(script), *[posix_quote(a) for a in args]])
        return ["osascript", "-e", f"do shell script {applescript_string(line)} with prompt {applescript_string(prompt)} "
                                   "with administrator privileges"]
    if kind == "uac":
        # Start-Process cannot pass environment variables: the child gets --gti-home on its command line instead.
        quoted = ",".join(powershell_string(subprocess.list2cmdline([a])) for a in [script, *args])
        command = (f"$p = Start-Process -FilePath {powershell_string(python)} -ArgumentList {quoted} -Verb RunAs "
                   "-Wait -PassThru -WindowStyle Hidden; exit $p.ExitCode")
        return ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command]
    raise ValueError(kind)


def explain(kind, code, output):
    """A sentence for the user when the elevated run did not happen or failed."""
    text = (output or "").lower()
    if kind == "pkexec" and code in LINUX_EXIT:
        return LINUX_EXIT[code]
    if kind == "osascript" and ("-128" in text or "user canceled" in text or "cancel" in text):
        return "the password dialog was cancelled"
    if kind == "uac" and ("canceled by the user" in text or "cancelado pelo usu" in text or "1223" in text):
        return "the Windows permission dialog (UAC) was cancelled"
    return f"the elevated run exited with code {code}: {(output or '').strip()[-300:]}"


def run(args, prompt, gti_home, timeout=3600):
    """Runs `disk_cleanup.py args` elevated. Returns (ok, message)."""
    kind, reason = method()
    if kind is None:
        return False, reason
    script = os.path.abspath(sys.argv[0]) if sys.argv and sys.argv[0].endswith("disk_cleanup.py") else \
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "disk_cleanup.py")
    env = {"HOME": os.path.expanduser("~"), "GTI_HOME": gti_home}
    if hasattr(os, "getuid"):
        env["GTI_OWNER_UID"] = str(os.getuid())  # who gets the report files back
    command = build(kind, sys.executable, script, [*args, "--gti-home", gti_home], env, prompt)
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, stdin=subprocess.DEVNULL,
                                   encoding="utf-8", errors="replace")
    except (OSError, subprocess.SubprocessError) as error:
        return False, str(error)
    if completed.returncode != 0:
        return False, explain(kind, completed.returncode, completed.stdout + completed.stderr)
    return True, completed.stdout


def hand_back(*paths):
    """Files the elevated run wrote in the user's folders go back to the user (POSIX), not to root."""
    uid = os.environ.get("GTI_OWNER_UID") or os.environ.get("PKEXEC_UID") or os.environ.get("SUDO_UID")
    if not uid or not hasattr(os, "chown"):
        return
    uid = int(uid)
    try:
        import pwd
        gid = pwd.getpwuid(uid).pw_gid
    except (ImportError, KeyError):
        gid = -1
    for path in paths:
        for root, dirs, files in os.walk(path) if os.path.isdir(path) else [(os.path.dirname(path), [], [os.path.basename(path)])]:
            for name in [root, *[os.path.join(root, n) for n in dirs + files]]:
                try:
                    os.chown(name, uid, gid)
                except OSError:
                    pass
