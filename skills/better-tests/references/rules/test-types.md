# Test types: cases, rules, and names

Each kind of test checks one thing and has its own list of cases. Find the type of each test in scope, list the cases for each public method or route before writing, then tick each case off against a named test. A case with no test is a gap, however green the suite is.

The examples use Vitest. The rules hold in any language: `describe` is the class or test module, `it` is the test function, `toEqual` is a deep equality assertion.

## One outcome high, every case where it is decided

The highest level proves the wiring: each outcome once. Every further case of a decision goes down to where the decision is made, usually a pure function. A route with three reasons for a 401 gets one 401 route test and three pure-function tests for the token check. This keeps the suite fast without coupling it to structure, because each test still enters through a public surface: the route, the service method, or the exported pure function.

## Pure functions

A pure function computes its output from its input alone: no I/O, no clock, no randomness, no state it changes. Most decisions belong in one (a branch, a calculation, a parse). Pass what would make it impure, the time or an ID, as an argument.

Rules:

1. Build the input, call the function once, compare the whole output: `expect(slugOf("Fix: plates!")).toEqual("fix-plates")`. Input and expected output are literals in the test.
2. One example per test. It differs from its neighbours in one visible way, and that difference is its name.
3. Test it directly, in its module's test file, not only through the class that calls it.

Cases, for each non-trivial function:

- **Every branch:** one example per path.
- **Every edge of a bound:** just inside, just outside, and exactly on it.
- **Empty and full input:** an empty string, list, or object, and one with every optional field set.
- **Values at a type's edge:** zero, a negative number, the longest allowed string, characters outside ASCII.

A one-line rename, getter, or pass-through needs no test of its own.

## Services

A service test builds the class with a fake for each dependency that leaves the process (a repository, a vendor client, the mailer), calls one public method, and checks what came back and what each fake now holds. Everything inside the process runs for real. See [dependencies.md](dependencies.md) for fakes.

Rules:

1. **Real inside, fakes at the edge.** Build the service with `new` in a `setup()` function in the test file, never from the app's container or singletons.
2. **Check state, not calls.** Assert the return value, then the state of each fake it changed (a row written, an email sent, a charge created), each compared whole. A call is asserted only for a port that changes the outside world, as the fake's recorded list. Never assert that a read happened, unless the read is the requirement (it costs money or counts against a rate limit), and then the test name says why.
3. **Time and IDs come in through the constructor.** The test fixes both and writes out the values they produce.
4. **Arrange through the service or the fake's rows.** Reach a state by calling the service's own methods, or by putting rows in the fake. Never read or set private fields.
5. **Fresh fakes per test.** Only constants are shared, so tests pass shuffled and alone.

Cases, for each public method:

- **Every outcome:** each kind of answer, with the writes and sends that go with it, including a call that changes nothing (an unknown ID, an order no longer pending).
- **Every dependency failing:** each fake that can throw, and what the caller gets, what was left written, and what was logged.
- **Repeats:** the same call twice (a duplicate webhook, a double click), and a call after one that failed halfway.
- **Time passing:** one example on each side of a time bound. The exact edges belong to the pure function that decides it.
- **Every setting it reads:** set and unset.

## Repositories: round trips

A round trip checks that a repository stores data faithfully: write an item, read it back through the same repository, compare the whole value. It tests storage, never behavior: filtering rules, state changes, and choices between cases belong in the service. Row mapping written in application code is a pure function with its own tests.

Rules:

1. Two to four lines: build the item, write it, read it back, `expect(await orders.byId(item.id)).toEqual(item)`.
2. Isolated data: each test writes items with keys of its own (its own ID, email, time window), so tests pass in any order on a shared database.
3. When the repository has an in-memory fake for service tests, the same round trips run against both (`describe.each([real, fake])`). A case the fake fails is a fake to fix, never a case to skip.
4. A lock is a storage guarantee: give each guarantee it makes one test, named for it ("two claims at once create one order"). Make the second change wait on the first with a promise or barrier, never a sleep.

Cases, for each method:

- **Every shape of a stored item:** nullable columns all filled and all null, an empty and a full JSON column, each enum value a later query reads.
- **Every way to read it back:** each key the repository looks items up by.
- **A missing item:** an unknown key returns `null` or an empty list.
- **Every edge of a query filter:** one item just inside each bound, one just outside, one exactly on it, and one per condition the filter rejects.
- **Every guarantee a lock makes:** the change sees what is stored, the change is written, and two changes at once apply one after the other.

## Routes and handlers

A route test is a black-box test of the whole app: the framework, real config, real services, the real database with the project's migrations. Only the outside world is replaced, by fakes the app reaches through the URLs in its environment (small HTTP servers in the test process, or an HTTP-level stub). A request goes in over HTTP; the test checks the answer and what each fake received.

Rules:

1. Start the app once per test file and close it after. Point its environment at the fakes, the way a deployment would.
2. Touch the app only over HTTP. An effect the app keeps to itself shows through a **follow-up request**: the order now reads as paid, the used token now gets a 403.
3. Write the request out in the test (method, path, headers, body). Helpers only arrange: put data in a fake, or reach a state through the app's own routes.
4. Isolated data: every test works on records of its own. A route that answers about everything (a batch job) gets a check that its own record is among the answers.
5. A setting the app reads once at start, tested unset, gets a test file of its own.
6. To move time, fake only the clock (`vi.useFakeTimers({ toFake: ["Date"] })`), so sockets and the database keep running.
7. Work the handler does after it answers: wait for its effect with a polling assertion (`vi.waitFor` with a short interval), never a fixed sleep.

Cases, for each route:

- **Every status code** it answers with, once. Further reasons for the same status are tested where they are decided.
- **Every outcome:** what each outside service receives, and what a follow-up request shows, including requests that change nothing.
- **An outside service down** (its fake answering 503), and what the caller gets.
- **Work after the answer:** its effect, and that a request it ignores sends nothing.
- **Time passing:** one example on each side, for an answer that depends on it.
- **Every setting the handler itself reads**, set and unset.

## UI and browser

User flows follow [user-flows.md](user-flows.md): one journey per critical flow, and what only a real browser proves. Formatting and state logic go down to pure functions; rendering and interaction stay in component tests.

## Assertions

- **One assertion per thing checked,** in the order a reader asks: what came back, then each effect. A failure then names the one thing that broke. Keep unrelated values out of one shared array.
- **Compare the whole value** (`toEqual` on the whole response body, row, or list), not a few picked fields.
- **Write out every value the test can know:** an error message, a URL built from an ID it has, a time it set.
- **Match a value it cannot know by its shape:** a UUID pattern for a generated ID, `expect.stringMatching(/^[0-9a-f]{64}$/)` for a 32-byte hex token. A shape fails on an empty string, a wrong format, or a value in the wrong field; `expect.any(String)` passes them all.

## Names

Read only the `describe` and `it` lines: they should list every method or route and every case of each.

| Type | `describe` | `it` |
|------|------------|------|
| Pure function | The function: `slugOf` | The example input: `"a title that ends in punctuation"` |
| Service | The class, then the method: `OrderService` > `placeOrder` | The example: `"payments down"`, `"an unknown customer"` |
| Repository | The class, then the round trip: `OrderRepository` > `order round trip` | The item: `"an order with every optional field empty"` |
| Route | Method and path: `POST /api/orders` | Status first: `"401: no bearer token"`, `"409: an order paid twice"` |

## Speed budgets

Each type has a per-test budget, measured as described in [../quality/speed.md](../quality/speed.md):

| Type | Budget per test |
|------|-----------------|
| Pure function | 5 ms |
| Service on fakes | 5 ms |
| Service on a real database or subprocess | 50 ms, and a candidate to move onto fakes |
| Repository round trip | 50 ms |
| Route | 100 ms |
| Browser flow | No fixed budget; keep them few |
