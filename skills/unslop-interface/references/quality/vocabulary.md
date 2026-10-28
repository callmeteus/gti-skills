# Vocabulary

Precise terms get better results than vague ones, both when you describe a change in the report and when you hand work to another agent. "Set `tabular-nums` on the timer" is a fix; "make the numbers stop jumping" is a wish. Use these terms by name in the inventory and the report.

The terms and definitions come from a clip by Emil Kowalski that demos part of a 244-term vocabulary for [AI for UI](https://aiforui.dev/). Each term in the clip is shown with a toggle between the wrong and the right version.

## Terms the passes use

| Term | Meaning | Pass |
|------|---------|------|
| Affordance | The visual signal that tells you how something can be used. A button looks like a button; an external link has an external icon | 04 |
| Leading | The vertical space between lines of text (line height) | 05 |
| Ligature | Two characters merged into one glyph to avoid a collision, most often `fi` and `fl`. Some ligatures are decorative and belong in display use only | 05 |
| Tabular numbers | Fixed-width digits that keep numbers from jumping as they change | 05 |
| Sticky positioning | An element that sticks to the top of a scrollable container, such as a table header | 06 |

## Terms to name, not to add

This skill removes decoration and does not add motion or behavior. When the screen already has one of these, or the user asks about it, call it by its name in the report.

| Term | Meaning |
|------|---------|
| Debounce | A delay before firing a function that resets each time it is triggered. 300ms is a common threshold, for example on a search field that queries as you type |
| Transform origin | The anchor point a scale or rotation grows or spins from, for example from the center or from the bottom |
| Stagger | Several items animate one after another, each with a slightly bigger delay |
| Morph | One shape turns into another, like the Dynamic Island |
| Spatial consistency | Motion between two related views follows their spatial relationship: moving forward through a flow animates to the right, going back animates to the left |
