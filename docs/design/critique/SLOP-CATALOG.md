# Slop catalogue

These are defect classes that separate a reference product from a competent one. Sweep every screen for
each class. The list is a floor, not a ceiling: log anything else you find too.

## Layout and rhythm

- Spacing values are off the scale, or the same relationship is spaced differently on two screens.
- Baselines are misaligned between icons, labels and values in one row. Text is optically off-centre in
  a control.
- Large areas are dead, for example half a screen empty while content is cramped elsewhere. Content
  floats in a centred column for no reason.
- Card or tile heights are uneven in one row. Borders double where two containers meet.
- Gutters are inconsistent between panels. A panel edge does not line up with the toolbar above it.

## Typography

- Too many sizes or weights on one screen. Weight is used where size or colour should carry the
  hierarchy.
- Monospace is used for prose or labels, or proportional type for values that must align.
- ALL-CAPS labels are overused, with inconsistent letter-spacing.
- Text is truncated with no tooltip and no way to see the full value. A placeholder is cut off inside
  its own field.
- Title, sentence and code casing are mixed for the same kind of label.

## Colour and depth

- "Rainbow" icons: decorative colour carries no meaning.
- A semantic colour is used for decoration, for example green that is not "live".
- A destructive action is visually equal to, or louder than, the primary action.
- There are too many surface levels, or depth cues that contradict each other (shadow plus border plus
  fill).
- Contrast is below WCAG AA for text that carries information.

## Components

- Two widgets do the same job (two tab styles, two empty-state patterns, two search fields).
- Controls are hand-rolled where the system has the component, so sizes, radii and focus rings drift.
- Icon families are mixed, or stroke widths and sizes are inconsistent. Some icons are missing in a
  row of icons.
- Buttons in one group differ in height.

## Content and voice

- Placeholders such as "—", "N/A" or "— threads" ship as content.
- Jargon or internal names are exposed to users (store ids, internal flags, raw enum values).
- The same thing is named differently in two places (Device/Phone, Target/App, Replay/Recording).
- Copy is redundant: the same status is shown in two or three places at once.
- An error message does not say what to do next.

## States and honesty

- An empty state blames nothing and offers nothing. A loading state does not say what it is waiting
  for.
- A stale value shows no age or source. "Live" is claimed when the data may be paused.
- Nothing is visible to tell the user why a control is disabled.
- A sensitive value (IP address, serial number, token) is shown by default where it is not needed.

## Interaction

- An action exists only on hover or right-click with no other path.
- The palette, menus and buttons offer different verbs for the same action.
- Focus order or focus ring is missing. Escape and Enter behave differently from one dialog to another.
- No feedback after a slow action, or a toast arrives before the result is known.
