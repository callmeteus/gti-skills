# Step 3: Waiting and setup

Goal: waiting under 5 s and setup under 15 s on every job.

## Waiting, under 5 seconds

Waiting is everything between "the run was created" and "the job's first step ran": queueing for a runner, booting a VM, scheduling a pod, pulling an image.

- **Warm runners.** Keep machines ready before the job arrives. On GitHub Actions, move jobs off the standard hosted runners to a faster runner vendor that keeps machines warm (Blacksmith is the source prompt's default; compare others on price and measured waiting). Self-hosted: a warm pool with a minimum of idle runners (ARC `minRunners`, GitLab runner `IdleCount` with autoscaling, Woodpecker agents always on, Jenkins agents kept online or a Kubernetes pod template with idle pods, act_runner with `capacity` above 1). Never scale the PR path to zero.
- **Images already on the node.** On Kubernetes and K3s, image pulls are often most of waiting: pre-pull the CI image with a DaemonSet, use `imagePullPolicy: IfNotPresent` with an immutable tag or digest, and run a pull-through registry mirror in the cluster (K3s `registries.yaml`).
- **Cancel superseded runs.** When a new commit lands on a branch, cancel its in-progress run so runners are free (GitHub and Forgejo `concurrency` with `cancel-in-progress`, GitLab `interruptible: true` with auto-cancel, Woodpecker's cancel-previous setting, Jenkins `disableConcurrentBuilds(abortPrevious: true)`). Never cancel runs on main or in the merge queue.
- **Enough capacity for the shape.** If a PR run has 6 parallel jobs and only 4 runners are idle, two jobs wait. Size the warm pool for the widest run times the usual number of open PRs.

A new vendor, a bigger machine, or more idle runners usually means an account, a secret, or a bigger bill: prepare the change, then put it on the pending list with the expected monthly cost (step 9).

## Setup, under 15 seconds

- **Bake the toolchain into the runner image.** Language runtimes, package managers, CLIs, browsers for end-to-end tests, and system packages belong in a versioned image built on its own, not installed in every job. A `setup-node` or `apt-get install` step on every run is setup time.
- **PR cache hits above 95%.** PR caches miss when the PR cannot read main's cache or main never writes one. Seed caches from main: a job on every push to main saves the caches under keys PRs can restore (GitHub restores from the base branch; GitLab, Forgejo, and Gitea need a fallback key; Woodpecker and Jenkins need a shared volume or an S3 cache). Measure the hit rate from logs and put it in the report.
- **Cache the installed dependencies, not only the download cache.** Cache `node_modules` itself (or `.venv`, `vendor/`, Rust `target/` dependencies, Gradle caches and the configuration cache) keyed by the lockfile hash and the toolchain version. On a hit, skip the install step entirely.
- **Clone less.** Use a blobless clone (`filter: blob:none`) when history is needed for selection or versioning, or a shallow clone (`fetch-depth: 1`) when it is not. On persistent self-hosted runners, keep the workspace or a reference repository and only fetch.
- **Build once.** A build that several jobs need is built once and shared as an artifact, not rebuilt in each job. On the backend side, build the app once per test process, not once per test file.
- **No network installs in the hot path.** Dependencies come from a cache or the image; use a registry mirror or proxy when the network is the bottleneck.

## Measure

After each change, collect again with the same command and compare the waiting and setup columns with the baseline. Keep the cache hit rate and image pull time in `state.md`.

## Done when

Waiting p50 is under 5 s and setup p50 is under 15 s on the critical path, or the remaining gap is on the pending list with its cost.
