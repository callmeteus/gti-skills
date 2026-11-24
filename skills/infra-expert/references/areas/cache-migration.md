# Area: cache migration

Move an application from one Redis-compatible cache to another, for example from a self-managed or provisioned cluster to a managed serverless cache (ElastiCache Serverless, Valkey, MemoryDB, or a provider equivalent), without losing live work and with a rollback that still works at every step. Read this file in Operate mode when the request is to switch, migrate, or cut over a cache, or to decommission the old one. The rules of `../operate/04-change.md`, `../operate/07-secrets.md`, and `../quality/safety.md` still apply.

The switch itself is usually a change of connection values in the canonical secret manager followed by a restart. The work around it is what keeps the switch safe: facts looked up instead of asked, reachability proven from the client host, data sized and copied with guards, the cutover checked on the host, and the old cache kept as the rollback until the new one is proven.

## 1. Facts before questions

- Pull the default branch and confirm that the running code supports the target: the TLS switch, the cluster client, and the names of the connection variables. A migration that needs no code change is the common case; say so with the file that shows it.
- Look up the target's endpoint, port, TLS mode, and authentication read-only in the provider's API (for example `describe-serverless-caches`, the user group, and the security groups). Do not ask the user for an endpoint or an auth decision the API answers.
- Compare with tenants or services that already use the target kind of cache. Read their variable names only, never their values, and copy the pattern. Do not invent new variable names.
- Hand the user a ready-to-apply block of variable names with their non-secret values (host, port, TLS flag) and the exact path in the canonical manager, when a person has to apply it.

Example: "The provider API shows the serverless cache with TLS on port 6379 and no user group, so access is controlled by network only and there is no password. The two services already migrated use `REDIS_HOST`, `REDIS_PORT`, and `REDIS_TLS=true`; I used the same three names."

## 2. Prove reachability from the client host

- Test from the host or pod that will connect, through the documented access path: a TCP connect, then TLS with the server name (`openssl s_client -connect <host>:<port> -servername <host>`), then one `PING` with the client tool the application uses.
- Do not conclude from security group metadata alone. A group ID listed by one API can be stale or absent from the VPC; the connection test is the proof.

## 3. Know what the client must do

| Target | What the client needs |
|--------|----------------------|
| Serverless or cluster-mode endpoint | A cluster client, and TLS when the provider enforces it |
| Multi-key commands, `MULTI`, Lua scripts | All keys in one hash slot, through a shared hash tag such as `{queue}:a` and `{queue}:b`; otherwise the server answers `CROSSSLOT` |
| No ACL user group | No username or password; the network is the only control, so the security group or private link must stay narrow |
| Configuration endpoint of a cluster with replicas | A connection may land on a replica: send `READONLY` to read from it, or follow `MOVED` to the primary |
| Pub/sub subscribers | A subscriber connection can stay stuck after the switch with redirection errors; check each subscriber process after the cutover |

## 4. Size and classify before copying

- Read size and key mix from a replica, never with `KEYS`: `INFO memory`, `INFO keyspace`, `DBSIZE`, and a sampled `SCAN` with `TYPE`, `TTL`, and `MEMORY USAGE` per sampled key, grouped by prefix.
- Compare the total with the target's data cap. When it does not fit, find the dead data first: completed and failed job history of a queue library, keys with no TTL that nothing reads, and old caches. Copying only live data is often a tiny fraction of the source.
- Record the keys with no TTL and who writes them. A rate limiter or a counter without TTL keeps growing on the new cache and becomes a cost line; fix it in code and check that the fix commit is in the running release (`git merge-base --is-ancestor <fix> <release>`).

## 5. Copy with guards

- Abort when the destination is not empty. Flush only the new destination, only after the user approves that flush, and never the source.
- Read from a replica of the source. Keep each key's TTL (`DUMP` and `RESTORE` with the remaining TTL, or the provider's migration tool). Skip the dead data found in step 4 and say what was skipped.
- Verify on a random sample of keys (type, value hash, TTL within a margin), then compare the counts that matter to the application, for example pending jobs per queue on both sides.
- Run a delta pass just before the restart, or say that it was skipped and why. Keys written between the copy and the restart are otherwise lost.
- Leave the source untouched. It is the rollback.

Example: "Destination was empty; after the user approved, the copy read from a replica, kept TTLs, skipped 39.9 GB of completed and failed job history, and copied 2.9 million live keys in 97 s. 3,000 sampled keys matched, and pending jobs per queue were 13 on both sides."

## 6. Switch through the canonical store, then read it back

- Change the connection values in the canonical secret manager at the project's path, through its documented path, with a dry run, a backup, and a read-back; see `../operate/07-secrets.md`.
- When the user says they made the change, read the canonical store back and read the value the running process uses (`/proc/<pid>/environ` or the platform's equivalent, names and non-secret values only). A value pasted only into a host file is lost at the next deploy. If the two differ, report it as a blocker for the next deploy and fix the store.
- Write the rollback as exact steps: the old values to restore in the canonical store, then the restart. A script's own rollback undoes only its own writes; after a hand edit, the rollback is the manual restore.

## 7. Verify the cutover on the host, then keep watching

- After the restart check, per process: the process state, the application's boot log line that names the cache host and TLS mode, established connections per destination address (`ss -tnp`), with zero application connections left on the old endpoint, and the provider's connection and throttling metrics (they can lag two to three minutes).
- Check again over the next hours. A subscriber or a worker can fail later with redirection or closed-connection errors. Restart only the affected process, one at a time, through the process manager.
- Watch the old cache: application reads and writes should drop to zero, with only replication and monitoring connections left.

## 8. Size the serverless capacity cap from peaks

- Measure the compute units per command on the real traffic (Lua-heavy queue libraries cost more than one unit per command), and take the per-minute peak over a full week, including nights and weekends. Multiply them and add margin. Do not size from an hourly average or from a few quiet minutes.
- After the switch, watch the provider's throttling metric (for example `ThrottledCmds`). Any throttled command means the cap is too low; report the bursts with their peaks and raise the cap through the documented path.
- Project the cost from several days of real usage, not from the first hour.

Example: "The cap of 150k units per second came from a night-time estimate; bursts reached 246k and 12.3 million commands were throttled in four bursts. The cap was raised and the monthly projection corrected from about 100 to about 150."

## 9. Decommission the old cache

Hand the user the delete command unless the request included deleting it. Before that:

- Confirm 24 to 48 hours with zero application reads and writes on the old cache.
- Read its snapshot retention. When it is zero, the delete command takes a final snapshot (`--final-snapshot-identifier` or the provider's equivalent).
- List the alarms, exporters, dashboards, and infrastructure-as-code stacks that reference it, so it is not recreated by the next apply or left alerting.

## Announcements during a migration

- State only what was verified in the session. Write estimates as estimates ("about 3 hours, estimated"), and never state an outcome that has not happened yet, such as "data will not be migrated" before the copy decision.
- When a stated fact proves wrong, send the correction at once to everyone who received it, and fix any record or memory that holds it.
