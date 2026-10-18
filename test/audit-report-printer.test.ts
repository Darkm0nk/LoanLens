/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { strict as assert } from 'node:assert';
import { generateAuditReportHtml, printAuditReport } from '../src/utils/auditReportPrinter';
import { compareLoanDocuments } from '../src/utils/comparator';
import { DEMO_SCENARIO_DISCREPANCY, DEMO_SCENARIO_CLEAN } from '../src/data/demoData';
import { ExtractedLoanDocument, LoanComparisonReport } from '../src/types/loan';

console.log('========================================================');
console.log('   LOANLENS PRINT AUDIT REPORT GENERATION TEST SUITE');
console.log('========================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

// Build standard reports from demo scenarios
const discrepancyReport = compareLoanDocuments(
  DEMO_SCENARIO_DISCREPANCY.kfsDoc,
  DEMO_SCENARIO_DISCREPANCY.sanctionDoc,
  DEMO_SCENARIO_DISCREPANCY.agreementDoc
);

const cleanReport = compareLoanDocuments(
  DEMO_SCENARIO_CLEAN.kfsDoc,
  DEMO_SCENARIO_CLEAN.sanctionDoc,
  DEMO_SCENARIO_CLEAN.agreementDoc
);

// -------------------------------------------------------------
// 1. DISCREPANCY SCENARIO REPORT GENERATION
// -------------------------------------------------------------
console.log('[1] Discrepancy Scenario Audit Report Content:');

runTest('Generates complete HTML document with proper doctype, meta, and title', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>LoanLens Contract Audit Report - Vikramaditya Sharma [Synthetic Profile]</title>'));
  assert.ok(html.includes('LoanLens'));
  assert.ok(html.includes('Loan Contract Audit & Pre-Signing Due Diligence Report'));
});

runTest('Displays prominent Synthetic Demo Banner for demo reports', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('SYNTHETIC DEMONSTRATION AUDIT · SAMPLE DATA MODE'));
  assert.ok(html.includes('synthetic demonstration loan profiles for software evaluation purposes'));
  assert.ok(!html.includes('CONFIDENTIAL · BORROWER AUDIT REPORT'));
});

runTest('Renders borrower, lender, and loan type context accurately', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('Vikramaditya Sharma [Synthetic Profile]'));
  assert.ok(html.includes('Apex Housing Finance [Sample Institution]'));
  assert.ok(html.includes(discrepancyReport.loanType));
  assert.ok(html.includes('KFS ✓'));
  assert.ok(html.includes('Sanction Letter ✓'));
  assert.ok(html.includes('Loan Agreement ✓'));
});

runTest('Includes executive verdict, recommendation, and statistics strip', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('Executive Audit Recommendation: Review Variances with Lender'));
  assert.ok(html.includes('Risk Rating: Variances Noted'));
  assert.ok(html.includes('Evaluated Terms'));
  assert.ok(html.includes('Aligned Terms'));
  assert.ok(html.includes('Variances Noted'));
  assert.ok(html.includes('Identified Risk & Variance Summary:'));
});

runTest('Renders all 9 evaluated terms with status badges and value tables', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.strictEqual(discrepancyReport.comparisons.length, 9);

  for (const comp of discrepancyReport.comparisons) {
    const escapedLabel = comp.label.replace(/&/g, '&amp;');
    assert.ok(html.includes(escapedLabel), `HTML must include term: ${comp.label}`);
    assert.ok(html.length > 1000);
  }
});

runTest('Displays source verification and location evidence tiers without hallucination', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('✓ Source Verified'));
  assert.ok(html.includes('Clause / Page Citation'));
  assert.ok(html.includes('Evidence Status'));
});

runTest('Includes financial impact calculations and assumptions where present', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('Calculated Financial Impact:'));
  assert.ok(html.includes('Assumptions:'));
});

runTest('Includes regulatory directives and lender clarification questions', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('Directive Ref:'));
  assert.ok(html.includes('Regulatory Mandate:'));
  assert.ok(html.includes('Recommended Clarification Request:'));
});

runTest('Includes responsible analysis and privacy disclaimers', () => {
  const html = generateAuditReportHtml(discrepancyReport);
  assert.ok(html.includes('Regulatory Due Diligence Notice:'));
  assert.ok(html.includes('Master Direction on Key Facts Statements (Circular DOR.MCS.REC.17/01.01.001/2024-25)'));
  assert.ok(html.includes('Circular on Penal Charges in Loan Accounts (DoR.MCS.REC.28/01.01.001/2023-24)'));
  assert.ok(html.includes('Privacy & Data Protection:'));
  assert.ok(html.includes('All document analyses and comparisons are performed transiently in memory'));
});

// -------------------------------------------------------------
// 2. CLEAN SCENARIO REPORT GENERATION
// -------------------------------------------------------------
console.log('\n[2] Clean Scenario Audit Report Content:');

runTest('Clean scenario produces consistent rating and Aligned badges', () => {
  const html = generateAuditReportHtml(cleanReport);
  assert.ok(html.includes('Executive Audit Recommendation: Terms Aligned Across Documents'));
  assert.ok(html.includes('Risk Rating: Consistent'));
  assert.ok(html.includes('ALIGNED (MATCH)'));
  assert.ok(html.includes('Pooja Iyer [Synthetic Profile]'));
  assert.ok(!html.includes('Identified Risk & Variance Summary:'));
});

// -------------------------------------------------------------
// 3. REAL USER DOCUMENT AUDIT REPORT (CONFIDENTIALITY)
// -------------------------------------------------------------
console.log('\n[3] Real Document Confidentiality & Labelling:');

runTest('Real document report renders confidential badge and omits demo warning', () => {
  const realReport: LoanComparisonReport = {
    ...cleanReport,
    isDemo: false,
    borrowerName: 'Ananya Verma',
    lenderName: 'National Bank of India',
  };

  const html = generateAuditReportHtml(realReport);
  assert.ok(html.includes('CONFIDENTIAL · BORROWER AUDIT REPORT'));
  assert.ok(!html.includes('SYNTHETIC DEMONSTRATION AUDIT'));
  assert.ok(!html.includes('SAMPLE DATA MODE'));
  assert.ok(html.includes('Ananya Verma'));
});

// -------------------------------------------------------------
// 4. SINGLE-SOURCE PACKAGE NOTICE
// -------------------------------------------------------------
console.log('\n[4] Single-Source Package Notice:');

runTest('Renders single-source multi-section notice when isCombinedPackage is true', () => {
  const combinedReport: LoanComparisonReport = {
    ...cleanReport,
    isCombinedPackage: true,
    combinedFileName: 'Bound_Facility_Docket_2026.pdf',
  };

  const html = generateAuditReportHtml(combinedReport);
  assert.ok(html.includes('Single-Source Multi-Section Notice:'));
  assert.ok(html.includes('Bound_Facility_Docket_2026.pdf'));
});

// -------------------------------------------------------------
// 5. HTML ESCAPING & INJECTION SAFETY
// -------------------------------------------------------------
console.log('\n[5] HTML Safety & Injection Prevention:');

runTest('Escapes HTML special characters in borrower, lender, and clause notes', () => {
  const maliciousReport: LoanComparisonReport = {
    ...cleanReport,
    borrowerName: '<script>alert("xss")</script>',
    lenderName: 'Bank & Trust <Co>',
  };

  const html = generateAuditReportHtml(maliciousReport);
  assert.ok(!html.includes('<script>alert("xss")</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('Bank &amp; Trust &lt;Co&gt;'));
});

// -------------------------------------------------------------
// 6. SAFE PRINT TRIGGER IN NON-BROWSER ENVIRONMENT
// -------------------------------------------------------------
console.log('\n[6] Safe Execution & Error Handling:');

runTest('printAuditReport safely returns false in non-browser Node environment without crashing', () => {
  const result = printAuditReport(discrepancyReport);
  assert.strictEqual(result, false, 'Must return false when window/document is undefined');
});

console.log(`\n========================================================`);
console.log(`All ${passedTests} of ${totalTests} Print Audit Report Tests Passed!`);
console.log(`========================================================\n`);
