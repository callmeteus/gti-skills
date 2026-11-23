Tests that a bring-up request is carried through to a verified pipeline apply.
Rule bring-up: subir means commit, push, apply, wait, verify and update inventory, not stop at a commit.
The state checks prove the leaf is committed, the pipeline applied it and the health endpoint returns 200.
The transcript requires an apply and forbids ending on a commit or plan.
