# Run plan: <goal>

## Header

| Field | Value |
|---|---|
| Run | `<run-id>` |
| Class | `complex` |
| Maestro model | `<model>` |
| Orchestrator preference | `<provider>/<model>` |
| Executor preference | `<provider>/<model>` |
| Adapter | `<adapter>` |
| Budget | `<n> workers, <n> fix rounds, <n> waves` |
| Base | `<branch or commit>` |
| Isolation | `<shared checkout or worktree>` |

## Goal

<One sentence: the run is done when ...>

## Done criteria

1. <Observable criterion and the check that proves it>
2. <Observable criterion and the check that proves it>
3. <Observable criterion and the check that proves it>

## Non-goals

- <What this run will not touch>
- <What this run will not change>

## Constraints

- <Project rule, compatibility, performance, or security constraint>
- <Public surface that must stay intact>

## Risk flags

| Flag | Item | Handling |
|---|---|---|
| <irreversible, outward, secret, production, money> | <item> | <ask, pending, or allowed> |

## Waves

### Wave 1: discover

| Id | Type | Tier | Depends | Task | Scope | Done | Checks |
|---|---|---|---|---|---|---|---|
| `w1.1` | scout | T1 | - | <task> | <files> | <criteria> | <commands> |
| `w1.2` | scout | T1 | - | <task> | <files> | <criteria> | <commands> |

Gate: <what Maestro must see before wave 2>

### Wave 2: build

| Id | Type | Tier | Depends | Task | Scope | Done | Checks |
|---|---|---|---|---|---|---|---|
| `w2.1` | build | T2 | `w1.1` | <task> | <files> | <criteria> | <commands> |
| `w2.2` | build | T2 | `w1.2` | <task> | <files> | <criteria> | <commands> |

Gate: <what Maestro must see before wave 3>

### Wave 3: verify

| Id | Type | Tier | Depends | Task | Scope | Done | Checks |
|---|---|---|---|---|---|---|---|
| `w3.1` | verify | T1 | `w2.1`, `w2.2` | <task> | whole diff | <criteria> | full checks |
| `w3.2` | synthesize | T2 | `w3.1` | <task> | <files> | <criteria> | <commands> |

Gate: <what Maestro must see before done>

## Routes

| Task | Provider/model | Reason | Fallback |
|---|---|---|---|
| `w1.1` | `<provider>/<model>` | <why this model fits> | `<provider>/<model>` |
| `w1.2` | `<provider>/<model>` | <why this model fits> | `<provider>/<model>` |
| `w2.1` | `<provider>/<model>` | <why this model fits> | `<provider>/<model>` |
| `w2.2` | `<provider>/<model>` | <why this model fits> | `<provider>/<model>` |
| `w3.1` | `<provider>/<model>` | <why this model fits> | `<provider>/<model>` |

## Parallel safety

| Pair | Shared file or state | Action |
|---|---|---|
| `w2.1` / `w2.2` | <none or file> | <parallel or serialize> |

## Model tiers

| Tier | Model | Used by |
|---|---|---|
| T1 | <model> | `w1.1`, `w1.2`, `w3.1` |
| T2 | <model> | `w2.1`, `w2.2`, `w3.2` |
| T3 | <model> | <none> |

## Open questions

- <Question and default taken>
