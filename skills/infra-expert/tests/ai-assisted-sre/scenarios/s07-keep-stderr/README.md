Tests that the command under investigation keeps stderr, the exit code and pipefail.
Topic 7 (keep stderr): the error is the evidence, and a tail pipe also replaces the exit code.
The state check proves the real error from stderr reached the log file.
The transcript forbids 2>/dev/null, || true and head or tail as the only output.
