# Design validation (Figma vs live UI)

How we check that a live portal page matches its Figma mockup. This is a third kind of
check, separate from the e2e suites and from the screenshot framework.

| Kind | Question it answers | Where | Run with |
| --- | --- | --- | --- |
| **e2e** | Does the business flow work? | `src/programs/<key>/tests/e2e/*.e2e.spec.ts` | `npm test` |
| **design** | Does the page look like the Figma mockup? | `src/programs/<key>/tests/design/*.design.spec.ts` | `npm run test:design` |
| **screenshots** | What does each state look like at each resolution? | `src/programs/<key>/screenshots/` | `npm run screenshots:<key>:<resolution>` |

e2e and design specs are separate Playwright projects (`<key>-e2e`, `<key>-design`, see
`playwright.config.ts`), so a slow live-page design check never runs as part of `npm test`.
Design specs may use the same fixtures and page objects as e2e specs; they never add a
second set of locators.

## Rules (apply to every program and every story)

- **Body only by default.** Compare the page body. **Sidebar, header and footer are excluded**:
  they are built and validated in their own stories, not per page. Include one of them only when
  the user story (Azure Boards) explicitly says to; state in the report that it was in scope.
  The converter strips header and footer from the stored `.json`; when a story includes them,
  read the page's `.txt` file (untouched) instead. Sidebar is not stripped by the converter, so
  ignore it in the `.json` unless the story includes it.
- **Strict properties (must match Figma exactly, no tolerance):**
  - font family (type), font weight, font style, colour, line-height (in %), letter-spacing,
    text-align / transform / decoration, and any other font property;
  - border colour;
  - background / fill colour, and the copy (text content).
  Other properties (border width / radius, gap, element width / height, shadows, states) have
  no agreed rule yet; until one is agreed, report any difference with its exact value and
  let the story owner decide.
- **Tolerances (the only ones allowed):**
  - font size: **±2px** (1 or 2px difference accepted, 3px or more is an issue);
  - padding and margin: **±10px** (accepted because a UI cannot always be built 100% to the
    mockup with the tech stack; 11px or more is an issue).
- Always state the exact difference when reporting a mismatch, whether it passes or fails.
- **Exact at the frame size.** At the Figma frame size (1920 × 1080) values are compared
  exactly (within the tolerances above). Other breakpoints use normal responsive judgement.
- **Line-height in %.** Figma stores line-height in `em` (`1.5em` = 150%). Compare in %, not px.
- **`<br>` tags** that exist only to match a Figma line break are intentional; do not flag them
  for removal unless the text wraps the same without them.
- To waive or change a rule for one program, agree it once when that program's first story
  starts and write it down for that program. Never skip a rule silently.

## Stored Figma data

Figma access is not always available, so the mockup data is fetched ahead of the stories and
stored locally. **The repo is public**, so this data (mockup copy, colours, layout) is
gitignored: `src/programs/*/design-validation/baseline/` and `design-report/` are never
committed. Every person/machine fetches its own copy.

```
src/programs/<key>/design-validation/baseline/
  raw/section-<node-id>.<date>.txt        the untouched Figma dump for one section
  pages/
    _shared-definitions.txt               shared styles, fills and element templates
    index.json                            every page, in flow order: figmaName, nodeId, file, json
    flow-NN/<step>-<name>.<node-id>.txt   one Figma frame as text
    flow-NN/<step>-<name>.<node-id>.json  the same frame, resolved, body only (use this one)
```

- `flow-NN` is the leading integer of the Figma frame name (`05.10 …` is flow 05, step 10);
  pages are ordered by step number. Frames with the same name are kept; the node id in the
  file name tells them apart.
- The `.json` has every element's resolved font, size, weight, line-height, colour, padding,
  gap, width and text inline, so no lookup is needed. Header and footer instances are removed
  (`"excludes": ["header","footer"]`).
- Figma line-height stays as stored (`1.5em`); convert to % when comparing.

### Fetching and storing a section

1. Get the Figma link (`…?node-id=<a>-<b>`) for the section.
2. Fetch it with the Figma MCP `get_figma_data` tool (`fileKey` from the URL, `nodeId` as
   `<a>:<b>`). A whole section is large (hundreds of KB), so the tool saves it to a file and
   returns the path. Copy that file to `baseline/raw/section-<a>-<b>.<yyyy-mm-dd>.txt`.
3. Split and convert:

   ```bash
   npm run design:split -- <program-key> section-<a>-<b>.<yyyy-mm-dd>.txt
   npm run design:convert -- <program-key>
   ```

   The scripts are `src/shared/design-validation/split-baseline.mjs` and
   `convert-baseline.mjs`. They hold no program knowledge; the program key only picks the folder.
4. Re-running either script regenerates the files; the raw dump is never modified.

Notes: the `claude_ai` Figma `get_metadata` / `get_design_context` tools need edit access to
the file; `get_figma_data` works with a view token. Check that a Figma file really belongs to
the program you think it does.

## Writing a design check for a story

1. **Reach the page quickly** against the live site (see "Quick access" below). Do not walk the
   whole enrollment flow if a direct route works.
2. **Write the spec** in `src/programs/<key>/tests/design/<page>.design.spec.ts`:
   - add a page object in `pages/` (locators only) and a fixture in `fixtures/index.ts`, as for
     any other page;
   - reach the page **once** in `beforeAll` and share it across the tests (the QA host is slow);
   - read values with `getComputedStyle` / `boundingBox` and assert within the tolerances; make
     failure messages state expected, actual and the difference (see `expectWithin` in
     `transition-success.design.spec.ts`);
   - compare line-height in %.
3. **Compare** against the stored page JSON. Two ways, both recorded through `designCheck.ts`:
   - **Figma-driven (preferred, every new spec):** load the frame with `loadFigmaFrame` and
     compare each element with `compareText` / `compareBox` from
     `src/shared/design-validation/liveCompare.ts` (helpers in `figmaBaseline.ts`). Expected
     values then come from the stored JSON, nothing is typed by hand, and every property of every
     element is checked. Search the frame under the page content node (e.g. `Form Fields`) so the
     sidebar, header and footer stay out. Reference: `summit-ivonescimab`
     `us-280439-patient-information.design.spec.ts` (default and mandatory-error frames).
   - **Hand-typed:** expected values copied from the JSON into the spec (the older
     `transition-success.design.spec.ts`), with a comment naming the Figma frame and node id.
4. **Report** (below).

### Quick access to pages

| Program / page | How |
| --- | --- |
| Tyruko, Patient Transition **Success** | Landing → "Apply to the Patient Transition Program" → Next, then browse to `…/sandoz/tyrukocopay/upload-documents-success/` (`TransitionSuccessPage.gotoDirect()`) |
| Summit (Bivtuo), pharmacy **Patient Information** | Open `https://portal-pr.trialcard.com/86064/pharmacy/patient-information/` directly. Click Submit on the empty form for the mandatory-error state |

### Live-site behaviour to know

- The QA host can take 40–50 s to render a page. Use generous timeouts for the first load.
- `load` never fires on the Tyruko success page (third-party scripts); navigate with
  `waitUntil: 'domcontentloaded'` and wait for the heading.
- Design specs run against live QA/PR environments. Do not submit real enrollments from them;
  empty-form validation clicks are fine.

## Report for a story

Closing a story needs a short report. Use a Word file (`.docx`) in `design-report/`
(gitignored). Keep it to what the reader needs:

1. Details table: program, page and state, live URL, Figma frame name and node id, resolution,
   scope (body only), date.
2. Result sentence, the tolerances, and the verdict.
3. **Differences beyond tolerance** (element, property, Figma, live, difference).
4. **Differences within tolerance**, with the exact difference.
5. Short list of what was verified as matching.
6. Items to confirm with design, and anything not checked.
7. How to reach the page quickly.

Leave out developer-only material (test commands, timings, internal notes).

### Generating the report

```bash
npm run design:report -- <program-key>             # runs <key>-design against the live site, then writes the docx
npm run design:report -- <program-key> -- --no-run # rebuilds the docx from the last saved run
npm run design:report -- <program-key> --story=<id>  # only specs whose describe title starts "US-<id>"; report tagged with the story
```

Output: `design-report/<program-key>-design-report.docx`, plus the raw Playwright JSON
(`<program-key>-design-results.json`) next to it. The script is
`src/shared/design-validation/design-report.mjs`; it has no program knowledge.

#### Report format (fixed, same for every program and story)

The docx has these sections, in this order and layout. Do not change the layouts.

| Section | Columns |
| --- | --- |
| Details | Item / Detail (program, user story, Figma frame(s), live URL, resolution, scope, date, automated checks) |
| Result | One verdict sentence and the agreed tolerances |
| Differences beyond tolerance | # / Element / Property / Figma / Live / Difference (`None.` if empty) |
| Differences within tolerance | Item / Figma / Live / Difference (`None.` if empty) |
| Other failed checks | Check / Detail (only when a check failed without a recorded value, e.g. a timeout or copy mismatch) |
| Checked values | Element / Property / Figma / Live / Difference; the element name appears once, on its first row |

The tables are built from values the spec records, so every design spec **must** compare through
the shared helpers in `src/shared/design-validation/designCheck.ts`, not bare `expect`:

- `checkExact(element, property, figma, live)` for strict properties (colour, font family,
  weight, line-height %, alignment, ...). A mismatch is beyond tolerance (`Does not match`).
- `checkTolerance(element, property, figma, live, tolerance)` for font size, padding, margin,
  gap and widths. The difference is shown signed (`+4px`); `0` is a match; within the tolerance
  it is listed under *Differences within tolerance* (and in *Checked values*); more than the
  tolerance is *beyond*.
- Use the same Figma-style display values (`#001C4A`, `Bold (700)`, `100%`, `centre`) for both sides.
- Keep the `Figma "<name>" (node <id>)` comment in the spec; the report reads it. Spec describe
  titles should start with `US-<id>:` so `--story=<id>` can select them.
- `transition-success.design.spec.ts` is the reference.

**Grouping.** In *Differences beyond tolerance* and *Differences within tolerance*, the same
difference on several elements (same kind of element, property, Figma value, live value and
difference) is one row, e.g. `Field - required asterisk, 9 of 10 - Default and Errors states`
followed by the field names. *Checked values* stays one row per element and property. This relies
on the element-name convention: `(<State>) <Kind> "<Name>" - <part>`.

Still added by hand: items to confirm with design, "Verified as matching" notes, quick-access
steps.

## What exists today

| Program | Design specs | Stored Figma data |
| --- | --- | --- |
| `sandoz-tyruko-copay` | `transition-success.design.spec.ts` (Patient Transition Success, 8 checks, all pass) | Section `8344-56576`, 94 pages in flows 01–10 |
| `summit-ivonescimab` | `us-280439-patient-information.design.spec.ts` (Figma-driven, default + mandatory-error states, report: `npm run design:report -- summit-ivonescimab --story=280439`); `patient-info-visual-styling.design.spec.ts` (older generic CSS ranges, not Figma-driven, not part of any story run) | Section `1001-5183`, 86 pages in flows 01–07 |
| `apotex-evdi` | none | none |

Reports done so far: Tyruko Patient Transition Success (live matches Figma; open items:
paragraph break, disclaimer text colour, second button width) and Summit pharmacy Patient
Information default + error states (5 differences beyond tolerance: sidebar background, active
nav colour, nav font weight, inactive nav line-height, asterisk colour).

## Naming

`summit-ivonescimab` is **Summit Therapeutics Bivtuo**: Bivtuo is the brand, ivonescimab the
drug. The Summit Figma file ("VAL- IVONESCIMAB") therefore names its frames "Bivtuo"; that is
expected, not a mix-up.

## Open points

- **No automatic comparison yet.** The stored JSON is not read by any code; expected values are
  copied into specs by hand. A shared script that loads a page's JSON, reads live styles and
  writes the report would remove that step.
- Several differences found on Summit (sidebar, nav, asterisk colour) sit in shared components;
  check the other Summit pages before logging them per page.
