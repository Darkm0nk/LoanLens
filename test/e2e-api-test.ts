import { strict as assert } from 'node:assert';
import { compareLoanDocuments } from '../src/utils/comparator';

console.log('========================================================');
console.log('   LOANLENS END-TO-END AUDIT & PIPELINE TEST SUITE');
console.log('========================================================\n');

const BASE_URL = 'http://localhost:3000';

async function runE2ETests() {
  // 1. Health check test
  console.log('[Test 1] Checking API Health and Gemini Configuration...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
  const healthJson = await healthRes.json();
  assert.strictEqual(healthJson.status, 'ok');
  assert.strictEqual(healthJson.geminiConfigured, true, 'Gemini API should be configured');
  console.log('  ✓ API is healthy and Gemini 3.8 Flash is configured.\n');

  // 2. Real Document 1: KFS Extraction via Gemini
  console.log('[Test 2] Extracting Key Facts Statement (KFS) via Gemini API...');
  const kfsSample = `
RESERVE BANK OF INDIA - MANDATORY KEY FACTS STATEMENT (KFS)
Document Type: Key Facts Statement for Retail Loans
Lender: Apex Housing Finance Ltd
Borrower: Priya Sharma
Loan Type: Individual Home Loan
Date: 12-Jan-2025

KEY FACTS TABLE (Page 1, Clause 1):
1. Sanctioned Loan Amount: INR 42,00,000 (Forty Two Lakhs Only) [Page 1, Item 1]
2. Type of Rate: Floating Rate linked to EBLR (Repo benchmark 6.50% + 2.25% spread) = 8.75% per annum [Page 1, Item 2]
3. Annual Percentage Rate (APR): 9.15% per annum inclusive of all mandatory charges [Page 1, Item 3]
4. Total Loan Tenure: 240 months (20 Years) [Page 1, Item 4]
5. Monthly Equated Installment (EMI): INR 37,116 per month [Page 1, Item 5]
6. Upfront Processing Fee: INR 5,000 plus applicable GST (18%) [Page 1, Item 6]
7. Insurance Cover: Credit shield insurance is optional. Premium is INR 0 [Page 2, Item 7]
8. Penal Charges for Delay: Flat INR 500 per month for payment delays. No compounding of interest [Page 2, Item 8]
9. Prepayment / Foreclosure Charges: NIL / Zero charges on floating rate individual loan as per RBI regulations [Page 2, Item 9]
`;

  const kfsRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType: 'kfs',
      documentName: 'Apex_KFS_PriyaSharma.txt',
      textContent: kfsSample,
    }),
  });

  assert.strictEqual(kfsRes.status, 200, 'KFS extraction should return 200');
  const kfsDoc = await kfsRes.json();
  assert.strictEqual(kfsDoc.isDemo, false, 'Uploaded doc must have isDemo=false');
  assert.strictEqual(kfsDoc.lenderName.toLowerCase().includes('apex'), true, 'Lender identified');
  assert.strictEqual(kfsDoc.fields.loanAmount.value, 4200000, 'Loan amount extracted');
  assert.strictEqual(kfsDoc.fields.interestRate.value, 8.75, 'Interest rate extracted');
  assert.strictEqual(kfsDoc.fields.tenureMonths.value, 240, 'Tenure extracted');
  assert.ok(kfsDoc.fields.interestRate.isVerifiedInSource, 'Interest rate has source citation');
  console.log(`  ✓ KFS parsed: Amount=₹${kfsDoc.fields.loanAmount.value}, Rate=${kfsDoc.fields.interestRate.value}%, Ref="${kfsDoc.fields.interestRate.pageClauseRef}"\n`);

  // 3. Real Document 2: Sanction Letter Extraction
  console.log('[Test 3] Extracting Sanction Letter via Gemini API...');
  const sanctionSample = `
SANCTION LETTER - APEX HOUSING FINANCE LTD
To: Priya Sharma
Date: 15-Jan-2025
Ref: SL/2025/AHF/9812

Dear Priya Sharma,
We are pleased to inform you that your application for a Home Loan has been sanctioned on the following terms:
1. Approved Sanction Amount: Rs 42,00,000/- (Rupees Forty Two Lakhs Only) [Page 1, Clause 1]
2. Rate of Interest: 8.75% p.a. (Floating Rate, EBLR + 2.25%) [Page 1, Clause 2.1]
3. Loan Tenure: 240 Months [Page 1, Clause 3]
4. Monthly Installment (EMI): Rs 37,116/- [Page 1, Clause 4]
5. Processing Charges: Rs 5,000 + GST [Page 2, Clause 6]
6. Foreclosure Terms: Nil penalty for premature closure under floating rate [Page 2, Clause 8]
7. Delayed Payment: Overdue charge of Rs 500 per default cycle [Page 2, Clause 9]
`;

  const sanctionRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType: 'sanction_letter',
      documentName: 'Sanction_Letter_SL9812.txt',
      textContent: sanctionSample,
    }),
  });

  assert.strictEqual(sanctionRes.status, 200, 'Sanction letter extraction should return 200');
  const sanctionDoc = await sanctionRes.json();
  assert.strictEqual(sanctionDoc.fields.loanAmount.value, 4200000);
  assert.strictEqual(sanctionDoc.fields.interestRate.value, 8.75);
  console.log(`  ✓ Sanction Letter parsed: Amount=₹${sanctionDoc.fields.loanAmount.value}, Rate=${sanctionDoc.fields.interestRate.value}%\n`);

  // 4. Real Document 3: Loan Agreement Extraction (with Sneaky Discrepancies)
  console.log('[Test 4] Extracting Loan Agreement with Surreptitious Discrepancies via Gemini API...');
  const agreementSample = `
DEFINITIVE LOAN AGREEMENT
Between: Apex Housing Finance Ltd ("Lender") and Priya Sharma ("Borrower")
Facility: Retail Housing Mortgage Loan
Date of Execution: 20-Jan-2025

ARTICLE 2 - FACILITY AND TERMS:
2.1 Principal Sanctioned: The facility sanctioned is INR 42,78,000/- (Forty Two Lakhs Seventy Eight Thousand Only) which includes administrative insurance capitalization [Page 3, Clause 2.1].
2.2 Interest Rate: The applicable rate of interest shall be floating rate of 9.25% per annum (Repo 6.50% + 2.75% reset spread) [Page 4, Clause 2.2].
2.3 Tenure: 240 Monthly Installments [Page 4, Clause 2.3].
2.4 Monthly Installment: Borrower shall pay EMI of INR 39,181/- on the 5th of every month [Page 5, Clause 2.4].
2.5 Processing Fee: Total fee payable is INR 18,500 plus GST deducted at source [Page 6, Clause 3.1].
2.6 Insurance Policy: Mandatory Suraksha Credit Cover bundled at INR 78,000 added into facility disbursement [Page 7, Clause 4.2].
2.7 Default and Penal Interest: In event of overdue payments, borrower is liable for 24% p.a. compounded monthly penal interest [Page 9, Clause 8.1].
2.8 Foreclosure and Prepayment: A fee of 2.5% plus GST shall be levied on any early prepayments or full foreclosure made within 24 months [Page 10, Clause 9.3].
`;

  const agreementRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType: 'loan_agreement',
      documentName: 'Executed_Loan_Agreement_Priya.txt',
      textContent: agreementSample,
    }),
  });

  assert.strictEqual(agreementRes.status, 200, 'Loan agreement extraction should return 200');
  const agreementDoc = await agreementRes.json();
  assert.strictEqual(agreementDoc.fields.loanAmount.value, 4278000, 'Capitalized loan amount detected');
  assert.strictEqual(agreementDoc.fields.interestRate.value, 9.25, 'Sneaky 9.25% interest rate detected');
  assert.strictEqual(agreementDoc.fields.penalCharges.isCompoundedInterest, true, 'Compounded penal interest detected');
  assert.strictEqual(agreementDoc.fields.prepaymentCharges.hasPenalty, true, 'Prepayment penalty detected');
  console.log(`  ✓ Loan Agreement parsed: Discrepant Rate=${agreementDoc.fields.interestRate.value}%, Penalty=${agreementDoc.fields.prepaymentCharges.hasPenalty}\n`);

  // 5. End-to-End Comparison Engine Execution
  console.log('[Test 5] Executing Cross-Document Comparison Engine...');
  const report = compareLoanDocuments(kfsDoc, sanctionDoc, agreementDoc);
  assert.ok(report !== null);
  assert.strictEqual(report.isDemo, false, 'Report must be marked as Live Audit (isDemo=false)');
  assert.ok(report.mismatchCount >= 3, `Expected at least 3 mismatches, got ${report.mismatchCount}`);

  // Verify finding classifications
  const rateFinding = report.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.strictEqual(rateFinding?.status, 'mismatch');
  assert.strictEqual(rateFinding?.classification, 'Confirmed discrepancy');

  const penalFinding = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.strictEqual(penalFinding?.classification, 'Possible regulatory concern');

  const prepayFinding = report.comparisons.find((c) => c.fieldKey === 'prepaymentCharges');
  assert.strictEqual(prepayFinding?.classification, 'Possible regulatory concern');

  console.log(`  ✓ Comparison report generated:`);
  console.log(`    - Overall Risk Rating: ${report.riskRating}`);
  console.log(`    - Total Mismatches: ${report.mismatchCount}`);
  console.log(`    - Recommendation: ${report.recommendation}`);
  console.log(`    - Recommendation Note: ${report.recommendationNote}\n`);

  // 6. Test Malformed / Empty / Invalid Inputs
  console.log('[Test 6] Testing Malformed File Rejection & Error Handling...');
  // A) Empty text
  const emptyRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType: 'kfs', textContent: 'Too short' }),
  });
  assert.strictEqual(emptyRes.status, 400, 'Short text must return 400');
  const emptyJson = await emptyRes.json();
  assert.ok(emptyJson.error.includes('brief'), 'Error states text is too brief');

  // B) Invalid PDF Magic bytes
  const badPdfRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentType: 'kfs',
      documentName: 'fake.pdf',
      mimeType: 'application/pdf',
      fileBase64: Buffer.from('This is a fake PDF file that does not contain the proper PDF magic bytes at all and is deliberately invalid to test error handling').toString('base64'),
    }),
  });
  assert.strictEqual(badPdfRes.status, 400, 'Invalid PDF must return 400');
  const badPdfJson = await badPdfRes.json();
  assert.ok(badPdfJson.error.includes('%PDF'), 'Error identifies missing %PDF header');
  console.log('  ✓ Deterministic validation correctly rejected empty text and fake PDF.\n');

  // 7. End-to-End Dispute Letter Generation
  console.log('[Test 7] Testing Dispute Clarification Letter Generator...');
  const letterRes = await fetch(`${BASE_URL}/api/generate-lender-inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  });
  assert.strictEqual(letterRes.status, 200, 'Dispute letter generator should return 200');
  const letterJson = await letterRes.json();
  assert.ok(letterJson.subject && letterJson.subject.length > 10, 'Subject generated');
  assert.ok(letterJson.letterBody && letterJson.letterBody.includes('Priya Sharma'), 'Letter body mentions borrower');
  assert.ok(letterJson.letterBody.toLowerCase().includes('rbi') || letterJson.letterBody.toLowerCase().includes('kfs'), 'Letter cites regulatory grounding');
  console.log(`  ✓ Dispute letter generated successfully: "${letterJson.subject}"\n`);

  console.log('========================================================');
  console.log('   ALL 7 END-TO-END AUDIT & PIPELINE TESTS PASSED!');
  console.log('========================================================\n');
}

runE2ETests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
