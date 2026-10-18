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

  test('6. Print Audit Report vs Clarification Notice Separation & Verification', async ({ page }) => {
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();

    // Instrument window.print and iframe contentWindow.print to monitor execution
    await page.evaluate(() => {
      (window as any).__mainPrintCalls = 0;
      (window as any).__iframePrintCalls = [];

      window.print = () => {
        (window as any).__mainPrintCalls += 1;
      };

      const originalAppendChild = document.body.appendChild.bind(document.body);
      document.body.appendChild = function <T extends Node>(node: T): T {
        if (node instanceof HTMLIFrameElement) {
          const iframe = node;
          setTimeout(() => {
            try {
              if (iframe.contentWindow) {
                const cw = iframe.contentWindow;
                const origCwPrint = cw.print.bind(cw);
                cw.print = () => {
                  (window as any).__iframePrintCalls.push({
                    title: iframe.getAttribute('title') || '',
                    html: cw.document?.documentElement?.innerHTML || '',
                  });
                  return origCwPrint();
                };
              }
            } catch {
              // ignore
            }
          }, 10);
        }
        return originalAppendChild(node);
      };
    });

    // -------------------------------------------------------------
    // PART 1: Test "Print Audit" workflow (Full Audit Report)
    // -------------------------------------------------------------
    const printAuditBtn = page.getByRole('button', { name: 'Print Audit' });
    await expect(printAuditBtn).toBeVisible();

    // Trigger Print Audit
    await printAuditBtn.click();

    // Verify audit report iframe is created and attached to DOM
    const auditIframe = page.locator('iframe[title="LoanLens Audit Print Document"]');
    await expect(auditIframe).toBeAttached();

    // Inspect content inside the audit report iframe
    const auditFrame = page.frameLocator('iframe[title="LoanLens Audit Print Document"]');
    await expect(auditFrame.locator('.brand-title')).toContainText('LoanLens');
    await expect(auditFrame.locator('.brand-subtitle')).toContainText('Loan Contract Audit');

    // Verify prominent synthetic demo warning banner is displayed
    const demoBanner = auditFrame.locator('.demo-banner');
    await expect(demoBanner).toBeAttached();
    await expect(demoBanner).toContainText('SYNTHETIC DEMONSTRATION AUDIT');

    // Verify full audit matrix table and sections are present
    await expect(auditFrame.locator('.values-table').first()).toBeAttached();
    await expect(auditFrame.locator('.stats-strip')).toBeAttached();
    await expect(auditFrame.locator('.disclaimer-box')).toBeAttached();

    // Ensure main window.print was NEVER called
    const mainPrintCountAfterAudit = await page.evaluate(() => (window as any).__mainPrintCalls);
    expect(mainPrintCountAfterAudit).toBe(0);

    // Verify iframe is cleanly removed from DOM after print lifecycle cleanup
    await expect(auditIframe).toHaveCount(0, { timeout: 6000 });

    // -------------------------------------------------------------
    // PART 2: Test "Draft Clarification Notice" workflow (Lender Letter)
    // -------------------------------------------------------------
    const draftNoticeBtn = page.getByRole('button', { name: 'Draft Clarification Notice' });
    await draftNoticeBtn.click();

    const disputeModal = page.locator('div.fixed.inset-0').filter({ hasText: 'Lender Clarification & Rectification Request' }).first();
    await expect(disputeModal).toBeVisible();

    // Locate "Print Letter" button inside modal
    const printLetterBtn = disputeModal.getByRole('button', { name: 'Print Letter' });
    await expect(printLetterBtn).toBeVisible();

    // Trigger Print Letter
    await printLetterBtn.click();

    // Verify clarification letter iframe is created and attached to DOM
    const letterIframe = page.locator('iframe[title="LoanLens Clarification Letter Print Document"]');
    await expect(letterIframe).toBeAttached();

    // Inspect content inside the letter iframe
    const letterFrame = page.frameLocator('iframe[title="LoanLens Clarification Letter Print Document"]');
    await expect(letterFrame.locator('.header h1')).toContainText('LoanLens - Lender Clarification & Rectification Request');
    await expect(letterFrame.locator('.subject-line')).toContainText('Subject:');
    await expect(letterFrame.locator('.body-text')).toBeAttached();

    // Strictly verify letter does NOT contain the audit matrix or demo banner
    await expect(letterFrame.locator('.values-table')).toHaveCount(0);
    await expect(letterFrame.locator('.demo-banner')).toHaveCount(0);

    // Verify letter iframe is cleanly removed after lifecycle cleanup
    await expect(letterIframe).toHaveCount(0, { timeout: 6000 });

    // Close the clarification modal
    await disputeModal.getByRole('button', { name: 'Close' }).click();
    await expect(disputeModal).not.toBeVisible();

    // -------------------------------------------------------------
    // PART 3: Verify Isolated Print Invocations
    // -------------------------------------------------------------
    const printSummary = await page.evaluate(() => ({
      mainCalls: (window as any).__mainPrintCalls,
      iframeCalls: (window as any).__iframePrintCalls.map((c: any) => c.title),
    }));

    // Main window.print must NEVER have been called
    expect(printSummary.mainCalls).toBe(0);

    // Both isolated iframes must have invoked contentWindow.print()
    expect(printSummary.iframeCalls).toContain('LoanLens Audit Print Document');
    expect(printSummary.iframeCalls).toContain('LoanLens Clarification Letter Print Document');
  });

  test('7. Truthful Evidence Verification: demo benchmarks display Sample Benchmark Citation and never claim Source Verified', async ({ page }) => {
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();

    // Verify comparison cards display "Sample Benchmark Citation"
    const benchmarkBadges = page.getByText('Sample Benchmark Citation');
    await expect(benchmarkBadges.first()).toBeVisible();

    // Verify "✓ Source Verified" or "Source Verified" is NOT claimed on demo benchmark cards
    await expect(page.getByText('✓ Source Verified')).toHaveCount(0);

    // Inspect an evidence modal
    const inspectBtn = page.getByRole('button', { name: 'Inspect Evidence' }).first();
    await inspectBtn.click();

    const modal = page.locator('div.fixed.inset-0').first();
    await expect(modal).toBeVisible();

    // Verify modal also displays Sample Benchmark Citation and not real source verification
    await expect(modal.getByText('Sample Benchmark Citation').first()).toBeVisible();
    await expect(modal.getByText('✓ Source Verified')).toHaveCount(0);

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('8. RBI Prepayment Directions Grounding: modal displays Directions 2025 and Circular 2014', async ({ page }) => {
    // Navigate to RBI Guide tab
    await page.getByRole('button', { name: 'RBI Guide', exact: true }).click();
    await expect(page.getByText('Summary of Key Borrower Protections')).toBeVisible();

    // Click "Open Regulatory Guide"
    const openGuideBtn = page.getByRole('button', { name: 'Open Regulatory Guide' });
    await openGuideBtn.click();

    const rbiModal = page.locator('div.fixed.inset-0').filter({ hasText: 'RBI Borrower Safeguards & Regulatory Citations' }).first();
    await expect(rbiModal).toBeVisible();

    // Verify the latest Directions 2025 reference is cited
    await expect(rbiModal.getByText(/Reserve Bank of India \(Pre-payment Charges on Loans\) Directions, 2025/i)).toBeVisible();
    await expect(rbiModal.getByText(/RBI\/2025-26\/64 DoR\.MCS\.REC\.38\/01\.01\.001\/2025-26/i)).toBeVisible();
    await expect(rbiModal.getByText(/January 1, 2026/i)).toBeVisible();
    await expect(rbiModal.getByText(/DBOD\.Dir\.BC\.115\/13\.03\.00\/2013-14/i)).toBeVisible();

    // Close modal
    const closeBtn = rbiModal.getByRole('button', { name: 'Close' });
    await closeBtn.click();
    await expect(rbiModal).not.toBeVisible();
  });

  test('9. Dark Mode Contrast & Visual Quality Verification', async ({ page }) => {
    const screenshotDir = '/Users/pansheriya.vishal/.gemini/antigravity/brain/1f8c9e47-e69f-461c-bdb2-5b85a187eb6e/screenshots';

    // In Light Mode: capture discrepancy dashboard
    await page.getByRole('button', { name: 'Intake & Comparison', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${screenshotDir}/01_scenario_a_discrepancy.png`, fullPage: false });

    // Open Inspect Evidence in Light Mode
    const inspectBtn = page.getByRole('button', { name: 'Inspect Evidence' }).first();
    await inspectBtn.click();
    const evidenceModal = page.locator('div.fixed.inset-0').first();
    await expect(evidenceModal).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/04_evidence_modal.png` });
    await page.keyboard.press('Escape');

    // Toggle to Dark Mode
    const darkModeBtn = page.getByTitle('Dark Mode');
    await darkModeBtn.click();

    // Verify html element has 'dark' class
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    // Verify body background color is dark
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(5, 8, 17)');

    // Capture Dark Mode discrepancy view
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${screenshotDir}/07_dark_mode_discrepancy.png`, fullPage: false });

    // Open Inspect Evidence in Dark Mode
    await inspectBtn.click();
    await expect(evidenceModal).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/08_dark_mode_evidence_modal.png` });
    await page.keyboard.press('Escape');

    // Open RBI Guide in Dark Mode
    await page.getByRole('button', { name: 'RBI Guide', exact: true }).click();
    const openGuideBtn = page.getByRole('button', { name: 'Open Regulatory Guide' });
    await openGuideBtn.click();
    const rbiModal = page.locator('div.fixed.inset-0').filter({ hasText: 'RBI Borrower Safeguards & Regulatory Citations' }).first();
    await expect(rbiModal).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/09_dark_mode_rbi_modal.png` });
    await rbiModal.getByRole('button', { name: 'Close' }).click();

    // Switch back to Light Mode
    const lightModeBtn = page.getByTitle('Light Mode');
    await lightModeBtn.click();
    const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    expect(isLight).toBe(true);
  });
});
