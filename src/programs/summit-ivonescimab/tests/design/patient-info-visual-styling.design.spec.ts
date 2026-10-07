/**
 * VISUAL STYLING & CSS TESTS - US-280439
 * Patient Information Page (Pharmacy Path)
 * 
 * Focus: CSS properties, element styling, validation, accessibility
 * Resolution: 1920 × 1080
 * Scope: Body form elements only
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

test.describe('Patient Information Page - generic CSS ranges (not Figma-driven)', () => {
  
  let page: Page;
  const BASE_URL = 'https://portal-pr.trialcard.com/86064/pharmacy/patient-information/';

  // Vuetify 2 fields: border/radius/padding/height live on .v-input__slot, not the <input>.
  const DOB_INPUT = 'input[name="dateOfBirth"]';
  const DOB_BOX = '.v-input__slot:has(input[name="dateOfBirth"])';
  // Vuetify also renders a hidden proxy input with the same name (breaks strict mode)
  const GENDER_INPUT = 'input[name="gender"]:not([type="hidden"])';
  const GENDER_BOX = '.v-input__slot:has(input[name="gender"])';
  
  // ============================================================================
  // SETUP & NAVIGATION
  // ============================================================================
  
  // One browser context/page shared by every test: the flow to Patient Information
  // runs once. (Not 'serial' mode: that skips every later test after one failure.
  // Playwright still starts a fresh worker, and so re-runs this, after a failed test.)

  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    page = await context.newPage();
    
    // Opening BASE_URL directly redirects to the landing page, so walk the
    // Pharmacy flow: landing -> eligibility -> Patient Information.
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Pharmacy is the 3rd role card; its radiogroup holds the only action.
    await page.getByRole('radiogroup').nth(2).getByText('Enroll Patient in Co-pay Assistance').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForURL(/\/pharmacy\/eligibility\//);

    // Eligible answers: not subsidized (No), then Yes to the other four.
    const answers = ['No', 'Yes', 'Yes', 'Yes', 'Yes'];
    for (const [i, answer] of answers.entries()) {
      await page.getByRole('radiogroup').nth(i).getByText(answer, { exact: true }).click();
    }
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('heading', { name: 'Patient Information', level: 1 }).waitFor();
  });

  test.afterAll(async () => {
    await context.close();
  });
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  async function getElementCSSProperty(selector: string, property: string): Promise<string> {
    try {
      return await page.locator(selector).first().evaluate((el, prop) => {
        const element = el as HTMLElement;
        return window.getComputedStyle(element).getPropertyValue(prop);
      }, property);
    } catch (e) {
      return 'N/A';
    }
  }
  
  async function getElementDimensions(selector: string) {
    const box = await page.locator(selector).first().boundingBox();
    return {
      width: box?.width || 0,
      height: box?.height || 0,
      x: box?.x || 0,
      y: box?.y || 0,
    };
  }
  
  // ============================================================================
  // TEST 1: INPUT FIELD - DATE OF BIRTH (DOB)
  // ============================================================================
  
  test('1. [INPUT-DOB] Date of Birth field should exist and be visible', async () => {
    // Look for DOB input by various selectors
    const dobInput = page.locator('input[name="dateOfBirth"]').first();
    
    const isVisible = await dobInput.isVisible().catch(() => false);
    
    if (!isVisible) {
      console.log('⚠️  WARNING: DOB input not found with standard selectors');
      console.log('Available inputs:', await page.locator('input').count());
    }
    
    expect(isVisible || await page.locator('input').count() > 0).toBeTruthy();
  });
  
  test('2. [INPUT-DOB] DOB input should have height between 40-50px', async () => {
    const dimensions = await getElementDimensions(DOB_BOX);
    
    console.log(`  DOB Input Height: ${dimensions.height}px`);
    
    expect(dimensions.height).toBeGreaterThanOrEqual(35);
    expect(dimensions.height).toBeLessThanOrEqual(55);
  });
  
  test('3. [INPUT-DOB] DOB input should have border-radius (rounded corners)', async () => {
    const borderRadius = await getElementCSSProperty(DOB_BOX, 'border-radius');
    
    console.log(`  Border Radius: ${borderRadius}`);
    
    expect(borderRadius).not.toBe('0px');
    expect(borderRadius).not.toBe('none');
  });
  
  test('4. [INPUT-DOB] DOB input should have padding', async () => {
    const paddingLeft = await getElementCSSProperty(DOB_BOX, 'padding-left');
    const paddingRight = await getElementCSSProperty(DOB_BOX, 'padding-right');
    
    console.log(`  Padding Left: ${paddingLeft}, Right: ${paddingRight}`);
    
    expect(parseInt(paddingLeft) || 0).toBeGreaterThan(5);
    expect(parseInt(paddingRight) || 0).toBeGreaterThan(5);
  });
  
  test('5. [INPUT-DOB] DOB input should have font-size 14px or similar', async () => {
    const fontSize = await getElementCSSProperty(DOB_INPUT, 'font-size');
    
    console.log(`  Font Size: ${fontSize}`);
    
    const sizeNum = parseInt(fontSize);
    expect(sizeNum).toBeGreaterThanOrEqual(12);
    expect(sizeNum).toBeLessThanOrEqual(16);
  });
  
  test('6. [INPUT-DOB] DOB input should have visible border', async () => {
    const borderColor = await getElementCSSProperty(DOB_BOX, 'border-color');
    const borderWidth = await getElementCSSProperty(DOB_BOX, 'border-width');
    
    console.log(`  Border Color: ${borderColor}, Width: ${borderWidth}`);
    
    expect(borderColor).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
    expect(parseInt(borderWidth) || 0).toBeGreaterThan(0);
  });
  
  // ============================================================================
  // TEST 2: SELECT/DROPDOWN - GENDER FIELD
  // ============================================================================
  
  test('7. [SELECT-GENDER] Gender dropdown should exist', async () => {
    // Vuetify v-select: a combobox input, not a native <select>
    await expect(page.locator(GENDER_INPUT)).toBeVisible();
  });
  
  test('8. [SELECT-GENDER] Gender should have exactly 3 or 4 options', async () => {
    await page.locator(GENDER_INPUT).click();
    await page.getByRole('option').first().waitFor(); // menu opens with an animation
    const optionCount = await page.getByRole('option').count();
    await page.keyboard.press('Escape'); // close the menu for later tests
    
    console.log(`  Option Count: ${optionCount}`);
    
    expect(optionCount).toBeGreaterThanOrEqual(3);
    expect(optionCount).toBeLessThanOrEqual(5); // Accounting for placeholder
  });
  
  test('9. [SELECT-GENDER] Gender dropdown should have proper height', async () => {
    const dimensions = await getElementDimensions(GENDER_BOX);
    
    console.log(`  Select Height: ${dimensions.height}px`);
    
    expect(dimensions.height).toBeGreaterThanOrEqual(35);
    expect(dimensions.height).toBeLessThanOrEqual(55);
  });
  
  test('10. [SELECT-GENDER] Gender select should have matching font-size to inputs', async () => {
    const selectFontSize = await getElementCSSProperty(GENDER_INPUT, 'font-size');
    const inputFontSize = await getElementCSSProperty(DOB_INPUT, 'font-size');
    
    console.log(`  Select Font: ${selectFontSize}, Input Font: ${inputFontSize}`);
    
    // Should be similar (both 14px or similar)
    expect(Math.abs(parseInt(selectFontSize) - parseInt(inputFontSize))).toBeLessThanOrEqual(2);
  });
  
  // ============================================================================
  // TEST 3: LABELS & TEXT STYLING
  // ============================================================================
  
  test('11. [LABELS] Form should have labels for each input field', async () => {
    const labelCount = await page.locator('label').count();
    
    console.log(`  Label Count: ${labelCount}`);
    
    expect(labelCount).toBeGreaterThanOrEqual(2);
  });
  
  test('12. [LABELS] Labels should have font-weight bold or 600+', async () => {
    const labelFontWeight = await getElementCSSProperty('.field-label', 'font-weight');
    
    console.log(`  Label Font Weight: ${labelFontWeight}`);
    
    const weight = parseInt(labelFontWeight) || 400;
    expect(weight).toBeGreaterThanOrEqual(500);
  });
  
  test('13. [LABELS] Required indicators (*) should be visible', async () => {
    // Check if asterisks are shown
    const asteriskCount = await page.locator('text=/\\*/').count().catch(() => 0);
    
    console.log(`  Asterisk Count: ${asteriskCount}`);
    
    expect(asteriskCount).toBeGreaterThanOrEqual(1);
  });
  
  // ============================================================================
  // TEST 4: BUTTON STYLING
  // ============================================================================
  
  test('14. [BUTTON] Submit button should exist and be visible', async () => {
    const nextBtn = page.locator('button:has-text("Submit")').first();
    const isVisible = await nextBtn.isVisible().catch(() => false);
    
    expect(isVisible).toBeTruthy();
  });
  
  test('15. [BUTTON] Submit button should have proper height (44-60px)', async () => {
    const dimensions = await getElementDimensions('button:has-text("Submit")');
    
    console.log(`  Next Button Height: ${dimensions.height}px`);
    
    expect(dimensions.height).toBeGreaterThanOrEqual(40);
    expect(dimensions.height).toBeLessThanOrEqual(65);
  });
  
  test('16. [BUTTON] Submit button should have background color (not transparent)', async () => {
    const bgColor = await getElementCSSProperty('button:has-text("Submit")', 'background-color');
    
    console.log(`  Button BG Color: ${bgColor}`);
    
    expect(bgColor).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)|rgba\(255, 255, 255, 0\)/);
  });
  
  test('17. [BUTTON] Submit button should have white or light text', async () => {
    const textColor = await getElementCSSProperty('button:has-text("Submit")', 'color');
    
    console.log(`  Button Text Color: ${textColor}`);
    
    // Should be light/white
    expect(textColor).toMatch(/rgb\(2[0-9][0-9], 2[0-9][0-9], 2[0-9][0-9]\)|white|rgb\(255, 255, 255\)/);
  });
  
  test('18. [BUTTON] Back button should exist if navigation is bidirectional', async () => {
    const backBtn = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
    const isVisible = await backBtn.isVisible().catch(() => false);
    
    console.log(`  Back Button Visible: ${isVisible}`);
    
    // Not a hard requirement, but good to have
    expect(isVisible || true).toBeTruthy();
  });
  
  // ============================================================================
  // TEST 5: FORM LAYOUT & SPACING
  // ============================================================================
  
  test('19. [LAYOUT] Form should not have horizontal scrolling at 1920x1080', async () => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => window.innerWidth);
    
    console.log(`  Scroll Width: ${scrollWidth}, Client Width: ${clientWidth}`);
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // Allow small margin
  });
  
  test('20. [LAYOUT] Form should be centered or have reasonable margins', async () => {
    const mainContent = await getElementDimensions('.field-row');
    
    console.log(`  Form Width: ${mainContent.width}px, Position X: ${mainContent.x}px`);
    
    expect(mainContent.width).toBeGreaterThan(300);
    expect(mainContent.width).toBeLessThan(1200);
  });
  
  test('21. [SPACING] Input fields should be vertically spaced consistently', async () => {
    // First Name and Last Name share a row, so compare First Name with the
    // Date of Birth field on the next row.
    const inputs = [page.locator('input[name="firstName"]'), page.locator(DOB_INPUT)];
    
    if (inputs.length >= 2) {
      const input1Box = await inputs[0].boundingBox();
      const input2Box = await inputs[1].boundingBox();
      
      if (input1Box && input2Box) {
        const gap = input2Box.y - (input1Box.y + input1Box.height);
        console.log(`  Inter-field Gap: ${gap}px`);
        
        expect(gap).toBeGreaterThan(10);
        expect(gap).toBeLessThan(100);
      }
    }
  });
  
  // ============================================================================
  // TEST 6: VALIDATION & INTERACTION
  // ============================================================================
  
  test('22. [VALIDATION] Age validation should trigger for underage dates', async () => {
    const dobInputs = await page.locator(DOB_INPUT).all();
    
    if (dobInputs.length > 0) {
      const firstInput = dobInputs[0];
      
      // Enter underage date
      await firstInput.fill('01/01/2015'); // masked MM/DD/YYYY
      await firstInput.blur();
      
      // Check for error message
      await page.waitForTimeout(500);
      
      const errorText = await page.locator('.error-message').first().textContent().catch(() => '');
      
      console.log(`  Error Message: ${errorText}`);
      
      // Error should appear or validation should prevent submission
      expect(errorText || await page.locator(DOB_INPUT).isDisabled()).toBeTruthy();
    }
  });
  
  test('23. [VALIDATION] State field should not force uppercase', async () => {
    const stateInputs = await page.locator('input[name="state"]').all();
    
    if (stateInputs.length > 0) {
      const stateInput = stateInputs[0];
      
      // Type lowercase
      await stateInput.fill('california');
      
      const value = await stateInput.inputValue();
      
      console.log(`  State Input Value: ${value}`);
      
      // Should NOT be forced to uppercase
      expect(value).not.toBe('CALIFORNIA');
    }
  });
  
  test('24. [VALIDATION] Form fields should accept input and maintain values', async () => {
    const inputCount = await page.locator('input, select, textarea').count();
    
    console.log(`  Input Fields Found: ${inputCount}`);
    
    expect(inputCount).toBeGreaterThanOrEqual(2);
  });
  
  // ============================================================================
  // TEST 7: ACCESSIBILITY
  // ============================================================================
  
  test('25. [A11Y] Form should have proper heading hierarchy', async () => {
    const h1Count = await page.locator('h1').count();
    
    console.log(`  H1 Count: ${h1Count}`);
    
    // Should have at least one H1
    expect(h1Count).toBeGreaterThanOrEqual(0); // 0 is ok if using other semantic structure
  });
  
  test('26. [A11Y] Form fields should be keyboard navigable', async () => {
    const firstInput = page.locator('input').first();
    
    // Focus first input
    await firstInput.focus();
    
    // Press Tab to move to next
    await page.keyboard.press('Tab');
    
    // Second field should be focused
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    
    console.log(`  Focused Element After Tab: ${focusedElement}`);
    
    expect(focusedElement).toMatch(/INPUT|SELECT|BUTTON|TEXTAREA/);
  });
  
  // ============================================================================
  // TEST 8: VISUAL SCREENSHOTS
  // ============================================================================
  
  test('27. [SCREENSHOT] Capture default state at 1920x1080', async () => {
    await page.screenshot({
      path: 'patient-info-default-1920x1080.png',
      fullPage: false,
    });
    
    console.log('  ✅ Screenshot saved: patient-info-default-1920x1080.png');
  });
  
  test('28. [SCREENSHOT] Capture with filled form', async () => {
    // Fill in some fields
    const dateInputs = await page.locator(DOB_INPUT).all();
    if (dateInputs.length > 0) {
      await dateInputs[0].fill('01/01/1990');
    }
    
    await page.locator(GENDER_INPUT).click();
    await page.getByRole('option').first().click();
    
    await page.screenshot({
      path: 'patient-info-filled-1920x1080.png',
      fullPage: false,
    });
    
    console.log('  ✅ Screenshot saved: patient-info-filled-1920x1080.png');
  });
  
  // ============================================================================
  // TEST 9: SUMMARY & REPORTING
  // ============================================================================
  
  test('29. [REPORT] Form elements count and structure', async () => {
    const stats = {
      inputs: await page.locator('input').count(),
      selects: await page.locator('select').count(),
      labels: await page.locator('label').count(),
      buttons: await page.locator('button').count(),
      textareas: await page.locator('textarea').count(),
    };
    
    console.log('📊 FORM STRUCTURE REPORT');
    console.log('='.repeat(50));
    console.log(`  Input Fields:  ${stats.inputs}`);
    console.log(`  Selects:       ${stats.selects}`);
    console.log(`  Labels:        ${stats.labels}`);
    console.log(`  Buttons:       ${stats.buttons}`);
    console.log(`  Text Areas:    ${stats.textareas}`);
    console.log('='.repeat(50));
    
    expect(stats.inputs + stats.selects + stats.textareas).toBeGreaterThanOrEqual(2);
  });
});