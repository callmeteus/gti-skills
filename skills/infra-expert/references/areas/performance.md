# Area: performance checkup

Find the usage patterns that make a database, cache, queue, or service slow, measure them, and write one notice per finding group that a person can act on without a meeting. Read this file when the user asks why something is slow, asks for a performance analysis or a checkup, or asks to watch a system and report problems before anyone complains.

The model is proactive support, as some managed database providers now do it: watch the system, spot a bad pattern or something to improve, and reach out first with the numbers, the cause, and the fix. A worked example for a Redis cache:

- **Symptom:** latency spikes all day; the slowest calls took several seconds, so plain reads and writes queued behind them.
- **Cause:** thousands of `KEYS` calls per day at a steady rate of several per minute, each taking seconds, plus tens of thousands of `SCAN` calls, a few hundred of them slower than half a second. Both commands walk the whole key space, and other commands wait while one runs.
- **Recommendation:** delete `KEYS` from the application; move `SCAN` to background work, since a smaller `COUNT` does not shorten the walk when few keys match; track key names in small Sets per prefix, or, when keys expire, in a Sorted Set scored by expiry time (`ZADD` on write, `ZRANGEBYSCORE` from the current time on read, a periodic `ZREMRANGEBYSCORE` for cleanup).

Every notice this area writes has that shape: the symptom with numbers, the cause with numbers and one sentence of mechanism, and recommendations specific enough to become a code change.

Nothing in this area changes a system. A fix goes through Operate mode when the user asks for it, or through a change plan when it spans several targets or needs an approval.

## Steps

### 1. Scope

- Take the targets from the request. For "check everything" or a scheduled run, take them from the project inventory in `.gti/infra-expert/hosts.md` and `records.md`; do not add a target because a dashboard shows it.
- Fix one time window per run, for example "today, 00:00 to now, UTC" or "the last 24 hours", and use it in every number. Write the window in the notice.
- Read `access.md` and `mcp.md` and use the access ladder from [../operate/01-orient.md](../operate/01-orient.md): the project MCP first, then its CLI, then a read-only shell. Record each CLI fallback as an MCP gap.

### 2. Measure, read-only

Read what the system already counts. Never run the expensive pattern to measure it: no `KEYS *`, no full `SCAN` loop, no `EXPLAIN ANALYZE` on a write, no load test against production.

| System | Read | It answers |
|--------|------|------------|
| Redis, Valkey, managed Redis | `INFO commandstats`, `INFO stats`, `INFO memory`, `SLOWLOG GET 128`, `LATENCY LATEST`, the provider's metrics API or console export | Calls and microseconds per command, slow calls with their arguments, evictions, memory against `maxmemory` |
| PostgreSQL | `pg_stat_statements` ordered by `total_exec_time` and by `calls`, `pg_stat_user_tables` (`seq_scan`, `seq_tup_read`, `n_dead_tup`), `pg_stat_activity`, `pg_locks` | The queries that cost the most time, sequential scans on large tables, lock waits, idle-in-transaction sessions |
| MySQL, MariaDB | The slow query log, `performance_schema.events_statements_summary_by_digest` | Statements by total time, rows examined against rows sent |
| MongoDB | The profiler at level 1, `db.currentOp()`, `$indexStats` | Collection scans (`COLLSCAN`), slow operations, unused indexes |
| HTTP services and proxies | Access logs or metrics: p50, p95, p99, and max latency per route, status codes, upstream time | Which routes are slow, and whether the time is in the service or upstream |
| Queues | Depth, age of the oldest message, consumer count, redeliveries | Whether consumers keep up |
| Hosts | CPU steal, iowait, load against cores, swap in and out, disk queue and latency | Whether the machine, not the software, is the limit |

Save every raw output in the run folder (`knowledge.py tmp`). The notice quotes numbers from these files, never from memory.

### 3. Match the pattern catalog

Compare the measurements with the patterns below. A pattern becomes a finding only when its numbers were measured in the window. A pattern you could not measure goes into Not checked.

| Pattern | Signal | Mechanism, in one sentence | Recommendation |
|---------|--------|----------------------------|----------------|
| `KEYS` in application code | `cmdstat_keys` calls above zero, `KEYS` in the slow log | `KEYS` walks every key in one blocking call, so every other command waits behind it | Remove it; keep key names in a Set per prefix or in a Sorted Set scored by expiry |
| `SCAN` on a hot path | Many `SCAN` calls, slow-log entries for `SCAN` with a `MATCH` pattern | Each call walks part of the key space, and a lower `COUNT` does not reduce the work when few keys match | Move it to a background job, or replace it with an index Set as above |
| Whole-collection reads | Slow `SMEMBERS`, `HGETALL`, `LRANGE 0 -1`, `ZRANGE 0 -1` on large keys | The command's time grows with the key's size | Page with `SSCAN`, `HSCAN`, or a range, or split the key by prefix |
| Large keys or no TTL | `INFO memory` near `maxmemory`, `evicted_keys` growing, keys without expiry | Memory fills with data nobody reads, then eviction removes data someone needs | Set TTLs at write time; split large keys |
| One round trip per command | High call count with low time per call from the same client, in a loop | Network time dominates, not command time | Pipeline or batch with `MGET`, `MSET`, or a transaction |
| Sequential scan on a large table | High `seq_tup_read` with few `idx_scan` on the same table | Every lookup reads the whole table | Add the index the `WHERE` clause needs, after checking it with `EXPLAIN` on a read |
| N+1 queries | One statement with very many calls and a low mean time, called per row of another query | The total is small times many | Load in one query with a join or `IN` list |
| Lock waits | Waiting sessions in `pg_locks`, long `idle in transaction` | A transaction holds a lock while the application does other work | Keep transactions short; set `idle_in_transaction_session_timeout` |
| Connection churn or saturation | Connections near the limit, many short-lived connections | Each connection costs a handshake and memory on the server | Use a pool sized below the server limit |
| Slow upstream, fast service | Upstream time close to total time | The service waits on a dependency | Cache or batch the dependency call, or set a timeout below the caller's |
| Host limit | CPU steal, iowait, swap, or disk queue high while software time is low | The machine is the bottleneck | Resize or move the workload; do not tune the software first |

A provider limit belongs in the notice when it applies to the target, for example a managed Redis that rejects `KEYS` above a key count. State the limit with its source, and only when you read it in the provider's documentation.

### 4. Quantify

For each finding write down:

- **Symptom:** what a user of the system sees, with numbers: "the slowest calls took 1.8 to 2.7 s between 09:00 and 18:00", "p99 of `/checkout` rose from 180 ms to 2.1 s".
- **Ordinary work affected:** the normal operations that wait behind it, for example "every `GET` issued during one of those calls waits for it".
- **Cause:** the pattern, with counts, rate, and duration range from the window: "2,950 `KEYS` calls in the window, 5 to 9 per minute, 80 percent of them slower than 1 s".
- **Mechanism:** one sentence on why the cause produces the symptom.
- **Recommendation:** the change, in order of impact, specific enough to become a code change: the command, the data structure, the index, the setting.

Follow [../concepts/plain-language.md](../concepts/plain-language.md): exact counts or a stated range, never "a lot of", "some", or "significant". Use the system's own command and setting names; explain each one the first time.

### 5. Write the notice

Fill [../../assets/templates/performance-notice.md](../../assets/templates/performance-notice.md), one file per target, at `~/.gti/infra-expert/<project>/performance/<YYYYMMDD>-<target>.md`. Write it to the person who owns the code, in the user's language, and keep command names and code exactly as they are. Start with the finding that costs the most time. Put patterns you could not measure under Not checked, with the reason.

When a recommendation needs a change on several targets, an approval, or a downtime decision, also write a plan with `plan.py new` in `.gti/infra-expert/plans/` and leave every step pending; see [plans.md](plans.md).

### 6. Deliver

- Give the user the absolute path of each notice and a two-line summary per target.
- Sending a notice to anyone else (an email, a chat message, an issue, a ticket) is an outward action. Draft it, show it, and send only when the user asks for that send.
- Change nothing. Applying a recommendation is a separate request handled by Operate mode or a plan.

## Watching on a schedule

A scheduled or "keep watching" run uses the same steps with these differences:

- Keep the last run's findings in `~/.gti/infra-expert/<project>/performance/state.json`: target, pattern, the numbers, and the date.
- Write a notice only for a finding that is new, or whose numbers got worse by the margin the user set (25 percent when none was set). An unchanged finding gets one line in the run summary, not a new notice.
- A target that could not be read is reported as not checked, never as healthy.
- Ask nothing, send nothing, and change nothing. List each send and each fix as pending.

## Quality bar

Before you hand a notice over, check that:

- Every number comes from a file in the run folder and states its window.
- The symptom names what a user sees, not only an internal metric.
- Each cause has its own numbers and one sentence of mechanism.
- Each recommendation names the exact command, structure, index, or setting, and none says only "optimize" or "investigate".
- Not checked lists every target or pattern you could not measure.
- No secret, connection string, or customer data appears in the notice. Key names that hold personal data are shown by prefix only.
