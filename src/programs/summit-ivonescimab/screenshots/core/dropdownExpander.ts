import { Page, Locator, expect } from '@playwright/test';

function genderField(page: Page) {
  return page.locator('input[name="gender"]:not([type="hidden"])');
}

function stateField(page: Page) {
  return page.locator('input[name="state"]:not([type="hidden"])');
}

// Click a combobox field and wait for its listbox to open, retrying the
// click once if it doesn't. Ported from Apotex's dropdownExpander.ts, which
// documents this same race live on its own xsMobile viewport - not
// independently re-verified for Summit, but kept as a defensive retry since
// it's harmless if unneeded and this is the same underlying Vuetify combobox
// component.
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
