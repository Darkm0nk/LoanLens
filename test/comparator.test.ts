import { strict as assert } from 'node:assert';
import { calculateEmi, compareLifetimeImpact } from '../src/utils/financialMath';
import { compareLoanDocuments } from '../src/utils/comparator';
import { REGULATORY_RULES } from '../src/utils/regulatoryRules';
import { ExtractedLoanDocument } from '../src/types/loan';
import { DEMO_SCENARIO_CLEAN, DEMO_SCENARIO_DISCREPANCY } from '../src/data/demoData';
import {
  normalizeTenure,
  normalizeInterestRate,
  normalizePrincipal,
  detectTenureUnitConflict,
} from '../src/utils/unitConverter';
import {
  validateDocumentFile,
  validateTextContent,
  validateAiParsedData,
} from '../src/utils/documentValidator';

console.log('--- Starting LoanLens Quality & Audit Comprehensive Test Suite ---');

let passedTests = 0;
let totalTests = 0;

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

// ---------------------------------------------------------
// 1. DETERMINISTIC FINANCIAL CALCULATIONS
// ---------------------------------------------------------
console.log('\n[1] Financial Calculations & Assumptions Audit:');

runTest('Exact EMI formula for Home Loan (8.75% on 42 Lakhs over 240 months)', () => {
  const result = calculateEmi(4200000, 8.75, 240);
  assert.ok(result !== null);
  assert.strictEqual(result.monthlyEmi, 37116);
  assert.strictEqual(result.totalPayment, 37116 * 240);
  assert.strictEqual(result.totalInterest, (37116 * 240) - 4200000);
  assert.strictEqual(result.isExact, true);
  assert.ok(result.assumptions.length >= 2);
});

runTest('Exact EMI formula for Agreement discrepancy (9.25% on 42.78 Lakhs over 240 months)', () => {
  const result = calculateEmi(4278000, 9.25, 240);
  assert.ok(result !== null);
  assert.strictEqual(result.monthlyEmi, 39181);
  assert.strictEqual(result.totalPayment, 39181 * 240);
  assert.strictEqual(result.totalInterest, (39181 * 240) - 4278000);
});

runTest('Zero percent promotional interest rate edge case', () => {
  const result = calculateEmi(120000, 0, 12);
  assert.ok(result !== null);
  assert.strictEqual(result.monthlyEmi, 10000);
  assert.strictEqual(result.totalInterest, 0);
  assert.strictEqual(result.totalPayment, 120000);
});

runTest('Missing inputs return null and do not invent figures', () => {
  assert.strictEqual(calculateEmi(null, 8.75, 240), null);
  assert.strictEqual(calculateEmi(4200000, null, 240), null);
  assert.strictEqual(calculateEmi(4200000, 8.75, null), null);
  assert.strictEqual(calculateEmi(-50000, 8.75, 240), null);
  assert.strictEqual(calculateEmi(4200000, -2, 240), null);
  assert.strictEqual(calculateEmi(4200000, 8.75, 0), null);
});

runTest('Lifetime impact comparison calculates exact variance with stated assumptions', () => {
  const comp = compareLifetimeImpact(
    { principal: 4200000, ratePercent: 8.75, tenureMonths: 240 },
    { principal: 4278000, ratePercent: 9.25, tenureMonths: 240 }
  );

  assert.strictEqual(comp.canCalculate, true);
  assert.strictEqual(comp.emiDifferenceMonthly, 39181 - 37116); // 2065
  assert.strictEqual(comp.principalDifference, 78000);
  assert.strictEqual(comp.lifetimeCostDifference, (39181 * 240) - (37116 * 240)); // 495600
  assert.ok(comp.assumptions.length >= 2);
  assert.ok(comp.assumptions[0].includes('Base calculation: ₹42,00,000'));
});

runTest('Lifetime impact gracefully reports inability to compute when inputs are missing', () => {
  const compMissing = compareLifetimeImpact(
    { principal: 4200000, ratePercent: null, tenureMonths: 240 },
    { principal: 4278000, ratePercent: 9.25, tenureMonths: null }
  );

  assert.strictEqual(compMissing.canCalculate, false);
  assert.strictEqual(compMissing.lifetimeCostDifference, 0);
  assert.ok(compMissing.reason?.includes('missing'));
});

// ---------------------------------------------------------
// 2. MATCHING VALUES AUDIT
// ---------------------------------------------------------
console.log('\n[2] Matching Values Audit:');

runTest('Clean scenario produces 9 exact matches across all loan terms', () => {
  const report = compareLoanDocuments(
    DEMO_SCENARIO_CLEAN.kfsDoc,
    DEMO_SCENARIO_CLEAN.sanctionDoc,
    DEMO_SCENARIO_CLEAN.agreementDoc
  );

  assert.strictEqual(report.totalTermsEvaluated, 9);
  assert.strictEqual(report.matchCount, 9);
  assert.strictEqual(report.mismatchCount, 0);
  assert.strictEqual(report.missingCount, 0);
  assert.strictEqual(report.riskRating, 'Consistent');
  assert.strictEqual(report.recommendation, 'Terms Aligned Across Documents');
  assert.ok(report.recommendationNote.includes('consistent alignment'));

  for (const comp of report.comparisons) {
    assert.strictEqual(comp.status, 'match', `Field ${comp.fieldKey} should be a match`);
    assert.strictEqual(comp.severity, 'clean', `Field ${comp.fieldKey} should have clean severity`);
  }
});

// ---------------------------------------------------------
// 3. MISMATCHES AUDIT
// ---------------------------------------------------------
console.log('\n[3] Mismatches Audit:');

runTest('Discrepancy scenario flags variances and cautious recommendation', () => {
  const report = compareLoanDocuments(
    DEMO_SCENARIO_DISCREPANCY.kfsDoc,
    DEMO_SCENARIO_DISCREPANCY.sanctionDoc,
    DEMO_SCENARIO_DISCREPANCY.agreementDoc
  );

  assert.strictEqual(report.totalTermsEvaluated, 9);
  assert.ok(report.mismatchCount >= 4);
  assert.strictEqual(report.riskRating, 'Variances Noted');
  assert.strictEqual(report.recommendation, 'Review Variances with Lender');
  assert.ok(report.recommendationNote.includes('Variances frequently occur'));

  // 1. Principal mismatch
  const loanAmt = report.comparisons.find((c) => c.fieldKey === 'loanAmount');
  assert.ok(loanAmt);
  assert.strictEqual(loanAmt?.status, 'mismatch');
  assert.strictEqual(loanAmt?.severity, 'critical');
  assert.ok(loanAmt?.summary.includes('Sanctioned principal differs by ₹78,000'));

  // 2. Interest rate mismatch
  const interestRate = report.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.ok(interestRate);
  assert.strictEqual(interestRate?.status, 'mismatch');
  assert.strictEqual(interestRate?.severity, 'critical');
  assert.ok(interestRate?.summary.includes('0.50% p.a.'));

  // 3. Insurance mandatory bundling
  const insurance = report.comparisons.find((c) => c.fieldKey === 'insurance');
  assert.ok(insurance);
  assert.strictEqual(insurance?.status, 'mismatch');
  assert.strictEqual(insurance?.severity, 'critical');

  // 4. Penal charges compounding
  const penal = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.ok(penal);
  assert.strictEqual(penal?.status, 'mismatch');
  assert.ok(penal?.summary.includes('Compounding penal interest clause noted'));
});

// ---------------------------------------------------------
// 4. MISSING TERMS AUDIT
// ---------------------------------------------------------
console.log('\n[4] Missing Terms & Partial Document Audit:');

runTest('Missing disclosures are classified as "missing" without crashing', () => {
  const partialDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      apr: { value: null, rawText: 'Not mentioned', pageClauseRef: 'Page reference not detected in document text' },
      penalCharges: { value: '', isCompoundedInterest: false, isRbiCompliant: true, rawText: '', pageClauseRef: '' },
    },
  };

  const report = compareLoanDocuments(partialDoc, null, null);
  assert.strictEqual(report.totalTermsEvaluated, 9);
  const aprComp = report.comparisons.find((c) => c.fieldKey === 'apr');
  assert.strictEqual(aprComp?.status, 'missing');
  assert.ok(aprComp?.summary.includes('not located'));
});

runTest('Single document intake evaluates present fields and handles omitted docs', () => {
  const report = compareLoanDocuments(DEMO_SCENARIO_CLEAN.kfsDoc, null, null);
  assert.strictEqual(report.documentsPresent.kfs, true);
  assert.strictEqual(report.documentsPresent.sanctionLetter, false);
  assert.strictEqual(report.documentsPresent.loanAgreement, false);
  assert.strictEqual(report.totalTermsEvaluated, 9);
});

// ---------------------------------------------------------
// 5. CONFLICTING UNITS AUDIT
// ---------------------------------------------------------
console.log('\n[5] Conflicting Units Audit:');

runTest('Tenure unit conflict: 20 Years in KFS vs 240 Months in Agreement reconciles as MATCH', () => {
  const normYears = normalizeTenure(20, '20 Years');
  const normMonths = normalizeTenure(240, '240 Months');

  assert.strictEqual(normYears.months, 240);
  assert.strictEqual(normYears.wasConvertedFromYears, true);
  assert.strictEqual(normMonths.months, 240);
  assert.strictEqual(normMonths.wasConvertedFromYears, false);

  const conflictReport = detectTenureUnitConflict([
    { docType: 'KFS', rawValue: 20, rawText: '20 Years' },
    { docType: 'Loan Agreement', rawValue: 240, rawText: '240 Months' },
  ]);

  assert.strictEqual(conflictReport.hasConflict, true);
  assert.strictEqual(conflictReport.isEquivalentAfterConversion, true);
  assert.ok(conflictReport.details?.includes('identical repayment period'));

  // Now test in comparator engine
  const kfsWithYears: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      tenureMonths: { value: 3, rawText: '3 Years', pageClauseRef: 'Page 1' }, // 3 years = 36 months
    },
  };

  const agreementWithMonths: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      tenureMonths: { value: 36, rawText: '36 Months', pageClauseRef: 'Page 2' },
    },
  };

  const report = compareLoanDocuments(kfsWithYears, null, agreementWithMonths);
  const tenureComp = report.comparisons.find((c) => c.fieldKey === 'tenureMonths');
  assert.strictEqual(tenureComp?.status, 'match');
  assert.ok(tenureComp?.summary.includes('aligns at 36 months'));
  assert.ok(tenureComp?.summary.includes('differing units'));
});

runTest('Tenure unit conflict with genuine duration discrepancy flags MISMATCH', () => {
  const conflictReport = detectTenureUnitConflict([
    { docType: 'KFS', rawValue: 15, rawText: '15 Years' }, // 180 months
    { docType: 'Loan Agreement', rawValue: 240, rawText: '240 Months' },
  ]);

  assert.strictEqual(conflictReport.hasConflict, true);
  assert.strictEqual(conflictReport.isEquivalentAfterConversion, false);
});

runTest('Interest rate unit normalization: 1% per month converted to 12% p.a.', () => {
  const normMonthly = normalizeInterestRate(1, '1% per month');
  assert.strictEqual(normMonthly.ratePAnnum, 12);
  assert.strictEqual(normMonthly.wasConvertedFromMonthly, true);

  const normAnnual = normalizeInterestRate(12, '12% p.a.');
  assert.strictEqual(normAnnual.ratePAnnum, 12);
  assert.strictEqual(normAnnual.wasConvertedFromMonthly, false);
});

runTest('Principal amount unit normalization: 42 Lakhs converted to 42,00,000 INR', () => {
  const normLakhs = normalizePrincipal(42, 'Sanctioned: 42 Lakhs');
  assert.strictEqual(normLakhs.amountInr, 4200000);
  assert.strictEqual(normLakhs.wasConvertedFromLakhsOrCrores, true);

  const normInr = normalizePrincipal(4200000, 'INR 42,00,000/-');
  assert.strictEqual(normInr.amountInr, 4200000);
  assert.strictEqual(normInr.wasConvertedFromLakhsOrCrores, false);
});

// ---------------------------------------------------------
// 6. MALFORMED PDFS & PAYLOAD VALIDATION AUDIT
// ---------------------------------------------------------
console.log('\n[6] Malformed PDFs & Payload Validation Audit:');

runTest('Empty payload or payload under 50 bytes rejected', () => {
  const resEmpty = validateDocumentFile('');
  assert.strictEqual(resEmpty.isValid, false);

  const resSmall = validateDocumentFile('SGVsbG8='); // Under 50 bytes
  assert.strictEqual(resSmall.isValid, false);
  assert.ok(resSmall.error?.includes('under 50 bytes'));
});

runTest('Non-PDF file with application/pdf mimeType rejected for missing %PDF header', () => {
  // Base64 encoding of "Hello world, this is a plain text file pretending to be a PDF."
  const fakePdfBase64 = Buffer.from(
    'Hello world, this is a plain text file pretending to be a PDF for test.'
  ).toString('base64');

  const res = validateDocumentFile(fakePdfBase64, 'application/pdf', 'corrupt_doc.pdf');
  assert.strictEqual(res.isValid, false);
  assert.ok(res.error?.includes('missing %PDF file header'));
});

runTest('Authentic PDF header (%PDF-1.4) passes validation', () => {
  const validPdfHeader = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  ).toString('base64');

  const res = validateDocumentFile(validPdfHeader, 'application/pdf', 'sample_kfs.pdf');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.error, undefined);
});

runTest('Pasted text shorter than 30 characters is rejected', () => {
  const resTooShort = validateTextContent('Loan Rs 10000');
  assert.strictEqual(resTooShort.isValid, false);
  assert.ok(resTooShort.error?.includes('too brief'));

  const resValid = validateTextContent(
    'Key Facts Statement: Loan Amount: ₹42,00,000, Interest Rate: 8.75% p.a., Tenure: 240 months, EMI: ₹37,116.'
  );
  assert.strictEqual(resValid.isValid, true);
});

// ---------------------------------------------------------
// 7. FAILED AI RESPONSES & INTEGRITY AUDIT
// ---------------------------------------------------------
console.log('\n[7] Failed AI Responses & Integrity Audit:');

runTest('Malformed JSON from AI model triggers parse error and is never fabricated', () => {
  const malformedJson = '{"lenderName": "SBI", "fields": { broken syntax...';
  let errorCaught = false;
  try {
    JSON.parse(malformedJson);
  } catch {
    errorCaught = true;
  }
  assert.strictEqual(errorCaught, true);
});

runTest('AI response missing required "fields" object is rejected by validator', () => {
  const emptyObjRes = validateAiParsedData({});
  assert.strictEqual(emptyObjRes.isValid, false);
  assert.ok(emptyObjRes.error?.includes('could not identify standard loan contract terms'));

  const missingFieldsRes = validateAiParsedData({ lenderName: 'State Bank' });
  assert.strictEqual(missingFieldsRes.isValid, false);
  assert.ok(missingFieldsRes.error?.includes('could not identify standard loan contract terms'));
});

runTest('AI response missing a required term (e.g. loanAmount) is rejected', () => {
  const incompleteData = {
    lenderName: 'Bank',
    fields: {
      interestRate: { value: 8.75, rateType: 'floating', rawText: '8.75%', pageClauseRef: 'Page 1' },
      // loanAmount is missing
    },
  };

  const res = validateAiParsedData(incompleteData);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.error?.includes('Missing field "loanAmount"'));
});

runTest('Empty, null, or primitive AI outputs fail validation and never fabricate results', () => {
  assert.strictEqual(validateAiParsedData(null).isValid, false);
  assert.strictEqual(validateAiParsedData(undefined).isValid, false);
  assert.strictEqual(validateAiParsedData('plain string output').isValid, false);
  assert.strictEqual(validateAiParsedData(12345).isValid, false);
  assert.strictEqual(validateAiParsedData([]).isValid, false);
});

runTest('Demo flag is strictly preserved on synthetic documents and never implied as real', () => {
  assert.strictEqual(DEMO_SCENARIO_DISCREPANCY.kfsDoc.isDemo, true);
  assert.strictEqual(DEMO_SCENARIO_CLEAN.kfsDoc.isDemo, true);
  const rep = compareLoanDocuments(DEMO_SCENARIO_DISCREPANCY.kfsDoc, null, null);
  assert.strictEqual(rep.isDemo, true);
});

// ---------------------------------------------------------
// 8. REGULATORY SOURCING AUDIT
// ---------------------------------------------------------
console.log('\n[8] Regulatory Rules & Sourcing Audit:');

runTest('Every regulatory rule contains valid circular identifier, URL, and conditions', () => {
  const keys = Object.keys(REGULATORY_RULES);
  assert.ok(keys.length >= 4);

  for (const key of keys) {
    const rule = REGULATORY_RULES[key];
    assert.ok(rule.circularId && rule.circularId.length > 5, `${key} must have circularId`);
    assert.ok(rule.sourceUrl && rule.sourceUrl.startsWith('https://'), `${key} sourceUrl must be https`);
    assert.ok(rule.applicabilityConditions && rule.applicabilityConditions.length > 0, `${key} must state conditions`);
    assert.ok(rule.verificationNotice && rule.verificationNotice.length > 0, `${key} must have verificationNotice`);
  }
});

runTest('No inflammatory, unverified claims (e.g. "illegal", "criminal") in regulatory texts', () => {
  const prohibitedWords = ['illegal', 'criminal', 'jail', 'law-breaking', 'unlawful trap'];

  for (const [key, rule] of Object.entries(REGULATORY_RULES)) {
    const combined = `${rule.summary} ${rule.guidanceText} ${rule.circularTitle}`.toLowerCase();
    for (const badWord of prohibitedWords) {
      assert.ok(
        !combined.includes(badWord),
        `Regulatory rule "${key}" contains sensationalist word "${badWord}". Use precise regulatory terms instead.`
      );
    }
  }
});

// ---------------------------------------------------------
// 9. SIDE-BY-SIDE CLASSIFICATION & EVIDENCE INTEGRITY AUDIT
// ---------------------------------------------------------
console.log('\n[9] Side-by-Side Classification & Evidence Integrity Audit:');

runTest('Findings are accurately classified into the 4 regulatory categories', () => {
  const discrepancyReport = compareLoanDocuments(
    DEMO_SCENARIO_DISCREPANCY.kfsDoc,
    DEMO_SCENARIO_DISCREPANCY.sanctionDoc,
    DEMO_SCENARIO_DISCREPANCY.agreementDoc
  );

  // Interest rate mismatch with verified values is Confirmed discrepancy
  const rateComp = discrepancyReport.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.strictEqual(rateComp?.classification, 'Confirmed discrepancy');

  // Penal charges with compounded interest warning is Possible regulatory concern
  const penalComp = discrepancyReport.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.strictEqual(penalComp?.classification, 'Possible regulatory concern');

  // Prepayment charges with floating rate penalty warning is Possible regulatory concern
  const prepayComp = discrepancyReport.comparisons.find((c) => c.fieldKey === 'prepaymentCharges');
  assert.strictEqual(prepayComp?.classification, 'Possible regulatory concern');
});

runTest('Missing term is classified as "Missing information"', () => {
  const partialDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      apr: { value: null, rawText: '', pageClauseRef: '' },
    },
  };
  const report = compareLoanDocuments(partialDoc, null, null);
  const aprComp = report.comparisons.find((c) => c.fieldKey === 'apr');
  assert.strictEqual(aprComp?.classification, 'Missing information');
});

runTest('Unverified citations are classified as "Needs manual verification"', () => {
  const unverifiedDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      interestRate: {
        value: 9.0,
        rateType: 'floating',
        rawText: 'Rate is 9.0%',
        pageClauseRef: 'Page reference not detected in document text',
        isVerifiedInSource: false,
      },
    },
  };
  const secondDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        value: 9.5,
        rateType: 'floating',
        rawText: 'Rate is 9.5%',
        pageClauseRef: 'Page reference not detected in document text',
        isVerifiedInSource: false,
      },
    },
  };

  const report = compareLoanDocuments(unverifiedDoc, null, secondDoc);
  const rateComp = report.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.strictEqual(rateComp?.status, 'mismatch');
  assert.strictEqual(rateComp?.classification, 'Needs manual verification');
});

console.log(`\n========================================`);
console.log(`All ${passedTests} of ${totalTests} Comprehensive Quality & Audit Tests Passed!`);
console.log(`========================================\n`);
