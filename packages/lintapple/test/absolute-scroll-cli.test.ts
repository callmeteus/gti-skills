// Ported from upstream pull request gholtzap/lintapple#8 (JavaScript) to the TypeScript test suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertProcessError } from './assert-process-error.js';

const execute = promisify(execFile);
type CliReport = { runs: Array<{ viewport: { width: number; height: number }; colorScheme: 'light' | 'dark'; states: Array<{ findings: Array<{ rule: string }> }> }> };
type Case = { html: string; rules: string[] };

const pageHtml = (position: number, overflow = 'auto', containerPosition = 'static') => `<!doctype html><html lang="en"><style>
html{background:#fff;color:#111;font:16px system-ui}body{margin:24px}
</style><body><p>Project ready</p><div id="scroll" style="position:${containerPosition};overflow:${overflow};width:200px;height:80px"><div id="target" style="position:absolute;left:${position}px;top:100px;width:160px;height:40px">Lost text</div></div></body></html>`;

async function runCli(url: string, policy: string): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execute(process.execPath, [process.env.LINTAPPLE_CLI || 'dist/bin/lintapple.js', url, '--config', policy, '--json']);
    return { code: 0, stdout, stderr };
  } catch (error) {
    assertProcessError(error);
    if (typeof error.code !== 'number') throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

test('CLI rejects absolute content that a static overflow ancestor cannot scroll into view', async () => {
  const cases: Record<string, Case> = {
    offscreen: { html: pageHtml(-180), rules: ['viewport-bounds'] },
    'without-scroll': { html: pageHtml(-180, 'visible'), rules: ['viewport-bounds'] },
    onscreen: { html: pageHtml(24), rules: [] },
    scrollable: { html: pageHtml(240, 'auto', 'relative'), rules: [] },
  };
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(cases[(request.url ?? '/').slice(1)]?.html ?? '');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const browser = await chromium.launch();
  try {
    await mkdir('test-results', { recursive: true });
    const policy = 'test-results/absolute-scroll-policy.json';
    await writeFile(policy, JSON.stringify({ colorSchemes: ['light', 'dark'] }));
    for (const [name, entry] of Object.entries(cases)) {
      const url = `http://127.0.0.1:${address.port}/${name}`;
      const output = await runCli(url, policy);
      const report = JSON.parse(output.stdout) as CliReport;
      await writeFile(`test-results/absolute-scroll-${name}.json`, JSON.stringify(report, null, 2));
      assert.equal(output.code, entry.rules.length ? 1 : 0, `${name}: ${output.stderr}`);
      assert.equal(report.runs.length, 4);
      for (const run of report.runs) {
        assert.deepEqual([...new Set(run.states[0]?.findings.map(f => f.rule))], entry.rules, name);
        const page = await browser.newPage({ viewport: run.viewport, colorScheme: run.colorScheme });
        try {
          await page.goto(url);
          const bounds = await page.evaluate(() => {
            const scroll = document.querySelector('#scroll');
            const target = document.querySelector('#target');
            if (!scroll || !target) throw new Error('Fixture elements are missing.');
            scroll.scrollLeft = -10000;
            const left = scroll.scrollLeft;
            scroll.scrollLeft = 10000;
            return { right: target.getBoundingClientRect().right, left, max: scroll.scrollLeft, width: scroll.clientWidth, scrollWidth: scroll.scrollWidth };
          });
          if (name === 'offscreen') {
            assert.ok(bounds.right < 0, 'The text must be fully outside the viewport.');
            assert.equal(bounds.left, 0);
            assert.equal(bounds.max, 0, 'The ancestor cannot scroll to the text.');
            assert.equal(bounds.scrollWidth, bounds.width);
          }
          if (name === 'scrollable') assert.ok(bounds.max > 0, 'The positioned ancestor must provide real scrolling.');
        } finally { await page.close(); }
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
