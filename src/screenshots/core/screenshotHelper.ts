import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface RunContext {
  programName: string;
  runTimestamp: string;
  deviceType: string;
  baseDir: string;
  pngDir: string;
  pdfDir: string;
  manifest: string[];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildRunTimestamp(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function createRunContext(programName: string, deviceType: string, runTimestamp: string): RunContext {
  const baseDir = path.join(process.cwd(), 'screenshots', programName, runTimestamp, deviceType);
  const pngDir = path.join(baseDir, 'PNG', 'all screenshots');
  const pdfDir = path.join(baseDir, 'PDF');
  fs.mkdirSync(pngDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });
  return { programName, runTimestamp, deviceType, baseDir, pngDir, pdfDir, manifest: [] };
}

let sequence = 0;

export function resetSequence(): void {
  sequence = 0;
}

function nextSequence(): string {
  sequence += 1;
  return pad(sequence);
}

// The app shows a global `.half-circle-spinner` overlay during every
// client-side route transition (confirmed live: fully removed from the DOM,
// not just hidden, once the transition settles). Capturing before it clears
// catches the outgoing page still on screen underneath the spinner instead
// of the new state - this was the root cause of every "wrong content"
// screenshot (eligibility/patientInformation/consent "default" states on
// both paths). `waitForLoadState('networkidle')` is not a reliable proxy for
// this: the spinner's lifecycle isn't tied to network completion, so it can
// still be visible after networkidle resolves, and can also disappear well
// before a 5s networkidle timeout elapses.
async function waitForAppToSettle(page: Page): Promise<void> {
  const spinner = page.locator('.half-circle-spinner').first();
  // Tolerate it never appearing at all (some transitions are instant) -
  // this first wait just avoids racing a spinner that hasn't shown up yet.
  await spinner.waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
  await spinner.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
}

export async function capture(page: Page, context: RunContext, descriptiveName: string): Promise<string> {
  await waitForAppToSettle(page);
  const fileName = `${nextSequence()}_${descriptiveName}.png`;
  const filePath = path.join(context.pngDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  context.manifest.push(filePath);
  return filePath;
}

export function pdfOutputPath(context: RunContext, dateStamp: string): string {
  return path.join(context.pdfDir, `${context.programName}_${context.deviceType}_${dateStamp}.pdf`);
}
