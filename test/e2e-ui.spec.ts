import { test, expect } from '@playwright/test';

test.describe('LoanLens End-to-End Headless Browser Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('1. Dashboard Navigation: switches between Overview, Intake & Comparison, and RBI Guide', async ({ page }) => {
    // Assert Brand Header is visible
    await expect(page.locator('text=LoanLens').first()).toBeVisible();
    await expect(page.locator('text=Check Before You Sign').first()).toBeVisible();

    // Navigate to Overview tab
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByText('Know your loan')).toBeVisible();
    await expect(page.getByText('Combined Intake & Audit Workspace')).toBeVisible();

    // Navigate to Intake & Comparison tab
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Key Facts Statement (KFS)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sanction Letter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Loan Agreement' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live Comparison Matrix & Financial Impact' })).toBeVisible();

    // Navigate to RBI Guide tab
    await page.getByRole('button', { name: 'RBI Guide', exact: true }).click();
    await expect(page.getByText('Summary of Key Borrower Protections')).toBeVisible();
    await expect(page.getByText('Draft Lender Clarification Notice')).toBeVisible();
  });

  test('2. Dynamic Borrower Avatar and Sample Data Mode Status', async ({ page }) => {
    // Check Sample Data Mode status badge in header
    await expect(page.getByText('Sample Data Mode')).toBeVisible();

    // Check dynamic borrower avatar in header (derived from Vikramaditya Sharma)
    await expect(page.getByText('VS', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Vikramaditya Sharma [Synthetic Profile]')).toBeVisible();
  });

  test('3. Upload Error Dismissal: triggering short text validation and clicking ✕ clears error banner', async ({ page }) => {
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();

    // Clear the active sample document from KFS card to reveal the upload/paste tabs
    const clearKfsBtn = page.getByRole('button', { name: 'Clear' }).first();
    await clearKfsBtn.click();

    // In the KFS card, toggle to the "Paste Text / Clauses" mode
    const pasteTab = page.getByRole('button', { name: 'Paste Text / Clauses' }).first();
    await pasteTab.click();

    // Enter short text (<30 characters) to trigger client-side validation error
    const textarea = page.locator('textarea').first();
    await textarea.fill('Short text');

    // Click "Analyze Pasted Text with Gemini"
    const submitBtn = page.getByRole('button', { name: 'Analyze Pasted Text with Gemini' }).first();
    await submitBtn.click();

    // Assert the error notification appears
    const errorBox = page.getByText('Extraction / Upload Issue');
    await expect(errorBox).toBeVisible();
    await expect(page.getByText(/Pasted text is too brief/i)).toBeVisible();

    // Click the ✕ dismiss button
    const dismissBtn = page.getByRole('button', { name: 'Dismiss error notification' }).first();
    await dismissBtn.click();

    // Assert the error banner is dismissed
    await expect(errorBox).not.toBeVisible();
  });

  test('4. Side-by-Side Clean Match Verification: matching terms show emerald badge and Aligned header', async ({ page }) => {
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();

    // Locate the Loan Tenure (Months) card which is a 100% clean match (240 months) across all docs
    const tenureCard = page.locator('div.rounded-xl.border').filter({ hasText: 'Loan Tenure (Months)' }).first();
    await expect(tenureCard).toBeVisible();

    // Assert clean Match badge is rendered (not "Needs manual verification")
    await expect(tenureCard.getByText('Match', { exact: true })).toBeVisible();
    await expect(tenureCard.getByText('Needs manual verification')).not.toBeVisible();

    // Click "Inspect Evidence"
    const inspectBtn = tenureCard.getByRole('button', { name: 'Inspect Evidence' });
    await inspectBtn.click();

    // Modal dialog opens
    const modal = page.locator('div.fixed.inset-0').first();
    await expect(modal).toBeVisible();

    // Assert emerald "Terms Aligned (Match)" header is displayed
    await expect(modal.getByText('Terms Aligned (Match)')).toBeVisible();

    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('5. Single-Document Intake Guard: resetting and loading 1 document displays awaiting notice', async ({ page }) => {
    // Reset all data using sidebar reset button
    const resetBtn = page.getByRole('button', { name: 'Reset All Data' });
    await resetBtn.click();

    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();

    // Header should state Ready for Documents
    await expect(page.getByText('Ready for Documents')).toBeVisible();

    // Click "Load Sample KFS" alone
    const loadKfsBtn = page.getByRole('button', { name: 'Load Sample KFS' });
    await loadKfsBtn.click();

    // Assert 1 of 3 documents loaded
    await expect(page.getByText('1 of 3 Documents Loaded')).toBeVisible();

    // Assert comparison matrix indicates awaiting additional documents
    await expect(page.getByRole('heading', { name: 'No Active Comparison Report' })).toBeVisible();
    await expect(page.getByText(/Upload at least two loan documents above/i)).toBeVisible();
  });

});
