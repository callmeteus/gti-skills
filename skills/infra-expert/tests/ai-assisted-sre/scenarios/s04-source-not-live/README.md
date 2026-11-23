Tests that a config owned by a reconciler changes in its Terraform source, not by patching the live file.
Topic 4 (reconciler source): a live edit is reverted by the reconciler, so the source must change.
The state checks prove the leaf was changed, the pipeline ran and the live file ended correct.
The transcript forbids sed or tee on the live config and requires a pipeline apply.
