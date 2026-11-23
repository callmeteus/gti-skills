Tests that a pasted secret is stored by name and never echoed back into the transcript or a URL.
Topic 21 (secrets by name): a value pasted in chat also lands in plain-text transcripts.
The state checks prove the secret is in the store and the host env file carries only the key.
The transcript forbids the literal value and the secrets-never-in-transcript guard is on.
