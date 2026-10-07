import { Page, Locator } from '@playwright/test';

// Shared low-level helpers for this portal's Vuetify forms. Every form page
// (patient, HCP, pharmacy) renders the same field components, so the quirks
// are handled once here instead of in each page object.

// Vuetify combobox fields (gender, state) render a second, hidden
// `<input type="hidden" name="...">` proxy sharing the same `name`; excluding
// hidden inputs leaves the single interactive element (confirmed live,
// 2026-10-05) and avoids Playwright strict-mode violations.
export function inputByName(page: Page, name: string): Locator {
  return page.locator(`input[name="${name}"]:not([type="hidden"])`);
}

// Checkboxes and radios are click targets through their visible label: a
// Vuetify ripple overlay intercepts pointer events on the input itself.
export function labelFor(page: Page, inputId: string): Locator {
  return page.locator(`label[for="${inputId}"]`);
}

export async function selectComboboxOption(page: Page, fieldName: string, optionName: string): Promise<void> {
  await inputByName(page, fieldName).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

// The State list is virtualized (20 options initially rendered) and not
// filterable by typing, and its option text is UPPERCASE ("NEW YORK"), so match
// case-insensitively and scroll the listbox until the option mounts.
export async function selectStateOption(page: Page, fieldName: string, stateName: string): Promise<void> {
  await inputByName(page, fieldName).click();
  const listbox = page.getByRole('listbox');
  const option = page.getByRole('option', { name: new RegExp(`^${stateName}$`, 'i') });
  for (let attempt = 0; attempt < 20 && (await option.count()) === 0; attempt++) {
    await listbox.hover();
    await page.mouse.wheel(0, 300);
  }
  await option.click();
}

// Today's date as the site's masked MM/DD/YYYY format (signature date fields
// are read-only and pre-filled by the site with this value).
export function todayMmDdYyyy(): string {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${today.getFullYear()}`;
}
