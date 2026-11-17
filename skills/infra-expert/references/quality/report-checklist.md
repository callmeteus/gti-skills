# Report checklist

Check the data file against this list before rendering. Any "no" must be fixed.

## Content

- [ ] The scope names the area, what was reviewed, why, and what was not.
- [ ] There are three to six candidates, each with files or resources, a problem, a change, gains, a layer, a risk, effort, and strength.
- [ ] Every problem and gain names real files, stacks, or resources.
- [ ] Every problem and at least two gains contain a number: files, copies, hardcoded occurrences, open ports, idle resources.
- [ ] Every scan lead in the report was confirmed by reading the code or the resource.
- [ ] Each candidate's risk is the lowest one that achieves it, and `replace` or `live-change` candidates say what the user would run.
- [ ] No candidate proposes a detailed module interface or HCL yet.
- [ ] Candidates that go against an ADR or project rule say which one and why it is worth reopening.
- [ ] The top recommendation names one candidate and gives a reason in one or two sentences.

## Safety

- [ ] The data file holds no secrets, tokens, keys, or state content. Resource IDs and names are fine.
- [ ] No candidate widens access, even as an intermediate step.

## Language

- [ ] `render_report.py --strict` passes: no vague claims.
- [ ] Product, tenant, and environment names match the repository.
- [ ] Sentences are short, and someone who runs this infrastructure understands each one on the first read.

## Diagrams

- [ ] Each candidate has a before and an after diagram with five to eight boxes.
- [ ] Box labels are real stack, module, file, or resource names.
- [ ] The problem is marked red in the before diagram and the new piece green in the after diagram.
- [ ] Both diagrams show the same callers or traffic, so the difference is visible at a glance.
