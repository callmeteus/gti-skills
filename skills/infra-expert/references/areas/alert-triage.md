# Alert triage and hygiene

An alert stream is data to interpret, not a queue of identical incidents. Check the rule that produced each signal, correlate a burst into its shared cause, and emit one notification per state change. Read this file at Operate step 3, before changing a threshold or silencing a rule; it changes nothing on a system.

## Trust the definition before the alert

- Require a measured value, a threshold, a window and a source in every alert. An alert that shows only a bare comparison, or an empty entity tag or rule identifier, is low confidence: name the missing fields and validate the generated identifier before attributing it. An empty slug still produces a routable-looking rule, and generated names are part of the routing path, not cosmetic text.
- State the evaluation window before comparing peaks or counting repeats, and size deduplication to that window. The same rule can fire each minute on a short HTTP window and every fifteen minutes on an I/O window, so repeats without a window look like distinct failures.
- Use stable rule identifiers as the dedupe key, never a volatile instance ID or address. A rule titled with a changing address looks like many different alerts over time and breaks both deduplication and trend analysis.
- An alert that fires and clears by itself, or a family that resolves in lockstep, is a measurement or state-write defect first. Check the metric and the alerting path, for example a gauge overwritten at every scrape or a counter read as a new increment, before treating the signal as noise.
- Never raise a threshold or mute a rule to make a true alert stop. Fix the emitting cause, then record the rule change and the reason for it.

## Correlate before you page

- Treat a burst of no-data alerts across unrelated services as one monitoring incident and check ingestion first. Independent services do not lose their metrics together.
- Group target-health flapping into one deduped, low-priority notification and require a sustained window before escalating. Group the CPU, memory, load and I/O alerts of one stateful service into a single saturation pattern, with the measured numbers.
- Read failures at many independent services or tenants at once as a shared edge or control-plane change. Check that path and its own signal before the services behind it; a downstream health check cannot confirm the shared path.
- On an error-rate alert, read the per-route breakdown before hosts or instances. Separate client-error spikes from server-error spikes: a count-based 4xx spike is a business-input anomaly, a percentage 5xx spike is an outage signal, and they belong on different paths.
- A queue that outgrows one worker's buffer is a lag incident with an owner and a consumer-capacity decision, not a generic capacity alert. Requests arriving on an address instead of a service name are a routing or abuse signal, not a health failure.

## Read state, not chat

- Count incidents from the alert store, never from the chat log. A resolve-only stream cannot give an incident count.
- A "still active" or "opened since" marker means unresolved even when the channel goes quiet. A bulk wave of resolutions in one minute is a bulk state write, not many independent recoveries. Look for that write before declaring several fixes.
- Emit one notification per state change, not one per lifecycle event. Route subscriber and status-page traffic out of the operational channel so it does not dwarf actionable alerts. Keep one thread for active coordination and route new problems and questions to triage.
- After a rule or threshold changes, query the same signal the alert uses and check the expected measured value, window and source before calling the alert healthy.
