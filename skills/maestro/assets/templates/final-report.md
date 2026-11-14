# Final report: <goal>

## Summary

| Field | Value |
|---|---|
| Run | `<run-id>` |
| Class | `<simple or complex>` |
| Status | `<done or blocked>` |
| Waves | `<passed>/<total>` |
| Workers | `<spawned> spawned, <passed> passed, <reassigned> reassigned |
| Checks | `<test, typecheck, lint, build>` |
| Maestro model | `<model>` |

<Three sentences: what was asked, what changed, and whether it is proven.>

## Done criteria

| Criterion | Status | Evidence |
|---|---|---|
| <criterion> | <MET or NOT MET> | `<command or file>` |

## Workers

| Task | Type | Tier | Provider/model | Adapter | Chat | Rounds | Verdict |
|---|---|---|---|---|---|---|---|
| `w1.1` | scout | T1 | `<provider>/<model>` | <adapter> | `<id>` | 0 | PASS |
| `w2.1` | build | T2 | `<provider>/<model>` | <adapter> | `<id>` | 1 | PASS |

## Routing

| Task | Provider/model | Reason | Attempts |
|---|---|---|---|
| `w1.1` | `<provider>/<model>` | <why> | <primary, fallback, errors> |
| `w2.1` | `<provider>/<model>` | <why> | 1 rate limit on primary, fallback passed |

## Preferences

| Change | Old | New | Source |
|---|---|---|---|
| <role, route, fallback, or avoid> | <old> | <new> | <user words or "unchanged"> |

## Changes

| File | Change | Task |
|---|---|---|
| `<path>` | <one line> | `w2.1` |

## Checks

| Command | Result | Output |
|---|---|---|
| `<command>` | <pass or fail> | <summary> |

## Reviews

| Task | Gate failures | Resolution |
|---|---|---|
| `w2.1` | correctness | Fixed in round 1 in the same chat |

## Pending

- <Gated action, product decision, missing access, or task over budget>

## Not verified

- <Check that could not run, platform not tested, UI state not rendered>

## Chats

| Task | Chat id | Keep for follow-up |
|---|---|---|
| `w2.1` | `<id>` | Yes |

## Reproduce

```bash
<commands needed to reproduce the verification>
```
