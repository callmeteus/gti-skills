# Untangle Report: <project>

## Summary

<Two or three sentences: what the codebase looks like now, and the biggest change.>

| Field | Value |
|-------|-------|
| Scope | <scope> |
| Branch | `untangle/<date>`, <n> commits on top of `<base commit>` |
| Additions done | Comments: yes / no. Tests: yes / no |
| Status | done / stopped early: <reason> |

## Before and after

| Measure | Before | After |
|---------|-------:|------:|
| Special-case markers (total) | <n> | <n> |
| swallowed_exception | <n> | <n> |
| sleep | <n> | <n> |
| retry | <n> | <n> |
| disabled_test | <n> | <n> |
| literal_branch | <n> | <n> |
| suppression | <n> | <n> |
| marker_comment | <n> | <n> |
| Import cycles | <n> | <n> |
| Imports of more volatile code | <n> | <n> |
| Tests passing / failing | <n> / <n> | <n> / <n> |

## Main fixes

- <fix in one line> (`<hash>`)

## Special cases kept

- `path:line` <why it stays>

## Behavior check

- <commands run and results>
- Public surfaces compared with `<base commit>`: <no differences / approved changes>

## Bugs fixed along the way

- <bug>, covered by `<test>`

## Left to do

- <only if stopped early or blocked on a question>

The branch has not been merged or pushed.
