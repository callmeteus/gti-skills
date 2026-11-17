# Project rules, inventories, and decision records

Infrastructure repositories usually carry rules that matter more than the code: who may apply, which inventory must change with each resource, which systems are read-only. Read them first and follow them over this skill whenever they are stricter.

## What to read

| File | Why |
|------|-----|
| `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `CONTRIBUTING.md` | Apply policy, forbidden actions, required updates. A rule such as "apply only through the pipeline" or "update the inventory in the same change" binds every candidate and step 6 |
| `README.md` files in the stacks | The intended layout, which often differs from the real one; the difference is a finding |
| Inventories and catalogs (`inventory.md`, `services/*.json`, CMDB exports) | What is supposed to exist; compare with the scans |
| `GLOSSARY.md` | Product, tenant, and environment names to use in the report |
| `docs/adr/` | Decisions not to reopen without a strong reason |
| CI workflows | How plans and applies actually run; the verification path for step 6 |

## Hand-maintained inventories

When the repository keeps an inventory by hand next to code that already describes the same resources, the two drift. Note it as a candidate only when the drift is real (entries missing on either side, frequent edits in git history). The usual fix is to generate the inventory from the code or the cloud, not to delete it.

## Decision records (ADR)

Files in `docs/adr/` named `0001-slug.md`, `0002-slug.md`; take the highest number and add one.

```md
# {Short title of the decision}

{One to three sentences: the context, the decision, and why.}
```

Offer to write one only when the decision is hard to reverse, surprising to a future reader, and a real trade-off. Typical infrastructure cases: where state boundaries fall, why a resource stays outside code, why two environments differ on purpose, which repository owns a shared resource, a rejected consolidation (for example "tenant stacks stay separate for blast radius").

When the user rejects a candidate for such a reason, offer: "Want me to record this as an ADR so future reviews don't suggest it again?"

## Glossary

Update or create `GLOSSARY.md` only when a name is settled during the conversation (a base's name, a tenant naming rule). One or two sentences per term, with `_Avoid_:` listing the alternatives.
