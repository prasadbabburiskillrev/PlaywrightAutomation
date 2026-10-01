# Onboarding a New Program

A "program" in this repo is one similar site (e.g. a pharma co-pay/enrollment
portal) living entirely under `src/programs/<program-key>/`. This guide is a
generalized, step-by-step procedure for onboarding a new one, using the
Summit Ivonescimab ("BIVTUO With You") onboarding as the worked example
throughout — see
[docs/superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md](superpowers/specs/2026-09-23-summit-ivonescimab-onboarding-design.md)
and
[docs/superpowers/plans/2026-09-23-summit-ivonescimab-onboarding.md](superpowers/plans/2026-09-23-summit-ivonescimab-onboarding.md)
for the full detail behind each step below.

## Before you start: research the live site

Don't assume the new program's site works like the existing one(s) — verify.
For Summit Ivonescimab, live research (via a real browser, not guesswork)
found:

- The role/action model was structurally different from Apotex's (3 roles ×
  multiple actions each, vs. Apotex's 2 roles × 1 action) — this surfaced
  *before* any code was written, letting the round's scope be decided
  upfront (see "Decompose oversized scope" below) instead of discovered
  mid-implementation.
- The Patient Information form's field `name` attributes, the Gender
  dropdown's options, the State dropdown's virtualization behavior, and the
  route-transition spinner's CSS class were all confirmed **identical** to
  Apotex's, via direct DOM/CSS inspection (`document.querySelectorAll(...)`,
  `document.styleSheets` inspection) — not assumed from similar-looking
  screenshots. This is what let `PatientInformationPage.ts` and
  `dropdownExpander.ts` be ported near-verbatim instead of rewritten.

Do this research with a real browser tool before writing the design spec —
guessing at selectors from a rendered screenshot is how untested, silently-
wrong page objects get built.

## Decompose oversized scope

If the new program has a materially richer flow than existing ones (more
roles, more actions, more form steps), do not try to build full parity in
one round. Summit Ivonescimab has 3 roles with multiple actions each; this
onboarding scoped down to exactly one flow (Patient → Enroll in Co-pay
Assistance) as the first, provable slice, with the rest tracked as explicit,
well-scoped follow-up — not built speculatively, and not silently dropped
either.

## What to do when the live site itself blocks you

Sometimes the blocker isn't your code, your design, or your test data — it's
a real bug in the environment you're testing against. During this
onboarding, filling out Summit's Patient Information page with fully valid
data and clicking "Next" reproducibly failed with a client-side JS error and
no network request firing at all (confirmed via `browser_network_requests`)
— on the *live QA host itself*, not anything this repo controls.

When this happens:
1. **Reproduce it at least twice**, ideally with different data, to rule out
   a data-shape issue on your end.
2. **Check for a network request** — if a submission click doesn't even
   attempt a request, that's a client-side bug, not a server-side rejection;
   if it does fire a request, check the response for what was actually
   rejected.
3. **Scope this round's build down to what's actually reachable** — don't
   write page objects or tests against a page you were blocked from ever
   seeing. Guessed selectors on unverified DOM are worse than not having the
   page object at all: they look done, pass a naive read-through, and fail
   silently or confusingly the moment someone tries to use them.
4. **Document the blocker as explicit follow-up**, with what you tried and
   what you saw, so the next person doesn't have to re-discover it from
   scratch.

## Step-by-step procedure

1. **Research the live site** (see above) before writing anything.
2. **Write a design spec** (`docs/superpowers/specs/YYYY-MM-DD-<program>-onboarding-design.md`)
   covering: the new program's role/action model, its eligibility
   questions, its form fields (and how they compare to existing programs'),
   what's confirmed vs. still unverified, and this round's explicit scope
   (what's built now vs. deferred).
3. **Pick the program key and namespaced env var upfront**:
   - `PROGRAM_KEY` = the exact folder name you're about to create under
     `src/programs/` (e.g. `summit-ivonescimab`). This is what isolates the
     new program's screenshot output — get it right from the start rather
     than fixing a collision later.
   - `<PROGRAM_KEY_UPPER>_BASE_URL` = the namespaced `.env` variable (e.g.
     `SUMMIT_IVONESCIMAB_BASE_URL`). Never a bare `BASE_URL` — every
     program's `.env` gets loaded into the same process
     (`playwright.config.ts` calls `dotenv.config()` once per program), so
     an unnamespaced var would silently collide.
4. **Scaffold `src/programs/<program-key>/`**: `pages/`, `testdata/types.ts`,
   `fixtures/index.ts`, `utils/DataGenerator.ts`, `utils/deviceBrowsers.ts`
   (with its own `PROGRAM_NAME`/`PROGRAM_KEY`/`SPINNER_SELECTOR`),
   `utils/index.ts`, `config/index.ts`, `tests/`. Port page objects
   near-verbatim wherever live research confirmed identical selectors/
   behavior; rewrite (don't locator-tweak) wherever the structure is
   actually different.
5. **Wire it into shared config**: add another `dotenv.config(...)` call
   and a `projects[]` entry in `playwright.config.ts` (the pattern and its
   own onboarding comment already anticipate this); add
   `test:<program-key>` to `package.json`.
6. **Write tests and run them live** — TDD against the real site, not
   assumptions. Every fact this guide's worked example used (question order,
   error message text, heading text, field names) was pulled from actually
   running things against the live host, not inferred from visual
   similarity.
7. **Build the screenshot-framework equivalent**, mirroring whichever
   existing program's structure fits best (`screenshots/core/`,
   `screenshots/pages/`, `screenshots/runner/`), consuming
   `src/shared/screenshots-engine/` — never re-implement engine code
   per-program. Add `screenshots:<program-key>:<resolution>` scripts to
   `package.json` for every resolution.
8. **Verify the stateExpanded-style captures for dead space below the
   footer** (or any other popup that might inflate `fullPage` height) before
   assuming an existing program's `capHeightPx` values apply — they're tuned
   from that program's own measured page heights and do not transfer.
9. **Update `CLAUDE.md`**: Commands section, Screenshot-framework section,
   and the "Onboarding a new program" paragraph (this file may need edits
   too, if the process itself changed).
10. **Run the *other* program's full suite** (tests + at least one
    screenshot resolution) before committing, to confirm zero regression —
    shared engine code and renamed/shared npm scripts are exactly the kind
    of change that can silently break a sibling program.

## Follow-up checklist template

Copy this into your design spec's Non-Goals / the plan's final task, filled
in with your program's specifics:

- [ ] Additional roles not built this round: `<list>`
- [ ] Additional actions per role not built this round: `<list>`
- [ ] Pages not built this round, and why: `<list>`
- [ ] Tests not written this round, and why: `<list>`
- [ ] Any live-site blockers encountered, with reproduction steps, so a
      future retry doesn't start from zero.
