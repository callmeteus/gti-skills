"""One module per operating system. `current()` picks the one this machine runs."""

import sys


def current():
    if sys.platform.startswith("win"):
        from platforms.windows import Windows
        return Windows()
    if sys.platform == "darwin":
        from platforms.macos import MacOS
        return MacOS()
    from platforms.linux import Linux
    return Linux()
