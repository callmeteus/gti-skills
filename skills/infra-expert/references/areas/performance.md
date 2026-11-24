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

- **Measure before reading code.** Query the metric store and the targets first: per-node and per-process numbers, request rate, and cost per request over the window, plus deploy and restart annotations. Read code only to explain a pattern you measured. A cause found only by reading code is a hypothesis, not a finding.
- **Use the project's own diagnostic first.** Search the project CLI, its scripts, and its admin endpoints for the symptom word (`cpu`, `memory`, `debug`, `stats`) before writing your own probe. A built-in per-worker CPU or timer view answers faster than a grep through the code.
- **A request to look is permission to read.** "Go into the nodes and find the high CPU" already allows read-only access to those nodes through the documented path. A project rule that gates changes does not gate a read-only measurement the request implies; do not stop to ask for it.
- **Read the chart's metadata through its API.** Annotations, deploy markers, and panel queries come from the dashboard API; do not ask the user what a marker on a screenshot means.

| System | Read | It answers |
|--------|------|------------|
| Redis, Valkey, managed Redis | `INFO commandstats`, `INFO stats`, `INFO memory`, `SLOWLOG GET 128`, `LATENCY LATEST`, the provider's metrics API or console export | Calls and microseconds per command, slow calls with their arguments, evictions, memory against `maxmemory` |
| PostgreSQL | `pg_stat_statements` ordered by `total_exec_time` and by `calls`, `pg_stat_user_tables` (`seq_scan`, `seq_tup_read`, `n_dead_tup`), `pg_stat_activity`, `pg_locks` | The queries that cost the most time, sequential scans on large tables, lock waits, idle-in-transaction sessions |
| MySQL, MariaDB | The slow query log, `performance_schema.events_statements_summary_by_digest` | Statements by total time, rows examined against rows sent |
| MongoDB | The profiler at level 1, `db.currentOp()`, `$indexStats` | Collection scans (`COLLSCAN`), slow operations, unused indexes |
| HTTP services and proxies | Access logs or metrics: p50, p95, p99, and max latency per route, status codes, upstream time | Which routes are slow, and whether the time is in the service or upstream |
| Service CPU | CPU per node, per process, and per worker (`/proc/<pid>/stat`, container CPU, the project's debug endpoint), CPU per request, background timer counts, the deployed version on each node | Whether the cost is per request (even across workers), background work (one hot worker or node), or new in a version |
| Metrics pipeline | Series count per node (`count by (instance)({__name__=~"<prefix>.*"})`), `scrape_duration_seconds`, scrape payload size | Whether the service spends its CPU producing its own metrics |
| Managed database load | Load grouped by database user, then wait event, then normalized SQL (for example Performance Insights `db.load.avg`), at 1-minute resolution, against the instance's vCPU count and the provider's CPU metric | Which client and which statement cost the load, and whether a short spike hides inside a 5-minute average |
| Managed serverless cache | Compute units per second at per-minute peaks over a week, throttled command count, data stored, connections | Whether the capacity cap is below real bursts; see [cache-migration.md](cache-migration.md) |
| Queues | Depth, age of the oldest message, consumer count, redeliveries | Whether consumers keep up |
| Hosts | CPU steal, iowait, load against cores, swap in and out, disk queue and latency | Whether the machine, not the software, is the limit |
| Host memory | `available` and `buff/cache` (not `used`), `/proc/pressure/memory`, OOM lines in the kernel log, RSS grouped by command, the process manager's list run as the user that owns the app, the memory metric at 1-minute resolution | Whether memory is really full or only cached, whether it thrashes, which process family holds it, and the minute it jumped |

Save every raw output in the run folder (`knowledge.py tmp`). The notice quotes numbers from these files, never from memory.

When a metric jumped, find the minute of the jump at 1-minute resolution, then count log lines per module per minute in a window around it. A module whose rate rose three times at that minute is the first suspect. For a scheduled job, prove the link by finding the same spike again at the job's next trigger time; match the statement text to the job definition when the database does not name the job.

### Classify the curve before the cause

Read the shape of the metric over the window and the deploy annotations before you name a cause. Each shape points to a family of causes, and each hypothesis must name the measurement that would reject it.

| Shape | Points to | Rejected when |
|-------|-----------|---------------|
| A step at a deploy | Cost added per request in that version | The step does not line up with the deploy on each node, or the per-request cost is flat across it |
| A slope while traffic is flat or falling | State that grows with uptime: metric series, caches, leaks, queues | The metric stays flat between restarts |
| A sawtooth that resets at each restart | Accumulation inside the process | Memory or CPU does not drop after a restart |
| One node or one worker above the others | Work only that node or worker does: singleton timers, scrape target, leader duties | The per-worker spread is even |
| A spike at a fixed interval | A scheduled job | The spike does not repeat at the next trigger |

For a regression across deploys, read the version that runs on each node (image tag, version file, container start time) and compare the version before the rise with the version after it. Never compare the default branch with a commit picked by date, because nodes can run different versions.

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
| Heap caps above host memory | N workers × per-process heap cap (`--max-old-space-size`, `-Xmx`) above host RAM, no per-process memory limit, workers growing with traffic and dropping after a restart | Nothing but the kernel's OOM killer limits total memory, so a traffic peak fills the host | Set the cap so N × cap plus overhead fits in RAM, add a supervisor limit (pm2 `max_memory_restart`, systemd `MemoryMax`, a container limit), then fewer workers or a bigger host. Swap added without a restart is only a guard against OOM kills, not a fix |
| Unbounded metric labels | Series count per node and scrape duration rising while traffic is flat | Raw hosts, unnormalized paths, or IDs as labels, multiplied by histogram buckets, make every scrape serialize more | Clamp labels to a known set (`<unknown>`, `<unmatched>`), normalize paths to routes, drop IDs from labels |
| Per-request diagnostics left on | Profile or code shows timing or debug data serialized on every request, or a large shared config reloaded per request | Work meant for debugging runs on every request | Raise the threshold above zero or sample, and cache the parsed config by version stamp |
| Serverless capacity cap below bursts | Throttled commands above zero, per-minute peaks above the cap | The provider rejects or delays commands above the cap | Size the cap from a week of per-minute peaks × measured units per command; see [cache-migration.md](cache-migration.md) |

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

When the cause could not be measured, set the notice's status to `hypothesis` and say so in the first line, with the basis (which code version was read, what access was missing). Rank the hypotheses by how well they fit the curve shape, give each one the exact read-only query and the result that would confirm or reject it, list what was ruled out, and name the data still missing, such as the version per node or the deploy annotations. Never present a hypothesis as a finding.

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
- A metric value quoted from an alert or a forwarded diagnosis was checked on the named resource and window, and a mismatch is reported with the measured number.
- A notice without a measured cause carries the status `hypothesis`, with a rejecting query per hypothesis.
- The symptom names what a user sees, not only an internal metric.
- Each cause has its own numbers and one sentence of mechanism.
- Each recommendation names the exact command, structure, index, or setting, and none says only "optimize" or "investigate".
- Not checked lists every target or pattern you could not measure.
- No secret, connection string, or customer data appears in the notice. Key names that hold personal data are shown by prefix only.
