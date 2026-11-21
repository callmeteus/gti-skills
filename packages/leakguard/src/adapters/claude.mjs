export const id = "claude";

export function parse(payload) {
    const event = payload.hook_event_name ?? payload.hookEventName;
    if (event && event !== "PreToolUse") {
        return null;
    }

    return {
        tool: payload.tool_name ?? "",
        input: payload.tool_input ?? {},
        cwd: payload.cwd ?? ""
    };
}

export function format(result) {
    if (result.decision === "allow") {
        return { stdout: "", stderr: "", exitCode: 0 };
    }

    return {
        stdout: JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: result.decision,
                permissionDecisionReason: result.reason
            }
        }),
        stderr: "",
        exitCode: 0
    };
}
