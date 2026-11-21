import { defineConfig } from "vitest/config";

/**
 * Unit tests stay parallel. Integration tests run in one worker with one file
 * at a time: Chromium plus several ffmpeg encodes exhaust memory on modest
 * Windows machines when they run concurrently. The thread limit is applied to
 * ffmpeg encodes through VIDEOEDITOR_FFMPEG_THREADS in Runner.ts.
 */
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["tests/unit/**/*.test.ts"],
                    environment: "node",
                    testTimeout: 30000,
                    env: { VIDEOEDITOR_FFMPEG_THREADS: "2" }
                }
            },
            {
                test: {
                    name: "integration",
                    include: ["tests/integration/**/*.test.ts"],
                    environment: "node",
                    testTimeout: 120000,
                    fileParallelism: false,
                    maxWorkers: 1,
                    minWorkers: 1,
                    poolOptions: { forks: { singleFork: true }, threads: { singleThread: true } },
                    env: { VIDEOEDITOR_FFMPEG_THREADS: "2" }
                }
            }
        ]
    }
});
