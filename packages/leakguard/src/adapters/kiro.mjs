export const id = "kiro";

export function parse(payload) {
    const event = payload.hook_event_name ?? payload.hookEventName;
    if (event && event !== "PreToolUse") {
        return null;
    }

    return {
        tool: payload.tool_name ?? payload.toolName ?? "",
        input: payload.tool_input ?? payload.toolInput ?? {},
        cwd: payload.cwd ?? ""
    };
}

export function format(result) {
    if (result.decision === "allow") {
        return { stdout: "", stderr: "", exitCode: 0 };
    }

    // Kiro has no ask verdict on PreToolUse. An ask is treated as a block, while a config that
    // maps the severity to allow already produced an allow decision upstream.
    const decision = result.decision === "ask" ? "deny" : result.decision;

    return {
        stdout: "",
        stderr: result.reason,
        exitCode: decision === "deny" ? 2 : 0
    };
}
