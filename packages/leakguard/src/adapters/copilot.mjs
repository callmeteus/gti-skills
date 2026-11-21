export const id = "copilot";

export function parse(payload) {
    const event = payload.hook_event_name ?? payload.hookEventName;
    if (event && event.toLowerCase() !== "pretooluse") {
        return null;
    }

    let input = payload.toolArgs ?? payload.tool_input ?? {};

    if (typeof input === "string") {
        try {
            input = JSON.parse(input);
        } catch {
            // Keep the raw string. extractText still inspects it.
        }
    }

    return {
        tool: payload.toolName ?? payload.tool_name ?? "",
        input,
        cwd: payload.cwd ?? ""
    };
}

export function format(result) {
    return {
        stdout: JSON.stringify({
            permissionDecision: result.decision,
            permissionDecisionReason: result.reason
        }),
        stderr: "",
        exitCode: 0
    };
}
