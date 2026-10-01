import { Page, Locator, expect } from '@playwright/test';

function genderField(page: Page) {
  return page.locator('input[name="gender"]:not([type="hidden"])');
}

function stateField(page: Page) {
  return page.locator('input[name="state"]:not([type="hidden"])');
}

// Click a combobox field and wait for its listbox to open, retrying the
// click once if it doesn't. Confirmed live (xsMobile/375px viewport): the
// very first click on a field, immediately after a *different* field's
// dropdown was closed via Escape, is sometimes swallowed - instead of
// opening this field's menu, the app runs whole-form validation (both
// fields flip to "Required") and no listbox ever appears. Reproduced
// consistently outside this framework too: an immediate second click on the
// same field then opens the menu normally, so this is most likely the
// just-closed overlay's own "click outside" handler racing the new click's
// pointerdown, rather than anything wrong with the field itself. This only
// matters for this screenshot flow's open-then-Escape-close preview pattern
// - the real enrollment flow (PatientInformationPage.fill/
// selectStateOption) always commits a combobox by clicking an option, never
// via Escape, so it never hits this race.
async function openListbox(page: Page, field: Locator): Promise<Locator> {
  const listbox = page.getByRole('listbox');
  await field.click();
  try {
    await expect(listbox).toBeVisible({ timeout: 3_000 });
  } catch {
    await field.click();
    await expect(listbox).toBeVisible();
  }
  return listbox;
}

export async function expandGenderDropdown(page: Page): Promise<void> {
  await openListbox(page, genderField(page));
}

export async function expandStateDropdown(page: Page): Promise<void> {
  await openListbox(page, stateField(page));
}

export async function closeDropdown(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}
