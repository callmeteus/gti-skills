# 04: Respond to an exposed credential

## Build the rotation checklist

Read the `Rotation checklist` section of `history.md`. It groups secrets by credential type and names a provider page for each type. Keep the redacted identifier and hash with each item so the user can match it to their own records without you printing the credential.

| Type | Provider page |
|------|---------------|
| stripe | https://dashboard.stripe.com/apikeys |
| anthropic | https://console.anthropic.com/settings/keys |
| openai | https://platform.openai.com/api-keys |
| aws | https://console.aws.amazon.com/iam/home#/security_credentials |
| github | https://github.com/settings/tokens |
| slack | https://api.slack.com/apps |
| google | https://console.cloud.google.com/apis/credentials |
| private-key | https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys |
| url-password | Change the password on the service named in the connection URL |

Order the checklist by exposure, not by alphabetical type: critical exfiltration first, then secret exposure, then hidden instructions. Put the provider page next to each item and add the location where the credential appeared.

## Describe the rotation steps, do not perform them

Rotation is gated. Even when the user asks you to respond, prepare the steps as pending actions; do not sign in to a provider, revoke a key, change a password, or edit a secret store.

For each credential, the safe order is:

1. Revoke or disable the exposed credential at its provider page.
2. Issue a replacement and store it in the project's secret manager or dotenv file, not in chat or a committed file.
3. Update every service that consumes it, using the locations from the grouped findings.
4. Confirm the old credential no longer works and the new one does.
5. Remove the exposed value from the working tree and from any uncommitted file.

If a private key was exposed, rotate the keypair at its issuer and replace every authorized key or deploy key that references it. If a connection URL contained a password, change that password on the service itself.

## Purge from git history only with explicit permission

A credential in a commit stays in the repository after the file is deleted. Rewrite history only when the user explicitly asks for it in this request, never in autonomous mode.

Describe the commands; do not run them. Never force push. State that a rewrite changes every commit hash after the first affected commit and that collaborators must re-clone or rebase.

The standard shape, to be written into the report as a proposal, is:

```text
git filter-repo --path .env --invert-paths
git filter-repo --path path/to/secret-file --invert-paths
```

If the credential is inline in a tracked source file rather than in a dotenv file, a path based rewrite is not enough; the value must be replaced in the file content across all commits. Say that plainly instead of offering a partial fix.

After any approved rewrite, the user should ask every holder of a clone to refresh, and should treat the credential as compromised regardless of the rewrite. A rewrite removes copies; it does not un-revoke or un-leak a key.

## Finish the report

List every pending action in one block: rotations, history rewrite, hidden instruction removal, and any skipped source that could hold more occurrences. State what you did not verify, for example whether a credential is still active at its provider. Do not mark the incident closed.
