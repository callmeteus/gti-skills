# Untangle Decision Log

<!-- Keep this file current. After a context reset, read it before anything else. -->

## Run

| Field | Value |
|-------|-------|
| Scope | <whole repository, or the named area> |
| Additions | Comments: yes / no. Tests: yes / no |
| Branch | `untangle/<date>` from `<base commit>` |
| Public surfaces (ask before changing) | <list> |
| Baseline commands | `<test>`, `<typecheck>`, `<lint>`, `<build>` |
| Baseline results | <passed / failed / skipped, known failures> |
| Baseline measurements | special cases <n>, cycles <n>, volatile imports <n> |

## Progress

```text
- [ ] 1. Ask and prepare
- [ ] 2. List every problem
- [ ] 3. Redesign from first principles
- [ ] 4. Fix everything on the list
- [ ] 5. Check, repeat until done, final report
```

Round: 1

## Problems

<!-- One line each: [hidden|needless|surplus|special] `file:line` what is wrong. -->

- [kind] `path:line` <what is wrong>

## Fixes

<!-- Each fix above the problems it solves. Mark done with the commit hash. -->

- Fix 1: <what changes and why>. Order: <after fix N>. Risk: <surfaces, tests>. Status: planned / done `<hash>`
  - `path:line` <problem>

## Kept, with reason

- `path:line` <special case or link that stays, and the requirement behind it>

## Leads dismissed

- `path:line` <script lead that is not a problem, and why>

## Open questions for the user

- <question, and which fixes wait on it>

## Bugs fixed along the way

- <bug>, covered by `<test>`, fixed in `<hash>`

## Public surface changes (approved)

- <surface>: <change>, approved <when>
