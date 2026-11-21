import { evaluate } from "../../src/engine.mjs";

function verdict(tool, input, context = {}) {
    return evaluate({
        tool: typeof tool === "string" ? tool : "",
        input: input ?? {},
        cwd: context.directory ?? context.location?.directory ?? context.worktree ?? process.cwd(),
        agent: "opencode"
    });
}

/**
 * V1 plugin shape shared with Kilo. Both document `tool.execute.before` and show a plugin as an
 * async function that returns a hook map. Blocking is done by throwing an Error with the reason.
 *
 * @param {object} context Plugin context supplied by the harness
 * @returns {Promise<object>} Hook map
 */
export const LeakGuard = async (context = {}) => ({
    "tool.execute.before": async (input = {}, output = {}) => {
        const result = verdict(input.tool, output.args ?? input.args ?? input.input, context);
        if (result.decision === "deny") {
            throw new Error(result.reason);
        }
    }
});

/**
 * V2 plugin shape. OpenCode 2.x reads `id` and `setup()` from the default export and registers
 * hooks through the context. The `server()` function keeps the V1 shape available from the same
 * entrypoint, as the OpenCode migration guide recommends.
 */
export default {
    id: "leakguard",
    async setup(ctx) {
        await ctx.tool.hook("execute.before", (event) => {
            const result = verdict(event.tool, event.input, ctx);
            if (result.decision === "deny") {
                throw new Error(result.reason);
            }
        });
    },
    async server() {
        return LeakGuard({ directory: process.cwd() });
    }
};
