# Critic rubric

One scale for every reviewer and every reference product, so scores can be compared across rounds and
critics.

## Anchors (apply to each dimension)

| Score   | Meaning                                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3**   | Amateur. Defects are visible at a glance, the structure is confusing, and it looks like a template.                                                                                                |
| **5**   | It works, but it is generic. A professional finds several S1 defects in a minute.                                                                                                                  |
| **7**   | Competent. It is coherent, but a trained eye finds S1/S2 defects on most screens. Nothing makes it memorable.                                                                                      |
| **8.5** | Reference grade (VS Code, Claude Desktop). It is consistent and rare to fault, with a few S2 defects. You can recognise it by its craft alone.                                                     |
| **9.7** | Category-defining. Staff designers would cite it as the example. There are no S0 or S1 defects anywhere, and S2 defects are rare and deliberate. It does at least one thing the references cannot. |

Half points are allowed. Scores must be **justified by findings**. A dimension cannot score above 7
while it still has an open S1, or above 8.5 while it has more than three S2s.

## Dimensions

1. **Positioning and narrative:** is it obvious what this is, who it is for, and why it beats the
   alternative? Do the product, website and naming tell one story?
2. **Brand identity:** it should be distinctive, ownable and consistent, through its type, colour,
   iconography, voice and motion. Would someone recognise a cropped screenshot as this product?
3. **Information architecture:** check the rail, tabs and panels. Does the structure match the
   user's mental model and the jobs, and are any concepts duplicated or orphaned?
4. **Core flows:** time and steps for the key jobs, for developer and non-developer personas. How
   much dead-end, detour and guesswork is there?
5. **Visual craft:** grid, spacing rhythm, typographic scale, alignment, density, contrast and depth.
   Look for pixel-level defects.
6. **Component system fidelity:** is one coherent system used everywhere (Cladd/Bench)? Look for
   hand-rolled exceptions, mixed families and drift.
7. **States and honesty:** check empty, loading, error, offline, background, stale and permission
   states. Does the UI ever claim something it cannot know?
8. **Interaction quality:** keyboard, focus, discoverability, feedback, latency perception and motion.
9. **Density and data presentation:** tables, JSON, logs and charts. Is the signal-to-chrome ratio
   right for an expert tool?
10. **Differentiation:** the thing no reference product does. Is it real, visible and central?

The **overall** score is the mean of the ten dimensions. If any dimension is below 6, the overall is
capped at that dimension plus 2.

## Severity

| Level  | Meaning                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| **S0** | Broken or lying. The UI misleads, loses data, blocks the job, or shows a wrong state.                      |
| **S1** | Trust-breaking. An inconsistency or defect a non-professional would notice, or a flow that needs guessing. |
| **S2** | Polish. A trained eye notices it, and it degrades the perceived quality.                                   |
| **S3** | A nit. It is real but marginal.                                                                            |

## Evidence rules

- **Every finding cites evidence:** `screenshot-file @ region` (for example `panel-05-app.png @ x110–560,
y280–320`), `path/to/file.vue:123`, or a URL for external claims.
- **Every finding names one fix direction.** The fix is a direction, not a redesign essay.
- **Vague words are banned unless backed by a specific defect:** "clean", "modern", "sleek",
  "intuitive", "feels", "polished", "nice".
- **Score every dimension**, citing at least three findings or reference comparisons. Mark a dimension
  "not judgeable" if the evidence is insufficient.
- **Disagreeing with the brief is allowed and expected** when the evidence supports it. Say so plainly.
