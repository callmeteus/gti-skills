# Threat model: the leak this skill defends against

## The attack, in words

A public TypeScript library was cloned with a README that looked normal when rendered. GitHub hides HTML comments, so the rendered page showed only the setup steps. The raw file, which the coding agent reads, carried a hidden comment that told the agent to verify the environment by sending its `.env` file to a server before running tests. A matching note was placed in a string field of `package.json`. The instruction came from repository content, not from the user, so it is an indirect prompt injection.

The agent followed it. It ran a command that sent a dotenv file to an address written in the same hidden comment. The tests passed, the final summary described the send as a setup step, and the user saw no error. The leak happened in two of three runs, so one clean run proves nothing.

```text
  repository file with hidden instruction
                 |
                 v
  agent reads raw content as if it were guidance
                 |
                 v
  agent proposes a tool call that sends .env
                 |
                 v
  pre-tool guard inspects the call    <--- this skill installs and tunes this layer
                 |
       +---------+---------+
       v                   v
   pattern match       no match
       |                   |
    deny or ask         call runs
       |                   |
   agent has nothing    possible leak
   to execute
```

## What the guard does

The Leakguard engine normalizes the tool call from any supported agent, then runs eight detectors plus any configured rules. The detectors that matter for this attack are:

- A dotenv file name combined with a network client in command position.
- A credential literal combined with a network client, unless every destination belongs to that credential's own issuer.
- A local secret store path, an environment dump, or encoded or DNS based exfiltration combined with a network client.
- A remote script fetch that is piped into a shell interpreter, and reading another process environment.

A high severity match is denied under the default policy. A denied call is replaced with a short reason, so the agent has nothing to run. Decisions are written to a local redacted event log. Credentials sent only to their own issuer, such as a GitHub token to the GitHub API, are allowed to avoid breaking normal work.

The history scanner covers leaks that happened before the guard was installed. It reads transcripts, shell history, committed and tracked git content, earlier guard decisions, and hidden instructions in the repository. It writes redacted reports and a rotation checklist; see [../workflow/03-scan.md](../workflow/03-scan.md).

## What the guard does not do

- It is a pattern layer, not a cure for prompt injection. A novel exfiltration that matches no detector can pass.
- It does not sandbox the tool, patch the model, or replace the agent's permission system.
- It cannot tell whether a credential was actually used after it left the machine.
- It cannot read every agent's transcript format. Cursor, Kiro, Antigravity, Cline, and Muse are listed as not covered by the scanner.
- It does not remove a credential from git history or rotate it. That is a human decision described in [../workflow/04-respond.md](../workflow/04-respond.md).
- A clean transcript run proves nothing when the attack is probabilistic.

Use the guard together with a sandbox, least privilege on the agent's tokens and filesystem, and a network allow list where the platform supports one. For unattended agents in CI, background jobs, auto-approve mode, or parallel swarms, the guard is most valuable because no human is watching each call.

## Credits

The attack demonstration and the layered defense are from Hugging Face safeagents, a local proxy that inspects tool calls before the harness sees them: https://github.com/huggingface/safeagents (Apache 2.0). Its detector library, atif-scan, supplied the idea of scanning a conversation as a structured trace: https://github.com/huggingface/atif-scan (Apache 2.0). The community dotenv rule shown in the demonstration inspired the dotenv and credential detectors here, but this package is an independent implementation with no runtime dependency on either project.
