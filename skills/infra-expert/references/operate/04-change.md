# Operate mode: change

Change the source of truth, apply in small reversible steps, and finish the reversible part of the request. When a change spans more than one target, needs an approval or a downtime decision, or comes from a CVE triage, write a change plan in `.gti/infra-expert/plans/` with `scripts/plan/plan.py` and apply only approved steps; see [../areas/plans.md](../areas/plans.md).

## Request scope

The verb of the request sets the end state. Decide it before the first change and carry the request through to that end state.

- A bring-up verb means the task is done only when the change runs in its target and is verified. Bring up, deploy, apply, publish, roll out, upgrade, put live, and "create the machine or service" all mean this. Do the code change, the commit and push the project's commit policy allows, the apply through the project's pipeline (dispatching it when the pipeline applies only on dispatch), wait for the run, check the result, update the inventories, and send the project's announcements. Do not stop after the commit or after a plan.

  Example: "Bring up the service on a new host": wrote the leaf, committed and pushed it, dispatched the pipeline because it applies only on dispatch, waited for the run to finish, checked the health endpoint, updated the host inventory, and announced the confirmed result.

- A documentation or code-only verb stops before the apply. Document, write, draft, prepare, plan, "create the code, the files, or the stack", and anything with "only" mean this. Say what is left to bring it up.

  Example: "Only create the stack files": wrote and validated the files and committed them, and listed the pipeline dispatch, the run check, and the health verification as the steps left to bring it up.

- When the verb does not settle it, ask once, inside the confirmation the project already requires (for example the commit question), with the two choices "commit and apply" and "commit only". Do not add a separate question for the apply.

  Example: "Set up the new environment": the commit question offered "commit and apply" and "commit only", and no second question about the apply was added.

- A bring-up request is the user's permission for the apply through the project's pipeline. Project gates still apply once, such as a commit confirmation, a maintenance notice, or a downtime question. Do not ask a second time for the apply itself.

  Example: The commit confirmation was answered once, the maintenance start notice went out before the pipeline was dispatched, the maintenance end notice went out only after the run succeeded and the service was verified, and no further ask for the apply was made.

- An input that has a later path never blocks the apply. An optional variable with an empty default or a step that adds it after boot is applied without it and listed as pending with how to add it. Only an input without which the apply fails or produces a broken service blocks, and then name exactly which one and why.

  Example: "The token variable has an empty default and a later step fills it in after boot, so the apply went ahead and the token is listed as pending with the step that adds it."

- Follow the pipeline run to its end, report its result, and verify the service. The zero-downtime and backup rules still apply.

  Example: "The pipeline run ended in success; I reported its result, confirmed the health checks stayed green during and after the run, and removed the non-database backup."

## Reconciler-owned targets

- Change anything a reconciler owns only through its source: a Terraform pipeline, a GitOps controller, a compose file in git, or a config generator. Do not patch the live target to test and commit later, because the reconciler will revert it and what you tested will not be what ships.
- Pin applies to a fixed commit or SHA, not to the moving tip of the default branch. Do not let a push land in the middle of an apply, because the run will use a different source than the one you reviewed.

Example: render the config locally, commit it, and let the pipeline deploy it; do not edit the live config file.

## Safe apply scripts

- Upsert by stable ID and delete only what disappeared from the source. Do not delete-all-then-recreate, because a failure halfway leaves the target empty and resets alert state.
- Print a dry-run diff first, create or update before deleting, and write backups to a temporary name that is renamed only on success. Do not treat a half-written backup as valid, because the next run will restore from it.

Example: "Dry run: 2 creates, 1 update, 0 deletes. Backup written to `.tmp` and renamed after the PUT succeeded."

## Backups

- Before changing state the source of truth cannot rebuild, take a backup and name where you put it. This covers a config file edited on a host, a database, a volume, a local SQLite file, a secret, a dashboard or alert in a live tool, a DNS record, and the image a service runs. Tag the image the service runs now as a rollback image before you replace it. Do not change such state without a backup, because there is no source to restore it from.

  Example: "Backed up `/etc/service/config.yml` to `/var/backups/config-2026-11-19T10-30-00Z.yml` and tagged the running image `app:rollback-2026-11-19` before pulling the new one."

- Check a backup before you rely on it: confirm its size and checksum, list the files in an archive, or list the tables in a database dump. Do not count a backup you never checked, because you may find out only when you need to restore it.

  Example: "The dump is 42 MB, its SHA-256 matches the value recorded at creation, and the table list in the dump shows all 18 expected tables."

- Name each backup with a timestamp, keep it outside the repository, keep the permissions of the original, and never print its content. A copy of a secrets file stays readable only by its owner; do not print a dump or a secret value into the transcript.

  Example: "The secrets file copy is `secrets.env.2026-11-19T10-30-00Z` under `/var/backups/` and keeps mode 600, and no content was printed."

- After the change is verified, with health checks during and after the change and with the symptom the user reported gone, delete the backups of non-database state and the rollback image tag, and say which ones you deleted. Do not leave non-database backups behind, because they can hold stale secrets or config.

  Example: "Health stayed green and the reported error no longer appears; removed the config backup and the `app:rollback-2026-11-19` tag."

- Keep database backups until the user confirms they can be deleted. List each one with its path, size, and date in the final message and ask. Do not remove a dump, a snapshot, or a copy of database files on your own, because it may be the only recovery point.

  Example: "Kept `/var/backups/db-2026-11-19T10-30-00Z.sql` (42 MB, 2026-11-19). Can I delete it now?"

- If the change failed or you rolled it back, keep every backup and say so. Do not delete backups while the state is uncertain, because you may still need them.

  Example: "The apply failed and I rolled back; both the config backup and the database dump are kept for recovery."

- In Autonomous Mode, delete the non-database backups after verification and keep the database backups. List the kept database backups as pending for the user's decision. Do not delete a database backup, because the user has not confirmed it.

  Example: "Removed the config backup after health checks passed; kept the database dump and listed it as pending for the user."

- Keep local copies taken during the task in the run folder (`$RUN`), the folder printed by `knowledge.py tmp` at the start of the task; see `01-orient.md`. A config rendered locally or a dump written to disk belongs there, not in the system temporary folder, in the user's private folders, or elsewhere in the repository. When the task is verified, delete the run folder's non-database files together with the other non-database backups and say which ones you deleted. Keep database dumps in the run folder until the user confirms they can be deleted, and list each one with its path, size, and date as pending. Do not leave non-database scratch files behind, because they can hold stale secrets or config, and do not delete a database dump without confirmation, because it may be the only recovery point.

  Example: "Health stayed green; removed the rendered config and the command output from the run folder, and kept the database dump there as pending."

## Named methods and deploy outputs

- Treat a method the user names ("via Terraform", "through the pipeline") as a requirement. When that path does not exist for the target, stop and say so, and propose creating it, for example a new stack or leaf that wraps the service's own deploy script. Do not switch to a manual path to satisfy the request, because the result would not be maintained by the method the user chose.
- When the user names no method, use the project's provisioning path from `conventions.md` as the method. A create, bring up, or deploy request inherits that path by default. Do not create resources by hand in a console or with a vendor CLI when a provisioning path exists.
- In Autonomous Mode, write the proposal and list the manual deploy as pending. Do not run the manual deploy, because the request did not waive the named method.
- After a deploy script runs, change its output only by changing the script or its source and running it again. Do not patch files on the host by hand, because the next deploy will revert the patch and the repository will not show what changed.

Example: "There is no Terraform stack for this service. I propose a leaf stack that calls its deploy script; the manual deploy is pending." If the reverse-proxy config is wrong after the deploy, edit the generator in the repository and rerun it, not the host file.

Example: "No method was named, so I used the provisioning path in `conventions.md` and copied the stable single-service stack that has been in the default branch for some time."

## Environments and fleets

- Run test environments on the same image or artifact as production with different variables. Do not write a reduced imitation of a production component, because its headers and behaviour will differ and the test will pass for the wrong reason. If the real artifact cannot start, report that as the problem.
- Put a fix asked for on one machine of a fleet into the bootstrap or module first, then apply it to every existing machine. Add a check that compares them. Do not adjust only the machine in front of you, because the next machine is created without the fix.

Example: "The interface fix goes into the VM bootstrap, then a check lists the version and theme on every VM and shows the ones that differ."

## Requirements, names, and announcements

- Do not drop a stated requirement (thinking mode, context size, tool calls) to make a test pass. Report the conflict, because the client still needs the feature.
- Restate an ordering or priority requirement as a numbered list before applying it. Do not collapse it into one edit, because a fallback chain is order-sensitive.
- After a rename, search the repository for the old name and list what is left before saying it is done. Search for an existing file, folder, group, secret, or config before creating one. Do not create a parallel copy, because later changes will go to the wrong one.

Example: "Old prefix still appears in 3 variables; I renamed those too" instead of "renamed, done".

- Send a maintenance or status announcement only after a command on the target returned success. State only what that command confirmed and name the target. Do not announce from intent, because a message that says "finished" for a host you never reached is wrong and hard to retract.

Example: "Unit restarted on `app-host-02`, health check returned 200" or no message at all.

## Finish the job

- Apply the fix and verify it when the fix is inside the request and reversible. A diagnosis alone is not done. Do not stop to hand the obvious next step back to the user, because that leaves the requested work unfinished.
- Stop only for writes in production that the request did not authorize, money, a real fork in the decision, or a step that needs a person (login, MFA, UI click). Say once what is needed and continue with the rest of the work instead of reopening the same confirmation.

Example: "I found the wrong port in the unit and changed it, then confirmed the health check" instead of "the port is wrong, want me to fix it?"

## Zero downtime

Every change that touches a running service is planned as rolling or zero-downtime before it runs. The plan must say how the service stays up, not just that the change looks safe. Name the pattern you chose from these options:

- **Rolling by node:** change one node at a time, run a health check and drain traffic from that node before changing it, then wait for it to answer again and return it to the pool before the next node.
- **Blue-green or rolling container replace:** start the new version next to the old one, check its health, switch traffic to it, and stop the old one only after the switch is confirmed.
- **Reload instead of restart:** when the server supports it, reload the configuration in place (`nginx -s reload`, `systemctl reload`) rather than stopping the process.
- **Expand and contract migrations:** split a database change into steps that the old and the new code both tolerate, for example add a nullable column, deploy code that writes to both, backfill, then drop the old column in a later contract step. Do not lock a table or remove something the old code still reads.
- **Replace under create_before_destroy:** allow a `replace` in a Terraform or OpenTofu plan only when the resource sets `create_before_destroy` or an equivalent; otherwise plan an in-place update.
- **Pause and resume scheduled jobs:** pause a scheduler or queue consumer and resume it after the change. Do not kill a job partway through a run.

Example: "This is a rolling replace: drain and health check `web-01`, replace it, confirm it answers, return it to the pool, then move to `web-02`. The plan sets `create_before_destroy` on the instance, so no replace happens before a new node is ready."

Before running, check the plan for anything that causes downtime: a `replace` or `destroy` in a plan, a single-instance service, a restart with no second instance to take traffic, a migration that locks a table or breaks the old code, a port or DNS switch without an overlap period, or a host reboot. If any step causes downtime and no zero-downtime alternative exists, stop before changing anything. Tell the user what would go down, for how long, and the options: accept a window, add a second instance first, or defer. Then ask what to do. Never decide alone to accept downtime, even when the change was requested.

Example: "This service is a single instance with no load balancer and the upgrade needs a restart. There is no zero-downtime path; the process would be unavailable for about 30 seconds. Options: accept a 30-second window, add a second instance with a load balancer first, or defer. Which do you want?"

In Autonomous Mode, never run a step that causes downtime. List it as pending with the options above and continue with the rest of the work.

Example: "Restart on `app-host-02` needs a 30-second window and cannot be made rolling; listed as pending with options accept window, add second instance, defer."

Verify after each step that the service kept answering. Run a health check loop during the change, not only one check after it finishes, so a drop is caught while the next step can still be stopped.

Example: "During the rolling replace, a loop called the health endpoint every two seconds on each node and recorded a 200 response throughout; the change continued only while the loop stayed green."
