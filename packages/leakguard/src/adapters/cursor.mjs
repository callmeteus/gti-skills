export const id = "cursor";

export function parse(payload) {
    const event = payload.hook_event_name ?? payload.hookEventName;
    if (event && event.toLowerCase() !== "pretooluse") {
        return null;
    }

    return {
        tool: payload.tool_name ?? "",
        input: payload.tool_input ?? {},
        cwd: payload.cwd ?? ""
    };
}

export function format(result) {
    return {
        stdout: JSON.stringify({
            permission: result.decision,
            user_message: result.reason,
            agent_message: result.reason
        }),
        stderr: "",
        exitCode: 0
    };
}
