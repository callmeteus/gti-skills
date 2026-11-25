# Pass 5: Typography and copy

## Goal

Text that informs instead of shouting: calm weights, sentence case, numbers with context, and headers that say something.

## Before and after in the source

| Element | Before | After |
|---------|--------|-------|
| Product name | `EmberAI` with a `PRO` tag | `Ember` |
| Page title | `Welcome back, Damir!` with a waving hand, bold | `October 2026`, regular weight, year in a muted color |
| Search placeholder | `Search anything...` | `Search` |
| Section labels | `NAVIGATION`, `PLANS` in tracked caps, with an emoji | `Navigation`, `Plans` in a small muted monospace |
| Card titles | `PAID THIS MONTH`, `REVENUE` in tracked caps, with an emoji | `Paid this month`, `Revenue` in sentence case |
| Big numbers | Heavy bold | Regular or medium weight, larger size |
| Trend line | `+12%!!` with a fire emoji | `+12% vs last month`, number in green, comparison muted, monospace |
| Trend line | `+4.2% this month!!` with a rocket emoji | `4.2% ↑ vs September` |
| Overdue trend | `3 less` with an emoji | `3 fewer` (grammar fixed) |
| Nav counts | Red pill badge `12` | Plain muted `12` |
| Plan counts | Violet pills with a person icon (`18`, `1.2k`) | Plain muted monospace numbers |
| Nav extras | `New` badge with a sparkle | Removed |

### Numbers that change

A second source, a clip by Nexvyn, shows a running timer `00:01.23` side by side. With the font's default proportional digits, each digit has its own width, so the timer box changes width as it counts and the text shifts (the clip measures it at 173.7px wide, moved 29.9px). With `font-variant-numeric: tabular-nums`, every digit has the same width: the box is 186.7px wide and moved 0.0px.

```css
.timer {
  font-variant-numeric: tabular-nums;
}
```

In Tailwind, the same rule is the `tabular-nums` class. The Emil Kowalski clip shows the same rule as a proportional and a `tabular-nums` version of `1:12.20`.

### Leading and ligatures

The Emil Kowalski clip also shows a paragraph at a line height of `1.20`, marked "Too tight": the lines crowd each other, and the eye hunts for the next one. Too much leading has the opposite fault, and the paragraph falls apart into separate lines. The same clip shows ligatures (`fi`, `fl` in "fine office flow") switched off and on, and notes that some ligatures are decorative and belong in display use only.

## Steps

1. Use at most two families: the existing UI font, plus a monospace for numbers, metadata, and section labels if it suits the product. Do not introduce a display font.
2. Limit weights to regular and medium (or semibold for one level). Make large numbers large, not heavy.
3. Convert all-caps labels to sentence case. Keep caps only for real abbreviations.
4. Remove exclamation marks and emoji from labels, numbers, and status lines. Only visible UI text counts: `!=`, `!important`, and other code are not exclamation marks, a button labeled "New" is an action and not a badge, and a timestamp such as "Jan 3 · 14:02" is metadata and not a status pill.
5. Give every change value a reference: `vs last month`, `vs September`, `since Monday`. Color only the value, not the sentence.
6. Replace greeting or filler headers with the most useful fact for the page, such as the period the data covers.
7. Do not give every page a tagline. A subtitle or one-line description under the page title belongs only on pages where it tells the user something the title and content do not, such as a landing hero or an empty state. On app screens (dashboards, settings, lists, detail views) remove taglines that restate the title or sell the feature (`Settings` / `Manage your account settings`), and never add one that the source did not have. The title alone is enough.
8. Do not narrate the interface. Helper text that explains what the controls on the screen do, how the feature works inside, or what it is not reads like a spec pasted into the UI: `A team shares the MCP, its key, the agent, and the runner with the people on the list. It is not organization-wide sharing.` Cut it. When the page needs a line, say what the user gains, in one short sentence: `Share resources across your team.` Rules, limits, and edge cases go in the docs or a tooltip on the control they concern, not in a paragraph on the page. The same goes for captions under the steps of a stepper or timeline (`Queued` / `Task registered in the panel`, `Running` / `Runner assigned to the job`): the step name is enough; a caption stays only when it carries data, such as the time the step happened.
9. Say each thing once. A page title, a section heading, a subtitle, and a tag under them must each add something new. `Leilões` over `Leilão exclusivo para participantes`, then `Só para quem tem ingresso confirmado`, then a `Só participantes` tag says "auction" twice and "attendees only" three times. Keep one heading (`Leilões`), one line with the condition (`Só para quem tem ingresso confirmado no Furzuê 2027.`), and tags only for facts the line does not state. Never stack two headings with the same text or the same key word. `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports these as `repeated-heading`. The same holds for status and values: a `Done` badge, a line under it that says `The task finished successfully.`, and a stepper with every step checked say one thing three times; keep the badge, and show the stepper only while the work is in progress. One value under two labels (`Source ref: master` and `Branch: master`) is shown once, or the second label appears only when its value differs.
10. Underline only links inside running text. Chips, tags, and buttons read as controls from their border or fill; an underline on them doubles the signal and looks unfinished. Metadata (mode, payment, audience, state) is plain text or a quiet chip, not a row of underlined links; make a tag a link only when it opens something useful, and style it as a chip. The probe reports both as `underlined-control`.
11. Turn decorative badges into plain text when they only show a count. Keep a badge only when it signals state the user must act on.
12. Remove hype words, "AI" suffixes, and tags that are not features. Fix grammar ("fewer", not "less", for countable items).
13. Use tabular figures (`font-variant-numeric: tabular-nums`, Tailwind `tabular-nums`) for numbers that change in place (timers, counters, prices, live stats, progress percentages, animated count-ups) and for numbers that line up in columns. Proportional digits make a changing number wobble and a column of numbers misalign. Apply it to the number element, not to the whole page, so running text keeps its proportional figures. A monospace number font already has equal digit widths.
14. Give paragraphs more leading than headings. Body text set as tight as a heading (around `1.2`) is cramped; loosen it, and stop before the lines drift apart. Keep line height as a token, not a value per element.
15. Keep decorative or discretionary ligatures for display text such as a hero title. Body and UI text use the font's standard ligatures only.
16. Balance line breaks. A heading or short label that wraps must not leave one word alone on its last line. Set `text-wrap: balance` on headings and short labels and `text-wrap: pretty` on paragraphs; never insert manual `<br>` for it. The probe reports these as `lonely-word`.
17. Use real typography marks. An ellipsis is `…`, not three dots; loading labels end with it ("Saving…", "Loading…"). Keep a unit with its number and a shortcut with its key using a non-breaking space (`10&nbsp;MB`, `⌘&nbsp;K`). Format dates, times, and money with the locale (`Intl.DateTimeFormat`, `Intl.NumberFormat`), not hand-built strings.
18. Write plain sentences. AI copy is hard to read for measurable reasons; fix each one. Break stacked nouns ("account permission settings panel" becomes "permissions for this account"). Give human verbs to people, not to things ("The dashboard wants to know your goal" becomes "What is your goal?"). Keep the subject next to its verb and the sentence short. Prefer common words over rare phrasing. Use the active voice and second person, give counts as numerals ("8 deployments"), name buttons for what they do ("Save API key", not "Continue"), and make every error say what to do next.
19. Drop the generated-page chrome. Set each heading in one color and style: no single word in another color, italic, or gradient (`accent-word`). Remove the arrow at the end of button and link text (`arrow-suffix`). Use numbered markers (01, 02, 03) only for real sequences such as steps or a timeline. Do not join metadata with middle dots by default (`A · B · C`); use separate labeled values or one plain sentence.
20. Name each action by what happens, and keep the name through the flow. "Save changes", not "Submit"; a "Publish" button produces a "Published" toast; one operation is never "delete" in one place and "remove" in another. Name things by what users manage ("Notifications"), not by how the system is built ("Webhook config").
21. Write errors and empty states as directions. An error says what happened and how to fix it, without apologizing and without vague text ("Something went wrong"). An empty screen invites the first action. Each label, help text, and message does one job.
22. Write every empty state with one pattern. Pick one and use it across the product: "No <things>" ("Nenhum resultado", "Nenhuma atualização"), the same punctuation (none on a one-line message), and no narration of who would have done it or when ("publicada pelo agente ainda", "registrado"). Do not mix "Sem resultado registrado." with "Nenhuma atualização publicada pelo agente ainda." on one page. Add a second line only to say what to do next. Give loading ("Carregando…") and error messages one pattern each too. The probe reports `inconsistent-empty-copy` when the empty states on a page use different openings, punctuation, or lengths.
23. Show labels, not codes. An enum value from the API (`private`, `offline`, `stdio`, `queued`) is mapped to a label in the UI language (`Privado`, `Offline`, `Local`, `Na fila`) in one shared map, and an emoji is rendered as the emoji, never as its shortcode (`:fox_face:`).

## Check

- No exclamation marks, emoji, or tracked caps remain in the UI copy.
- No heading accents one word, and no button or link ends with an arrow; the probe reports no `accent-word` or `arrow-suffix`.
- Every action keeps one name through the flow, and errors say how to recover.
- Every empty state follows one pattern ("Nenhum resultado", "Nenhuma atualização"); the probe reports no `inconsistent-empty-copy`.
- No heading or short label leaves one word alone on its last line (no `lonely-word`).
- Copy uses `…`, locale formats, and short active sentences with no stacked nouns.
- Every trend value says what it is compared to.
- The page title tells the user something they did not already know.
- No page carries a tagline that only restates its title or sells the feature.
- No heading, subtitle, or tag repeats a heading above it, and the probe reports no `repeated-heading`.
- No text on the page explains what the controls do or how the feature works inside, and no stepper caption only restates its step.
- No status or value is said twice on one screen, under the same label or a different one.
- No chip, tag, or button underlines its text, and metadata is not a row of underlined links (no `underlined-control`).
- No number that updates in place shifts sideways while it changes.
- Paragraphs read without cramped or floating lines, and no decorative ligatures appear in body text.
- No raw enum value or emoji shortcode appears as text.
