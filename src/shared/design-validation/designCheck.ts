import { expect, test } from '@playwright/test';

// Figma-vs-live comparison helpers shared by every program's design specs.
// Each call records one row on the running test (as an annotation), so
// `npm run design:report` can print the "Checked values", "Differences within
// tolerance" and "Differences beyond tolerance" tables. No program knowledge here.

export type DesignCheckStatus = 'match' | 'within' | 'beyond';

export interface DesignCheck {
  element: string; // e.g. 'Heading "Thank you!"'
  property: string; // e.g. 'Font size'
  figma: string;
  live: string;
  difference: string; // '0', '0.2px (within tolerance)', '-12px', 'Does not match'
  status: DesignCheckStatus;
}

export const DESIGN_CHECK = 'design-check';

function record(check: DesignCheck): void {
  test.info().annotations.push({ type: DESIGN_CHECK, description: JSON.stringify(check) });
  // Soft, so one run lists every difference instead of stopping at the first.
  expect
    .soft(check.status !== 'beyond', `${check.element} - ${check.property}: Figma ${check.figma}, live ${check.live} (${check.difference})`)
    .toBe(true);
}

/** Strict property (colour, font, copy, ...): live must equal Figma exactly. */
export function checkExact(element: string, property: string, figma: string | number, live: string | number): void {
  const same = String(figma) === String(live);
  record({
    element,
    property,
    figma: String(figma),
    live: String(live),
    difference: same ? '0' : 'Does not match',
    status: same ? 'match' : 'beyond',
  });
}

/** Numeric property with an agreed tolerance (font size, padding, margin, gap). */
export function checkTolerance(
  element: string,
  property: string,
  figma: number,
  live: number,
  tolerance: number,
  unit = 'px',
): void {
  const diff = Math.round((live - figma) * 10) / 10;
  const abs = Math.abs(diff);
  const shown = `${diff > 0 ? '+' : ''}${diff}${unit}`;
  record({
    element,
    property,
    figma: `${figma}${unit}`,
    live: `${live}${unit}`,
    difference: abs === 0 ? '0' : abs <= tolerance ? `${shown} (within tolerance)` : shown,
    status: abs === 0 ? 'match' : abs <= tolerance ? 'within' : 'beyond',
  });
}
