# Project glossary and decision records

Two optional files guide the review: `GLOSSARY.md` names the business concepts, and decision records in `docs/adr/` record choices the review must not reopen without a strong reason. Read them before exploring. Create or update them only when a decision is made during the conversation.

## Where they live

Most repositories have one context:

```text
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If `GLOSSARY-MAP.md` exists at the root, the repository has several contexts, each with its own `GLOSSARY.md` and optional `docs/adr/`. Read the map to find the one for the area under review; ask when it is unclear.

Create files only when there is something to write.

## GLOSSARY.md

```md
# {Context name}

{One or two sentences: what this part of the system is.}

## Language

**Order**:
A customer's request to buy one or more products.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request
```

- **Pick one word per concept** and list the alternatives under `_Avoid_`.
- **One or two sentences per term.** Say what it is, not how the code implements it.
- **Only business concepts of this project.** General programming terms do not belong.
- **Update it when a term is settled** during the conversation, not later in a batch. If the user names a new module after a concept the glossary does not have, add the term.
- **Call out conflicts.** When the user or the code uses a term differently from the glossary, say so and ask which is right.

## Decision records (ADR)

Files in `docs/adr/` numbered `0001-slug.md`, `0002-slug.md`; take the highest number and add one.

```md
# {Short title of the decision}

{One to three sentences: the context, the decision, and why.}
```

Add `Status`, `Considered options`, or `Consequences` sections only when they carry real information.

Offer to write one only when all three hold:

1. **Hard to reverse:** changing it later is expensive.
2. **Surprising:** a future reader would ask why it was done this way.
3. **A real trade-off:** there were real alternatives and one was chosen for specific reasons.

Typical cases: overall architecture shape, how two parts of the system talk to each other, technology choices with lock-in, ownership of data, deliberate deviations from the obvious approach, constraints not visible in the code, and rejected alternatives whose rejection is not obvious.

When the user rejects a candidate for such a reason, offer: "Want me to record this as an ADR so future reviews don't suggest it again?"
