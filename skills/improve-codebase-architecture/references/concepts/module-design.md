# Module design principles

The principles that decide whether a refactor is worth proposing. Write about them in the words from [plain-language.md](plain-language.md).

## What a module is

Anything with a public API and code behind it: a function, a class, a file, a package, or a feature slice that spans several folders. The size does not matter.

## Small API, lots of logic inside

A module pulls its weight when callers learn a little and get a lot done:

```text
  Good                              Thin wrapper (avoid)
  +-------------------------+       +---------------------------------+
  | small API               |       | big API: many methods, options  |
  +-------------------------+       +---------------------------------+
  |                         |       | little code: forwards the call  |
  | lots of logic inside    |       +---------------------------------+
  |                         |
  +-------------------------+
```

When reviewing or designing a public API, ask:

- Can there be fewer functions or methods?
- Can the parameters be simpler, or have defaults?
- Can more of the work move inside so callers stop doing it?

## Principles

- **The API is what callers must know, not just the type signature.** Required call order, config, error cases, and performance traps all count as API.
- **The merge test.** Imagine inlining the module into its callers. If nothing gets repeated, it was a pass-through and can go. If the same code would appear in many callers, it is earning its place.
- **Tests call the public API.** Callers and tests use the same entry points. If a test needs to reach inside, the module has the wrong shape.
- **One implementation is not a reason to add an interface.** Add an injection point only when at least two implementations exist, usually the real one and a test fake. One implementation behind an interface is only indirection.
- **Internals can still be small and testable.** A module with a small API may be built from small private parts with their own tests. Do not expose those parts in the public API just because tests use them.

## Designing for tests

1. **Pass dependencies in; do not create them inside.**

   ```typescript
   // Easy to test
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results instead of mutating shared state.**

   ```typescript
   // Easy to test
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Keep the API small.** Fewer functions mean fewer tests; fewer parameters mean simpler test setup.

## Ideas this skill does not use

- **Counting lines of code inside versus lines of API.** It rewards padding. Judge by how much callers get per thing they must learn.
- **"API" meaning only the exported types.** It misses config, ordering, and error behavior that callers also depend on.
