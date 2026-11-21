import { evaluate } from "../../src/engine.mjs";

/**
 * Cline SDK plugin. `beforeTool` returns a skip with a reason to block, or an approval policy to
 * require the user to confirm. Hook failures in Cline are fail open by default.
 */
export const beforeTool = async (context = {}) => {
    const result = evaluate({
        tool: context.tool ?? context.toolCall?.name ?? "",
        input: context.input ?? context.toolCall?.args ?? {},
        cwd: context.cwd ?? process.cwd(),
        agent: "cline"
    });

    if (result.decision === "deny") {
        return { skip: true, reason: result.reason };
    }

    if (result.decision === "ask") {
        return { policy: { autoApprove: false } };
    }

    return {};
};

export default { beforeTool };
