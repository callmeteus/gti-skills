# Report checklist

Check the data file against this list before rendering. Any "no" must be fixed.

## Content

- [ ] The scope says what was reviewed, why, and what was not.
- [ ] There are three to six candidates, each with files, a problem, a change, gains, a dependency type, effort, and strength.
- [ ] Every problem and gain names real files, functions, or classes.
- [ ] Every problem and at least two gains contain a number: files touched, mocks, duplicated call sites, tests deleted.
- [ ] No candidate proposes a detailed new API yet.
- [ ] Candidates that go against an ADR say which one and why it is worth reopening.
- [ ] The top recommendation names one candidate and gives a reason in one or two sentences.

## Language

- [ ] `render_report.py --strict` passes: no seam, deepen, shallow, depth, leverage, locality, adapter, port, or similar.
- [ ] Business words match the code and `GLOSSARY.md`.
- [ ] No vague praise: "cleaner", "more maintainable", "better architecture" without a concrete effect.
- [ ] Sentences are short and a developer new to the codebase understands each one on the first read.

## Diagrams

- [ ] Each candidate has a before and an after diagram with five to eight boxes.
- [ ] Box labels are real module, file, or function names.
- [ ] The problem is marked red in the before diagram and the new module green in the after diagram.
- [ ] The two diagrams show the same callers, so the difference is visible at a glance.
