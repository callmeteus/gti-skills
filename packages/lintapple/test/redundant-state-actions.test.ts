import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkPage, ruleIds } from '../src/index.js';

const fixture = (content: string, containerStyle = '') => `<!doctype html><html><style>
html{background:#fff;color:#111;font:16px system-ui}body{margin:24px}
[data-ui-actions]{display:flex;align-items:center;${containerStyle}}
button,[role=button]{box-sizing:border-box;height:36px;font:16px system-ui;padding:0 12px}
</style><body><div data-ui-actions>${content}</div></body></html>`;

const cases = [
  { name: 'disabled neighbour in the same row', html: fixture('<button>A</button><button style="margin-left:8px" disabled>B</button>'), expected: 1 },
  { name: 'aria-disabled neighbour', html: fixture('<button>A</button><button style="margin-left:8px" aria-disabled="true">B</button>'), expected: 1 },
  { name: 'icon-only buttons with no matching label text', html: fixture('<button aria-label="Start">*</button><button aria-label="Stop" style="margin-left:8px" disabled>#</button>'), expected: 1 },
  { name: 'role=button elements', html: fixture('<div role="button" tabindex="0">A</div><div role="button" aria-disabled="true" style="margin-left:8px">B</div>'), expected: 1 },
  { name: 'same data-ui-action', html: fixture('<button data-ui-action="save">A</button><button data-ui-action="save" style="margin-left:8px">B</button>'), expected: 1 },
  { name: 'same data-action', html: fixture('<button data-action="save">A</button><button data-action="save" style="margin-left:8px">B</button>'), expected: 1 },
  { name: 'same aria-controls', html: fixture('<button aria-controls="panel">A</button><button aria-controls="panel" style="margin-left:8px">B</button>'), expected: 1 },
  { name: 'same formaction', html: fixture('<button formaction="/save">A</button><button formaction="/save" style="margin-left:8px">B</button>'), expected: 1 },
  { name: 'input buttons with the same name and value', html: fixture('<input type="button" name="act" value="go"><input type="button" name="act" value="go" style="margin-left:8px">'), expected: 1 },
  { name: 'gap above the nearby limit', html: fixture('<button>A</button><button style="margin-left:40px" disabled>B</button>'), expected: 0 },
  { name: 'buttons stacked in a column', html: fixture('<button>A</button><button disabled>B</button>', 'flex-direction:column'), expected: 0 },
  { name: 'different heights', html: fixture('<button>A</button><button style="height:60px;margin-left:8px" disabled>B</button>'), expected: 0 },
  { name: 'both buttons enabled without a declared action', html: fixture('<button>A</button><button style="margin-left:8px">B</button>'), expected: 0 },
  { name: 'both buttons disabled', html: fixture('<button disabled>A</button><button style="margin-left:8px" disabled>B</button>'), expected: 0 },
  { name: 'different declared actions', html: fixture('<button data-ui-action="save">A</button><button data-ui-action="delete" style="margin-left:8px" disabled>B</button>'), expected: 0 },
  { name: 'hidden button', html: fixture('<button>A</button><button style="display:none" disabled>B</button>'), expected: 0 },
  { name: 'buttons in separate groups', html: '<div data-ui-actions><button>A</button></div><div data-ui-actions><button disabled>B</button></div>', expected: 0 },
  { name: 'matching buttons far apart in one group', html: fixture('<button data-ui-action="save">A</button><button data-ui-action="other">B</button><button data-ui-action="save" style="margin-left:40px">C</button>'), expected: 0 },
];

test('redundant state actions use DOM structure and state, not label text', async () => {
  assert.ok(ruleIds.includes('redundant-state-actions'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const entry of cases) {
      await page.setContent(entry.html);
      const report = await checkPage(page);
      const findings = report.findings.filter(f => f.rule === 'redundant-state-actions');
      assert.equal(findings.length, entry.expected, `${entry.name}: ${JSON.stringify(findings)}`);
      if (entry.expected) {
        assert.ok(findings[0].selector);
        assert.ok(findings[0].relatedSelector);
        assert.match(findings[0].fix, /one button/);
      }
    }
    await page.setContent(cases[0].html);
    const excepted = await checkPage(page, { exceptions: [{ selector: 'button', rules: ['redundant-state-actions'], reason: 'These controls switch two different services.' }] });
    assert.equal(excepted.findings.filter(f => f.rule === 'redundant-state-actions').length, 0);
    assert.equal(excepted.suppressed.filter(f => f.rule === 'redundant-state-actions').length, 1);
  } finally { await browser.close(); }
});
