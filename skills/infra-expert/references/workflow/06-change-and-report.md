# Step 6: change the code safely and report

Start only after the user confirmed the plan from step 5. Read [../quality/safety.md](../quality/safety.md) first.

## Change the code

- Make the change exactly as agreed, following the repository's file layout, naming, and comment style. If the code shows part of the plan cannot work, stop and bring the new fact back as a question.
- Every change goes through code. You never change the cloud account, the state, or a Grafana instance directly.
- Use the declarative refactor blocks so the plan carries the state operations and the user's normal pipeline applies them:

  ```hcl
  moved {
    from = aws_instance.host
    to   = module.host.aws_instance.this
  }

  import {
    to = aws_security_group.web
    id = "sg-0abc1234def567890"
  }

  removed {
    from = aws_security_group.legacy
    lifecycle {
      destroy = false
    }
  }
  ```

  `moved` needs Terraform 1.1+, `import` blocks 1.5+, `removed` blocks 1.7+; check `required_version` first. Keep the blocks until every environment has applied them, then offer to delete them in a later change.
- Moving a root folder whose backend key is derived from its path changes the key. Do not move it unless the plan includes the state migration steps for the user to run.
- Make the companion updates the project rules require (inventories, catalogs, CI project lists, READMEs) in the same change.

## Verify

Run what the environment allows, without touching state:

1. `terraform fmt -check -recursive` on the changed folders.
2. `terraform init -backend=false` and `terraform validate` in each changed root and module.
3. The scanner again, to show the finding is gone (fewer copies, fewer hardcoded values).
4. A plan, only when the user allowed it and credentials exist, preferably through the repository's own CI plan job. The plan must show only what the candidate's risk allows: nothing for `code-only`; only moves, imports, and removals for `state-move`. Anything else is a bug in your change; fix it before reporting.

For Grafana changes, render or expand with the repository's own scripts and compare the output before and after; the generated rules and dashboards should differ only where agreed.

## Report the change

Tell the user what changed in a short message, in their language, following [../concepts/plain-language.md](../concepts/plain-language.md). Four parts, in this order:

1. **What is different now.** The effect, not the files: "A new host is now one call to `modules/vm-host`."
2. **Their example under the new layout.** Reuse a service, tenant, or resource the user named, and say what happens to it now and what stays as it was.
3. **What the user must run, and where it applies.** The exact commands or pipeline jobs, in order, with the expected plan summary for each stack ("idtfy: 0 to add, 0 to change, 0 to destroy, 5 moved"). Name the stacks and resources left out on purpose.
4. **What you did not verify, and why.** One sentence per check you could not run ("I did not run plan: no AWS credentials in this session").

Keep it to a few short paragraphs. Leave out the list of edited files unless asked; the diff has it.
