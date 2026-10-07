Program: <program-key, e.g. sandoz-tyruko-copay>
Story: <story id / title>

Follow docs/design-validation.md for all rules. Do the steps in order and stop after each one
for my OK.

STEP 1 - Fetch and store the Figma data (no code yet)
- Figma section link: <figma link with node-id>
- Fetch it with the Figma MCP get_figma_data tool (view token is set up) and save the raw dump
  to src/programs/<key>/design-validation/baseline/raw/section-<node-id>.<yyyy-mm-dd>.txt.
- Run npm run design:split -- <key> <raw file>, then npm run design:convert -- <key>.
- Pages must be stored in flow order (following the user path), body only (sidebar, header
  and footer excluded unless the story says otherwise). Show me the ordered page list from index.json so I can confirm the order.
- Baseline data is gitignored (public repo). Do not commit it.

STEP 2 - Write the design spec for the page(s) in this story
- Page(s): <exact Figma frame name(s) and states, e.g. default + mandatory-error>
- Live URL: <direct URL>  (quick access, if any: <steps>)
- Create a page object (locators only) and a fixture if needed, then
  src/programs/<key>/tests/design/<page>.design.spec.ts.
- Put the comment Figma "<frame name>" (node <id>) at the top of the spec.
- Reach the page once in beforeAll and share it across the tests (the QA host is slow).
- Take the expected values from the stored page JSON, not from guesses.
- Do not submit real enrollments from design specs.

RULES (global for every program and story; apply them without asking again):

Scope
- Body only by default: exclude the sidebar, header and footer. Each is developed and tested in
  its own story, not per page.
- Include the sidebar, header or footer only when the user story explicitly mentions it. If
  included, say so in the report scope. (Stored .json already has header/footer stripped; use
  the page's .txt file when the story needs them.)
- Check at the Figma frame size (1920x1080). Values are compared exactly there (within the
  tolerances below). Other breakpoints use normal responsive judgement.

Strict - must match Figma exactly, no tolerance
- Font family (type), font weight, font style, and every other font property.
- Text colour, border colour, background / fill colour.
- Line-height, compared in % (Figma stores it as em: 1.5em = 150%), not px.
- Letter-spacing, text-align, text-transform, text-decoration.
- Copy (text content).

Tolerances - the only ones allowed
- Font size: +/-2px (1 or 2px difference is accepted; 3px or more is an issue).
- Padding, margin and gap: +/-10px (accepted because a UI cannot always be built 100% to the
  mockup with the tech stack; 11px or more is an issue).

Everything else (border width / radius, element width / height, shadows, states)
- No agreed rule. Report any difference with its exact value and let me decide. Do not
  silently pass or fail it.

Reporting
- Report layout is fixed (see docs/design-validation.md, "Report format"): Differences beyond
  tolerance (# / Element / Property / Figma / Live / Difference), Differences within tolerance
  (Item / Figma / Live / Difference) and Checked values (Element / Property / Figma / Live /
  Difference). Never change these layouts.
- Specs must compare through checkExact / checkTolerance from
  src/shared/design-validation/designCheck.ts so those tables are filled automatically. Name
  the describe block "US-<story id>: <page>" so the report can be run by story id.
- Always state the exact difference (Figma, live, diff), whether it passes or fails.
- Never loosen a tolerance, change an expected value or skip a check to get a pass.

Other
- <br> tags that exist only to match a Figma line break are intentional; do not flag them
  unless the text wraps the same without them.
- Waived or changed rules for this program: <none / list>. Never skip a rule silently; if a
  rule seems wrong for this program, ask me once and write the decision down.
- Anything I did not specify and you cannot verify from the stored Figma data: list it under
  "Items to confirm with design" instead of guessing.

STEP 3 - Run and report
- Run: npm run design:report -- <key>  (runs the live design specs, then writes
  design-report/<key>-design-report.docx).
- If anything fails, list each failure with the exact difference and tell me whether it is a
  real UI defect or a spec/selector problem. Do not loosen tolerances to make it pass.
- Then add to the docx by hand: the per-element Figma-vs-live table, the within-tolerance
  differences, items to confirm with design, and how to reach the page quickly. Leave out
  developer-only material (commands, timings, internal notes).
- Re-read the final docx and remove anything unwanted before giving it to me.



With Rules:


