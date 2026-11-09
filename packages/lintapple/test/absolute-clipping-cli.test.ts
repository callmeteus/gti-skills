// Ported from upstream pull request gholtzap/lintapple#9 (JavaScript) to the TypeScript test suite.
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

const pageHtml = (overflow: string, positioned = false) => `<!doctype html><html lang="en"><style>
html{background:#fff;color:#111;font:16px system-ui}body{margin:24px}
</style><body><p>Project ready</p><div style="${positioned ? 'position:relative;' : ''}overflow:${overflow};width:${positioned ? 40 : 80}px;height:80px"><div id="target" style="position:absolute;left:${positioned ? 0 : 150}px;top:${positioned ? 0 : 100}px;width:160px;height:40px">Visible text</div></div></body></html>`;

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

test('CLI accepts absolute text outside a static overflow ancestor and reports real clipping', async () => {
  const cases: Record<string, Case> = {
    visible: { html: pageHtml('hidden'), rules: [] },
    'without-clip': { html: pageHtml('visible'), rules: [] },
    clipped: { html: pageHtml('hidden', true), rules: ['content-clipping'] },
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
    const policy = 'test-results/absolute-clipping-policy.json';
    await writeFile(policy, JSON.stringify({ colorSchemes: ['light', 'dark'] }));
    for (const [name, entry] of Object.entries(cases)) {
      const url = `http://127.0.0.1:${address.port}/${name}`;
      const output = await runCli(url, policy);
      const report = JSON.parse(output.stdout) as CliReport;
      await writeFile(`test-results/absolute-clipping-${name}.json`, JSON.stringify(report, null, 2));
      assert.equal(output.code, entry.rules.length ? 1 : 0, `${name}: ${output.stderr}`);
      assert.equal(report.runs.length, 4);
      for (const run of report.runs) {
        assert.deepEqual([...new Set(run.states[0]?.findings.map(f => f.rule))], entry.rules, name);
        const page = await browser.newPage({ viewport: run.viewport, colorScheme: run.colorScheme });
        try {
          await page.goto(url);
          const painted = await page.evaluate(() => {
            const target = document.querySelector('#target');
            if (!(target instanceof HTMLElement)) throw new Error('Fixture element is missing.');
            const range = document.createRange();
            range.selectNodeContents(target);
            const text = range.getBoundingClientRect();
            const visible = [0.1, 0.5, 0.9].map(fraction => {
              const hit = document.elementFromPoint(text.left + text.width * fraction, (text.top + text.bottom) / 2);
              return hit === target || (hit !== null && target.contains(hit));
            });
            return { visible, offsetParent: target.offsetParent?.tagName ?? '' };
          });
          if (name === 'clipped') assert.ok(painted.visible.some(value => !value), 'The positioned parent must clip the text.');
          else {
            assert.ok(painted.visible.every(Boolean), 'The browser must paint the complete text.');
            assert.equal(painted.offsetParent, 'BODY');
          }
        } finally { await page.close(); }
      }
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
