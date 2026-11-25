# Unslop report: <screen name>

## Inventory

- **Source:** <code files, screenshot, or both>
- **Existing tokens reused:** <spacing scale, radius, colors, font, icon set, or "none">
- **Tells found:** <short list from the slop tells checklist, per screen>

## Coverage

- **Screens:** <every route or view in scope, and whether each was inventoried from the rendered screen or from its template>
- **Rounds:** <how many full rounds of the eight passes ran, and the number the user asked for>

| Pass | Ran | Reason when skipped |
|------|-----|---------------------|
| 1. Spacing | | |
| 2. Corner radius | | |
| 3. Color and effects | | |
| 4. Icons and alignment | | |
| 5. Typography and copy | | |
| 6. Data display | | |
| 7. Actions and structure | | |
| 8. States and feel | | |

A pass is skipped only when the inventory found none of its tells; a number of passes in the request is a number of rounds, never a reason to skip passes 6 to 8.

## Passes

Write one block per pass that changed something. Passes with no tells are listed under Coverage, not here.

### 1. Spacing

- **Before:** <values or behavior>
- **After:** <the scale and the values used>
- **Files:** <files and lines changed, or "screenshot only">

### 2. Corner radius

- **Before:**
- **After:**
- **Files:**

### 3. Color and effects

- **Before:**
- **After:**
- **Files:**

### 4. Icons and alignment

- **Before:**
- **After:**
- **Files:**

### 5. Typography and copy

- **Before:**
- **After:**
- **Files:**

### 6. Data display and dashboards

- **Before:**
- **After:**
- **Files:**

### 7. Actions and structure

- **Before:**
- **After:**
- **Files:**

### 8. States and feel

- **Before:**
- **After:**
- **Files:**

## Measured checks (lintapple)

Skip only when the app could not run, even locally with a test user from the project's seed or fixtures; say what you tried.

| Rule | Before | After |
|------|-------:|------:|
| | | |

Policy: <file, and the fonts, scale, and spacing steps it uses>

## Tokens introduced

| Token | Value | Used for |
|-------|-------|----------|

## Suggestions (not applied)

Changes the user decides on, such as adopting an icon library. Write "None" when there are none.

| Suggestion | Why | What it would replace |
|------------|-----|-----------------------|
| <Use Lucide for every icon> | <12 hand-drawn SVGs with three stroke widths> | <`src/icons/*.svg`, inline SVGs in `Sidebar.tsx`> |

## Kept on purpose

- <A tell left in place and why, for example a brand gradient the user wants. Write "None" when every tell was fixed.>

## Not covered

- <Issues outside this skill, such as flows, conversion, or accessibility, worth a separate pass.>
