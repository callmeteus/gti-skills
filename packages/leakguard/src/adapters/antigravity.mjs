export const id = "antigravity";

export function parse(payload) {
    const event = payload.hook_event_name ?? payload.hookEventName;
    if (event && event !== "PreToolUse") {
        return null;
    }

    const call = payload.toolCall ?? {};
    const workspace = Array.isArray(payload.workspacePaths) ? payload.workspacePaths[0] : undefined;

    return {
        tool: call.name ?? payload.tool_name ?? "",
        input: call.args ?? payload.tool_input ?? {},
        cwd: workspace ?? payload.cwd ?? ""
    };
}

export function format(result) {
    return {
        stdout: JSON.stringify({
            decision: result.decision,
            reason: result.reason
        }),
        stderr: "",
        exitCode: 0
    };
}
