# Setup

How to get this repo running on a new machine. For what each command does afterwards, see
[commands.md](commands.md); for how the repo is organised, see the root [README.md](../README.md)
and [CLAUDE.md](../CLAUDE.md).

## 1. Prerequisites

| Need | Notes |
| --- | --- |
| Git | To clone the repo. |
| Node.js + npm | A current LTS release. The repo was developed on Node 24. There is no `engines` field in `package.json`. |
| Network access | Every run goes to the shared QA/PR hosts under `https://portal-qa.trialcard.com/` and `https://portal-pr.trialcard.com/`. Check that your network or VPN can reach them. |
| Microsoft Word (optional) | Only to open the design-report `.docx` files. |
| Figma access token (optional) | Only to fetch new Figma data for design checks (see [section 6](#6-figma-access-design-checks-only)). Running existing specs does not need it. |

## 2. Install

```bash
git clone <repo-url>
cd Playwright_Automation
npm install
npx playwright install        # downloads the browsers Playwright drives
```

`npm install` also sets up the Git hooks in `.husky/` (`pre-commit`, `commit-msg`), so commit
messages are checked by commitlint.

## 3. Configure the environment

Each program reads its own base URL from its own `.env` file, namespaced so two programs never
collide:

| Program | Variable | Default if unset |
| --- | --- | --- |
| `apotex-evdi` | `APOTEX_EVDI_BASE_URL` | `https://portal-qa.trialcard.com/apotex/evdi/` |
| `summit-ivonescimab` | `SUMMIT_IVONESCIMAB_BASE_URL` | `https://portal-qa.trialcard.com/summit/ivonescimab/` |
| `sandoz-tyruko-copay` | `SANDOZ_TYRUKO_COPAY_BASE_URL` | `https://portal-qa.trialcard.com/sandoz/tyrukocopay/` |

The files are optional: with no `.env`, every program falls back to the QA URL above. To point a
program at another environment, create `src/programs/<program-key>/.env`:

```
SUMMIT_IVONESCIMAB_BASE_URL=https://portal-qa.trialcard.com/summit/ivonescimab/
```

`.env` files are gitignored. The URL must keep its program sub-path and trailing slash; the page
objects call `page.goto('')`, which relies on it.

## 4. Check that it works

```bash
npx playwright test --list                 # lists every spec; no browser or network needed
npm run test:summit-ivonescimab            # one program's e2e suite against the live host
npm run test:headed                        # every e2e suite with a visible browser
npm run report                             # open the last HTML report
```

> The e2e specs and screenshot scripts make **real submissions** on the shared host (enrollment
> records, uploaded documents). Design specs only open pages and read styles; they click Submit
> only on an empty form to trigger validation.

## 5. The three kinds of checks

| Kind | Run with |
| --- | --- |
| e2e (does the flow work) | `npm test`, or `npm run test:<program>` |
| design (does the page match Figma) | `npm run test:design`, or `npm run test:<program>:design` |
| screenshots (what does each state look like) | `npm run screenshots:<program>:<resolution>` |

Program keys: `apotex-evdi`, `summit-ivonescimab`, `sandoz-tyruko-copay`. Screenshot resolutions:
`xlDesktop`, `lDesktop`, `desktop`, `lTablet`, `pTablet`, `xsMobile`, and `all`. Screenshot
output goes to `screenshots/<program-key>/<timestamp>/` (gitignored).

## 6. Figma access (design checks only)

The Figma mockup data is **not in the repo**: the repo is public, so
`src/programs/*/design-validation/baseline/` and `design-report/` are gitignored. Each person
fetches their own copy. Without it, existing design specs cannot load their expected values.

1. Get access to the program's Figma file (for example "VAL- IVONESCIMAB" for Summit) and a Figma
   personal access token.
2. Configure a Figma MCP server that provides `get_figma_data` in your own MCP client (it is not
   configured in the repo: `.mcp.json` only holds the Playwright MCP server), using that token.
3. Fetch the section, save the raw dump under `baseline/raw/`, then split and convert it:

   ```bash
   npm run design:split -- <program-key> <raw-file-name>
   npm run design:convert -- <program-key>
   ```

4. Run a story's design spec and build its report:

   ```bash
   npm run design:report -- <program-key> --story=<id>
   ```

   The report is written to `design-report/<program-key>-US-<id>-design-report.docx`.

The full procedure, rules and tolerances are in [design-validation.md](design-validation.md).

## 7. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Tests hang or time out on the first page load | The QA/PR host can take 40-50 s to render a page. Re-run, and check your network or VPN. |
| `page.goto` lands on a different site | The base URL lost its program sub-path or trailing slash. Check the `.env` value. |
| A design spec fails before opening the page | The Figma baseline for that program is missing. Fetch it (section 6). |
| `design:report` saves a file ending in `-HHMM.docx` | The previous report was open in Word. Close it, or use the new copy. |
| HCP enrollment e2e fails intermittently | A known, escalated live-app defect (see the comment in `hcp-enrollment.e2e.spec.ts`); the suite retries it 5 times. |
| `npm run lint` or `npm run build` not found | There is no lint, build or typecheck script yet. Use `npx tsc --noEmit -p .` to typecheck. |

## 8. Adding another program

Follow [onboarding-new-program.md](onboarding-new-program.md): pick a `PROGRAM_KEY` and a
namespaced `.env` variable, scaffold the program folder, register it in `playwright.config.ts` and
`package.json`, and confirm no other program regresses.
