import { evaluate } from "../../src/engine.mjs";

/**
 * Hook used by both OpenCode and Kilo, which share the plugin API. V1 blocks by throwing from
 * `tool.execute.before`. V2 additionally supports a permission evaluate hook with a mutable
 * `effect` field. The function is fail open for unexpected payload shapes.
 *
 * @param {object} context Plugin context supplied by the harness
 * @returns {object} Hook map
 */
export default function leakguardPlugin(context = {}) {
    const directory = context.directory ?? context.worktree ?? process.cwd();

    function verdict(tool, args) {
        return evaluate({
            tool: typeof tool === "string" ? tool : "",
            input: args ?? {},
            cwd: directory,
            agent: "opencode"
        });
    }

    return {
        "tool.execute.before": async (input = {}, output = {}) => {
            const result = verdict(input.tool, output.args ?? input.args);
            if (result.decision === "deny") {
                throw new Error(result.reason);
            }
        },
        "permission.evaluate": async (input = {}, output = {}) => {
            const result = verdict(input.tool ?? input.action, output.args ?? input.args ?? input.resources);
            if (result.decision !== "allow" && output) {
                output.effect = result.decision === "ask" ? "ask" : "deny";
                output.message = result.reason;
            }
        }
    };
}
