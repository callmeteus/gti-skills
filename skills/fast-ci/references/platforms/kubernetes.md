# Kubernetes and K3s runners

Covers CI that runs as pods: Tekton, Argo Workflows, Actions Runner Controller (ARC) for GitHub, act_runner or forgejo-runner on Kubernetes, the Woodpecker Kubernetes backend, the GitLab Kubernetes executor, Jenkins Kubernetes agents, and plain Kubernetes Jobs. K3s behaves the same, with its own registry configuration and often fewer, smaller nodes.

## Collect timings

```bash
python3 <skill-dir>/scripts/audit/ci_timings.py collect k8s --namespace ci --selector <label selector> --run-label <label> --job-label <label>
kubectl get pods -n ci -l <selector> -o json > pods.json
python3 <skill-dir>/scripts/audit/ci_timings.py collect k8s --file pods.json --run-label tekton.dev/pipelineRun
```

From each pod: creation to `PodScheduled` is waiting, scheduled to the first main container start is setup (image pull and init containers, such as a clone or a cache restore), and the main containers are running.

| System | Selector and labels |
|--------|---------------------|
| Tekton | `--selector tekton.dev/pipelineRun --run-label tekton.dev/pipelineRun --job-label tekton.dev/pipelineTask` |
| Argo Workflows | `--selector workflows.argoproj.io/workflow --run-label workflows.argoproj.io/workflow` |
| ARC runners | The runner scale set's labels; one pod per job, so leave `--run-label` empty and combine with the GitHub collector for queue times |
| Others | Read the labels of a CI pod with `kubectl get pod <name> --show-labels` and use those |

Finished pods are deleted by most controllers after a while, so collect soon after runs finish, or raise the pod retention for the audit window (a setting change for the user). Use both the pod timings and the CI system's own timings: the CI system shows queueing before a pod exists, the pods show scheduling and image pulls.

## Levers

| Bucket | Lever |
|--------|-------|
| Waiting | Warm capacity: ARC `minRunners` above zero, a node pool that does not scale to zero during working hours, or placeholder pods with low priority that real CI pods preempt |
| Waiting | Image pulls: one baked CI image, pinned by digest, pre-pulled on every CI node with a DaemonSet, `imagePullPolicy: IfNotPresent` |
| Waiting | A pull-through registry mirror in the cluster; on K3s, configure `/etc/rancher/k3s/registries.yaml` with `mirrors` pointing to it |
| Waiting | Requests that fit: oversized CPU or memory requests leave pods pending; right-size requests from measured usage |
| Setup | Init containers do only what is needed; clone with `--filter=blob:none` or `--depth 1` |
| Setup | Caches on a fast volume: a node-local `hostPath` or local PV with node affinity for single-node K3s, an RWX volume or an S3 cache (MinIO in cluster) for several nodes; seed from main |
| Running | CPU limits off or high for CI pods (CFS throttling makes tests slow and flaky); requests set so the scheduler packs correctly; workers equal to the CPU request |
| Running | One throwaway database per shard as a sidecar or an ephemeral pod, started from a migrated image or snapshot |
| Budget | Tekton `timeout` on tasks and `timeouts` on PipelineRuns, Argo `activeDeadlineSeconds`, Job `activeDeadlineSeconds` |

## K3s specifics

- Single-node or small clusters: image pulls and disk speed dominate. Put the containerd image store and caches on SSD or NVMe.
- The embedded containerd pulls through `registries.yaml`; a local registry mirror removes most waiting.
- `local-path` storage is node-local: caches stay warm only when CI pods land on the same node, so pin CI to that node or use an S3 cache.

## Notes

- Cluster changes (node pools, DaemonSets, registry mirrors, priority classes) are infrastructure: commit manifests when the user asked for them, and list cluster-side changes that need credentials or cost as pending.
- Measure CPU throttling with the container metrics (`container_cpu_cfs_throttled_periods_total`) before and after removing limits.
