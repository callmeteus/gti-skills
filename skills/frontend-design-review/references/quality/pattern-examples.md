# Pattern examples

Good and bad examples of the work this skill produces. Imitate the good ones; the bad ones are the mistakes agents make most often.

## Review findings

**Bad:**

> The page looks a bit off and the colors could be better. Consider improving accessibility.

No evidence, no severity, no fix, and no criterion.

**Good:**

> **Major, Quality craft.** `BillingForm.tsx:48` sets `color: #6366F1` and `gap: 14px`. The system has `--color-primary` and `--space-3` (12px). Replace both; the hardcoded color does not switch in dark mode.

> **Blocking, Quality craft (accessibility).** The "Remove card" icon button in `CardRow.tsx:22` has no accessible name. Fails WCAG 2.1 1.1.1 and 4.1.2 (Level A), so screen reader users cannot tell what the button does. Add `aria-label="Remove card"`.

> **Major, Trustworthy.** The payment error toast says "Something went wrong". Say what failed and what to do: "Your card was declined. Try another card or contact your bank."

## Action hierarchy

**Bad:** a settings page with "Save", "Save and continue", and "Apply" as three filled primary buttons.

**Good:** one filled "Save changes" button, "Cancel" as a secondary button, and "Reset to defaults" moved into an overflow menu.

## Design system exceptions

**Bad:** a new `FancyDropdown` component that copies the system `Select` and changes its radius and shadow.

**Good:** the system `Select` with its `size="lg"` variant; or, when no variant fits, a comment next to the custom component that says why, which design ticket tracks it, and a line in the report.

## Creative direction

**Bad:** "Modern and clean", with Inter, a purple-to-blue gradient hero, three rounded feature cards with emoji icons, and a fade-in on every element.

**Good:** "Editorial, for a print studio that sells to designers": a serif display face over a quiet sans body, paper and ink tones with one vermilion accent, an asymmetric grid where the hero image breaks the column, a grain overlay as the only texture, and one staggered reveal on load.

## Unslop handoff

**Bad:** running every Unslop Interface pass on a maximalist build and flattening it back to a neutral dashboard look.

**Good:** running the inventory, removing the glow on every card and the hype copy that the direction did not choose, and listing the grain overlay and the display serif as intentional.
