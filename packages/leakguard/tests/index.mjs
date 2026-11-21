// Entry point so `node --test tests/` resolves the directory on Node versions that treat a
// directory argument as a module. Each imported file registers its own node:test cases.
import "./adapters.test.mjs";
import "./config.test.mjs";
import "./engine.test.mjs";
import "./history-agents.test.mjs";
import "./history.test.mjs";
import "./installer.test.mjs";
import "./precision-fixtures.test.mjs";
import "./redaction.test.mjs";
import "./round2-fixtures.test.mjs";
import "./rules.test.mjs";
