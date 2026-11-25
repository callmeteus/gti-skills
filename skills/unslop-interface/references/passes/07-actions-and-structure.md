# Pass 7: Actions and structure

## Goal

Each view has one obvious thing to do. Lists show what the user compares and one action per item; forms, options, and actions that belong to one item or one state appear only where and when they apply. Every action stays reachable: this pass moves actions, it does not remove them.

## Before and after

These come from an auction page built by an agent, not from the source clip.

| Element | Before | After |
|---------|--------|-------|
| Item cards in a grid | Each card holds a bid field, a filled "Place bid" button, an auto-bid field, an outlined "Turn on auto-bid" button, and a "Cancel auto-bid" link | Each card shows the title, current bid, leader, and one "Place a bid" button that opens a modal with the bid form |
| Auto-bid | A second form in every card | A toggle inside the bid modal: "Bid automatically up to" with its field shown when the toggle is on |
| "Cancel auto-bid" | Shown on every card, with or without an active auto-bid | Shown only on a card whose auto-bid is active, next to the auto-bid status |
| Bid limits | One sentence: "Minimum bid: R$ 50,00 Maximum: R$ 1.000,00." | Label and value pairs in the modal, next to the field they constrain |
| Filled buttons | One large filled primary per card, three or more on one screen | None in the list; the filled primary is the confirm button inside the modal |
| Access notice | "This auction is for attendees with a confirmed ticket. Get a ticket" in a gray box inside every card | One notice under the section heading, with one "Get a ticket" link |
| Filters | A boxed panel of 11 underlined filter chips in four groups above 4 items, with "Online" in two groups and "Só participantes" repeating the sections | One row of selects (Modalidade, Pagamento, Estado), each starting at "Todos", with "Filtrar" and "Limpar"; no Público select, because the sections already split by audience |
| Tags in each card | "Presencial", "Online ou local", "Só participantes" as underlined links to the filters | The facts that differ, as plain text; the shared ones once in the section header |

These come from admin screens built by an agent (SMS destinations, routes, and messages).

| Element | Before | After |
|---------|--------|-------|
| Creating an item | A "Novo destino" card always open under the list, with "Criar destino" at its bottom | One "+ Novo destino" primary button at the right of the page title that opens the form in a dialog or drawer |
| An empty list | A table with only its header row (NOME, CANAL, DRIVER, STATUS) and nothing under it | An empty state: "Nenhum destino SMS ainda", one line on what a destination does, and the same "+ Novo destino" button |
| Form layout | Labels beside their fields, so "Nome", "Canal", and "Config JSON" push each field to a different start | Labels above the fields, one column, every field on the same left edge, Cancel and the create button at the bottom |
| Fixed choices | "Driver" and "Canal" as free text boxes holding "Twilio" and "SMS" | Selects (or radio buttons for two or three values) that list the drivers and channels the system supports |
| Provider settings | A "Config JSON" text box holding `{"account_sid":"","allowed_from":[...]}` | "Account SID" and "Allowed senders" (a list of phone numbers) as their own labeled fields, with help text |
| Context switcher | An unlabeled select showing "Even7" with one option, next to the page title | Nothing while there is one event; with more, a labeled "Evento" switcher in the navigation |
| Refresh | An "Atualizar" button next to the title | Removed: the list reloads after each change. A quiet icon button with a tooltip only when data changes from outside |
| Page names | Eyebrow "MENSAGENS", title "Mensagens SMS", card title "Mensagens" | Title "Mensagens SMS" alone; the one card on the page has no title of its own |

These come from a task detail page in an admin panel (a queued agent run).

| Element | Before | After |
|---------|--------|-------|
| Page header | Title on its own line, then a row under it with "ao vivo", "Atualizar", a filled "Concluir", and a red "Cancelar" | One row: title on the left; on the right the "Ao vivo" indicator, a refresh icon button, and one "Ações" menu |
| Status actions | "Concluir" and "Cancelar" as two large buttons | Items of the "Ações" menu, with "Cancelar" last, set apart, in the danger color |
| Refresh note | "Atualização automática por eventos do painel e a cada 5 segundos." at the bottom of the page | The tooltip of "Ao vivo", with the last update time |
| Output panels | A "Resultado" card waiting and an "Atualizações da tarefa" card with "Nenhuma atualização", stacked | One panel with two tabs, "Atualizações 0" and "Resultado", showing one waiting state |
| Facts | Agent and runner named in the "Execução" card and again in the "Integrações" card, and the runner a third time in the status card | Each fact once, in one card; the two cards merged |
| Long values | "paseo-pentest-coordin..." and "288f2fd2d2f41b..." cut with no way to read them | Values under their labels with room to fit; a long ID cut in the middle with a tooltip and a copy button |
| Status | "Na fila" badge, "Aguardando um runner livre" text, and a three-step stepper all saying the same thing | The badge and one line; the stepper only once the run has more than one step to show |

## Steps

1. Count the primary actions on the view. Keep one filled primary for the main task, two at most. Repeated actions on list items become secondary (outline or plain) buttons; actions used rarely move into an overflow menu or the item's detail.
2. Take forms out of list items. A list or grid item shows the facts the user compares and one action. Its form opens in a modal, a sheet, or the detail page for the item the user picked. This follows the creation-in-a-modal rule for new items.
3. Fold advanced options into the main form. Auto-bid, recurrence, scheduling, and similar options sit behind a toggle or a disclosure inside the one form, not as a second form next to it.
4. Show state actions only in their state. "Cancel auto-bid" appears only while auto-bid is on, "Retry" only after a failure, "Undo" only after the action. Do not show a disabled control for a state the user is not in unless it explains how to reach that state.
5. Show facts as data. Limits, prices, dates, and counts are label and value pairs, aligned like a small table, not sentences with values buried inside.
6. Keep each action next to what it acts on. A field's limits sit by the field; an item's action sits in the item, at the same place in every item.
7. Say shared facts once, above the list. When every item carries the same notice ("This auction is for attendees with a confirmed ticket. Get a ticket") or repeats a fact the section heading already gives ("Attendees only", "Online or local"), state it once for the section: one notice with its one link, and the shared facts in the section header. Each item keeps only what differs: its title, its own facts, its value, and its action.
8. Make filters compact. Filters are one row of selects, one per facet, each with a short label above it and "All" (`Todos`) as the first option, plus one apply button when the selects do not apply on change and a quiet "Clear" text button. This row is fine even on a short list. Replace a panel of chips, toggles, or underlined links with that row; do not box it, do not give each facet its own card, and do not grow it into a grid. Put it in the page header band or directly above the first list, aligned to the content column. When the list grows long, a search field may join the row.
9. Remove duplicate filters. Each filter splits the list along one idea, once. Two groups that both talk about the same thing ("Online" under Modalidade, "Pagamento online" and "Online ou local" under Pagamento) become one facet or lose the repeated option. A filter for a split the page already makes with its sections (a "Só participantes" chip above a section "Leilão exclusivo para participantes") is removed: the sections already filter.
10. Take filter links out of list items. Tags inside each card that link to the filter options ("Presencial", "Online ou local" as links) repeat the filter bar in every item. Show the item's facts as plain text or a quiet chip with no link and no underline; filtering belongs to the one control above the list.
11. Start creation from a button. A page that lists things (destinations, routes, templates, users) has one primary "+ New <item>" button (plus icon and the item name) at the right of the page title. It opens the form in a dialog or drawer, or in its own page when the form is long. Never leave a "New <item>" card open under the list; the list is the page, and the form appears when the user asks for it.
12. Give every list an empty state. When a list or table has no rows, do not show the header row over nothing. Show one line that names what is missing ("No SMS templates yet", "Nenhum template SMS ainda"), one line on what it is for, and the same "+ New <item>" button. A search or filter with no results says so and offers "Clear filters". Show the table again when the first row exists.
13. Make forms readable. Put each label above its field, with help text under the field and the required ones marked. Use one column; put two fields side by side only when they are short and belong together (city and state). Size each field to its expected value. A fixed set of values is a select, or radio buttons for two or three values, never free text. A secret is a password field with a reveal button, and on edit it says "leave blank to keep the current value". Settings are one labeled field each, never a raw JSON box; keep a JSON editor only behind an "Advanced" disclosure, with validation. Cancel and the primary button sit at the bottom, aligned with the fields, and the primary names the action ("Create destination").
14. Make every control say what it is. Each select and input has a visible label, or a select names its facet in its first option ("All channels"). A select with one option is not a choice: show the value as text, or nothing. A switcher for the current account, event, or workspace lives in the navigation with a label ("Event: Even7"), never as an unlabeled box next to the page title. Remove a "Refresh" button when the list reloads after each change; keep a quiet icon button with a tooltip only when the data changes from outside.
15. Name the page once. The eyebrow, the page title, and the card titles do not repeat each other ("MENSAGENS" over "Mensagens SMS" over a card "Mensagens"). The page title names the page. A card that is the only content of the page has no title of its own, or one that adds information. Keep an eyebrow only when it names a parent area that the title and the navigation do not.
16. Ask of every element whether it helps the user understand, decide, or finish the job, and remove it when it only fills space. Remove before you add: a quieter screen with fewer parts beats a restyled crowded one.
17. Use a centered modal for a short, focused form, not a side panel that is mostly empty. A side panel fits a long form or a detail the user reads next to the list.
18. Use cards only when grouping means something. Do not cut every block into identical rounded cards with the same shadow; sections, dividers, and space group content without a box.
19. Give long lists a stopping point: pagination or a "Load more" button, with the total count, instead of an endless scroll on a page people work in.
20. Make the page header one row. The title sits on the left; its status ("Live", "Queued"), a refresh icon button, and the item's actions sit on the right of the same row, centered on the title's line. Metadata such as the ID goes under the title in small muted text. Do not stack status and buttons in a second row under the title while the title row is empty on the right.
21. Group status actions in one menu. Two or more actions that change the item's status (complete, cancel, archive, approve, reject, delete) go into one "Actions" menu button at the right of the title. The destructive one is last, set apart, in the danger color, and asks for confirmation or offers undo. Keep a separate button only for the one next step most people take.
22. Put explanations of behavior in a tooltip. A note on how the page refreshes or what a status means ("Updates on every change and every 5 seconds") is the tooltip of the indicator it explains, never a line at the bottom of the page.
23. Turn stacked views of one output into tabs. Panels that show different views of the same item's output (result, updates, log, history, comments) become tabs of one panel, with a count on each tab and the tab that has content open first. Several empty boxes stacked down the page are one empty state in one tab.
24. Show each fact once. The same value (an agent, a runner, a repository) in two cards means the cards overlap: keep it in the card that owns it and merge cards that hold the same facts. Say the status once too: a badge, a sentence, and a stepper that all say "queued" are one badge and one line.
25. Let values fit. Put a long value under its label instead of beside it, or give the column room. When a value must be cut (a long ID), cut the middle, show the full value in a tooltip, and add a copy button. Hide a field with no value instead of showing a dash as a placeholder.
26. When the app runs, measure it: `node <skill-dir>/scripts/lintapple/probe.mjs <url>` reports `repeated-form` (fields inside the items of one list), `competing-primaries` (more than two filled, saturated buttons in the first viewport), `repeated-item-text` (text every item repeats), `filters-outweigh-items` (more filter chips or links than items; a row of selects does not count), `duplicate-filter` (the same idea in two filter groups, or a filter that repeats the sections), `filter-link-in-item` (links in items that repeat the filter options), `empty-list-without-message` (a table with only its header row), `open-create-form` (a creation form always open on a page that lists the items), `ragged-form-labels` (labels beside their fields, so the fields start at different edges), `raw-json-field` (raw JSON typed into a text box), and `unexplained-control` (a select or input with no label, or a select with one option). `repeated-heading` also reports an eyebrow that repeats the title. On detail pages it also reports `status-actions-apart`, `header-controls-below-title`, `behavior-footnote`, `repeated-value`, `stacked-output-panels`, `truncated-without-tooltip`. These findings are fixed, not explained.

## Check

- One filled primary per view, two at most, and the probe reports no `competing-primaries`.
- No list or grid item carries a form; the probe reports no `repeated-form`.
- Every action that was on the screen before is still reachable, now from the place it belongs.
- No action is shown in a state where it cannot apply.
- Limits and values read as label and value pairs.
- No notice or fact repeats in every item; the probe reports no `repeated-item-text`.
- Filters are one compact row of selects, not a panel of chips or links; the probe reports no `filters-outweigh-items`.
- No filter repeats another filter or the sections, and no item carries filter links; the probe reports no `duplicate-filter` or `filter-link-in-item`.
- Creation starts from one "+ New <item>" button in the page header, and no create form is open on the page; the probe reports no `open-create-form`.
- Every list has an empty state with the create button; the probe reports no `empty-list-without-message`.
- Labels sit above their fields, fixed choices are selects, and settings are fields, not JSON; the probe reports no `ragged-form-labels` or `raw-json-field`.
- Every control has a label and every select has a choice; the probe reports no `unexplained-control`.
- The eyebrow, page title, and card titles name different things.
- The page header is one row with the status, refresh, and actions on the right; status actions share one menu; the probe reports no `header-controls-below-title` or `status-actions-apart`.
- Behavior notes are tooltips, views of one output are tabs, each fact appears once, and long values can be read; the probe reports no `behavior-footnote`, `stacked-output-panels`, `repeated-value`, or `truncated-without-tooltip`.
