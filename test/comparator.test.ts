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
import {
  verifySourceSubstantiation,
  matchesNumericToken,
  verifyExcerptInSourceText,
  verifyCitationLocation,
} from '../src/utils/sourceVerifier';

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

runTest('Clean match terms produce undefined finding classification rather than Needs manual verification', () => {
  const cleanReport = compareLoanDocuments(
    DEMO_SCENARIO_CLEAN.kfsDoc,
    DEMO_SCENARIO_CLEAN.sanctionDoc,
    DEMO_SCENARIO_CLEAN.agreementDoc
  );
  assert.strictEqual(cleanReport.matchCount, 9);
  for (const comp of cleanReport.comparisons) {
    assert.strictEqual(comp.status, 'match');
    assert.strictEqual(
      comp.classification,
      undefined,
      `Field ${comp.fieldKey} should not have a finding classification when terms match`
    );
  }
});

runTest('Strict isVerifiedInSource requirement rejects unverified citations when omitted or undefined', () => {
  const docWithOmittedVerification: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      loanAmount: {
        value: 4200000,
        rawText: 'Rs. 42,00,000/-',
        pageClauseRef: 'Page 1, Item 1',
        isVerifiedInSource: undefined, // omitted verification
      },
    },
  };
  const doc2: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      loanAmount: {
        value: 4500000,
        rawText: 'Rs. 45,00,000/-',
        pageClauseRef: 'Page 2, Item 2',
        isVerifiedInSource: true,
      },
    },
  };

  const report = compareLoanDocuments(docWithOmittedVerification, null, doc2);
  const amountComp = report.comparisons.find((c) => c.fieldKey === 'loanAmount');
  assert.strictEqual(amountComp?.status, 'mismatch');
  assert.strictEqual(amountComp?.values.kfs?.isVerifiedInSource, false);
  assert.strictEqual(amountComp?.values.kfs?.pageClauseRef, 'Evidence not verified');
  assert.strictEqual(amountComp?.classification, 'Needs manual verification');
});

runTest('Sanction letter unverified citation triggers Needs manual verification on variance', () => {
  const kfsDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      loanAmount: {
        value: 4200000,
        rawText: 'Rs. 42,00,000/-',
        pageClauseRef: 'Page 1, Item 1',
        isVerifiedInSource: true,
      },
    },
  };
  const sanctionDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.sanctionDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.sanctionDoc.fields,
      loanAmount: {
        value: 4300000,
        rawText: 'Rs. 43,00,000/-',
        pageClauseRef: 'Page reference not detected in document text',
        isVerifiedInSource: false,
      },
    },
  };

  const report = compareLoanDocuments(kfsDoc, sanctionDoc, null);
  const amountComp = report.comparisons.find((c) => c.fieldKey === 'loanAmount');
  assert.strictEqual(amountComp?.status, 'mismatch');
  assert.strictEqual(amountComp?.values.sanctionLetter?.isVerifiedInSource, false);
  assert.strictEqual(amountComp?.classification, 'Needs manual verification');
});

// ---------------------------------------------------------
// 10. REGULATORY STATUS & SOURCE SUBSTANTIATION REGRESSION AUDIT
// ---------------------------------------------------------
console.log('\n[10] Regulatory Status & Source Substantiation Regression Audit:');

runTest('Missing or null isRbiCompliant produces explicit not_assessed state without false compliance assertion', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      penalCharges: {
        value: 'As per bank policy',
        isCompoundedInterest: null,
        isRbiCompliant: null,
        rawText: 'Penal charges applicable as per prevailing bank policy.',
        pageClauseRef: 'Page 2, Item 8',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      penalCharges: {
        value: 'As per bank policy',
        isCompoundedInterest: null,
        isRbiCompliant: null,
        rawText: 'Penal charges applicable as per prevailing bank policy.',
        pageClauseRef: 'Page 3, Clause 12',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const penal = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.ok(penal);
  assert.strictEqual(penal.regulatoryAssessment, 'not_assessed');
  assert.strictEqual(penal.classification, 'Needs manual verification');
  assert.ok(!penal.summary.toLowerCase().includes('follow rbi guidelines'));
  assert.ok(penal.summary.includes('insufficient evidence'));
});

runTest('Missing or null isFloatingNilExempt produces explicit not_assessed state on floating facility', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.kfsDoc.fields.interestRate,
        rateType: 'floating',
      },
      prepaymentCharges: {
        value: 'Prepayment as per schedule',
        hasPenalty: null,
        isFloatingNilExempt: null,
        rawText: 'Prepayment terms apply as per schedule.',
        pageClauseRef: 'Page 2, Item 9',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.interestRate,
        rateType: 'floating',
      },
      prepaymentCharges: {
        value: 'Prepayment as per schedule',
        hasPenalty: null,
        isFloatingNilExempt: null,
        rawText: 'Prepayment terms apply as per schedule.',
        pageClauseRef: 'Page 3, Clause 14',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const prepay = report.comparisons.find((c) => c.fieldKey === 'prepaymentCharges');
  assert.ok(prepay);
  assert.strictEqual(prepay.regulatoryAssessment, 'not_assessed');
  assert.strictEqual(prepay.classification, 'Needs manual verification');
  assert.ok(prepay.summary.includes('Insufficient evidence'));
});

runTest('Contradictory penal charge provisions between KFS and Agreement flag Possible regulatory concern', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      penalCharges: {
        value: '₹500 flat fee per delay',
        isCompoundedInterest: false,
        isRbiCompliant: true,
        rawText: 'Delayed payment penal fee: ₹500 flat per default.',
        pageClauseRef: 'Page 2, Item 8',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      penalCharges: {
        value: '24% compounded monthly',
        isCompoundedInterest: true,
        isRbiCompliant: false,
        rawText: 'Overdue installment subject to 24% p.a. compounded monthly penal interest.',
        pageClauseRef: 'Page 5, Clause 8',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const penal = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.ok(penal);
  assert.strictEqual(penal.status, 'mismatch');
  assert.strictEqual(penal.severity, 'warning');
  assert.strictEqual(penal.classification, 'Possible regulatory concern');
  assert.strictEqual(penal.regulatoryAssessment, 'non_compliant');
  assert.ok(penal.summary.includes('Contradictory penal charge provisions'));
});

runTest('Contradictory prepayment terms between KFS and Agreement flag Possible regulatory concern', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.kfsDoc.fields.interestRate,
        rateType: 'floating',
      },
      prepaymentCharges: {
        value: 'Nil / Zero',
        hasPenalty: false,
        isFloatingNilExempt: true,
        rawText: 'Nil prepayment charges on individual floating loan.',
        pageClauseRef: 'Page 2, Item 9',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.interestRate,
        rateType: 'floating',
      },
      prepaymentCharges: {
        value: '2% prepayment penalty',
        hasPenalty: true,
        isFloatingNilExempt: false,
        rawText: 'A prepayment charge of 2% shall be levied on premature closure.',
        pageClauseRef: 'Page 4, Clause 11',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const prepay = report.comparisons.find((c) => c.fieldKey === 'prepaymentCharges');
  assert.ok(prepay);
  assert.strictEqual(prepay.status, 'mismatch');
  assert.strictEqual(prepay.severity, 'warning');
  assert.strictEqual(prepay.classification, 'Possible regulatory concern');
  assert.strictEqual(prepay.regulatoryAssessment, 'has_penalty');
  assert.ok(prepay.summary.includes('Contradictory prepayment terms'));
});

runTest('Confirmed positive penal compliance produces clean match with compliant status', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      penalCharges: {
        value: '₹350 per month overdue fee',
        isCompoundedInterest: false,
        isRbiCompliant: true,
        rawText: 'Late payment penal charge: ₹350 flat per month. No penal interest compounding.',
        pageClauseRef: 'Page 2, Section 8',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      penalCharges: {
        value: '₹350 per month overdue fee',
        isCompoundedInterest: false,
        isRbiCompliant: true,
        rawText: 'Late payment penal charge: ₹350 flat per month. No penal interest compounding.',
        pageClauseRef: 'Page 2, Section 8',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const penal = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.ok(penal);
  assert.strictEqual(penal.status, 'match');
  assert.strictEqual(penal.severity, 'clean');
  assert.strictEqual(penal.regulatoryAssessment, 'compliant');
  assert.strictEqual(penal.classification, undefined);
});

runTest('Confirmed negative penal non-compliance produces mismatch with non_compliant status', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      penalCharges: {
        value: '24% compounded interest',
        isCompoundedInterest: true,
        isRbiCompliant: false,
        rawText: 'Overdue installment subject to 24% p.a. compounded monthly penal interest.',
        pageClauseRef: 'Page 2, Item 8',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      penalCharges: {
        value: '24% compounded interest',
        isCompoundedInterest: true,
        isRbiCompliant: false,
        rawText: 'Overdue installment subject to 24% p.a. compounded monthly penal interest.',
        pageClauseRef: 'Page 3, Clause 9',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const penal = report.comparisons.find((c) => c.fieldKey === 'penalCharges');
  assert.ok(penal);
  assert.strictEqual(penal.status, 'mismatch');
  assert.strictEqual(penal.severity, 'warning');
  assert.strictEqual(penal.regulatoryAssessment, 'non_compliant');
  assert.strictEqual(penal.classification, 'Possible regulatory concern');
});

runTest('Fixed-rate loan with matching prepayment penalty does not trigger false floating-rate violation', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.kfsDoc.fields.interestRate,
        rateType: 'fixed',
      },
      prepaymentCharges: {
        value: '2% on prepaid amount',
        hasPenalty: true,
        isFloatingNilExempt: false,
        rawText: 'Prepayment penalty of 2% on prepaid amount for fixed-rate personal facility.',
        pageClauseRef: 'Page 2, Clause 11',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.interestRate,
        rateType: 'fixed',
      },
      prepaymentCharges: {
        value: '2% on prepaid amount',
        hasPenalty: true,
        isFloatingNilExempt: false,
        rawText: 'Prepayment penalty of 2% on prepaid amount for fixed-rate personal facility.',
        pageClauseRef: 'Page 3, Clause 15',
        isVerifiedInSource: true,
      },
    },
  };
  const report = compareLoanDocuments(kfs, null, agreement);
  const prepay = report.comparisons.find((c) => c.fieldKey === 'prepaymentCharges');
  assert.ok(prepay);
  assert.strictEqual(prepay.status, 'match');
  assert.strictEqual(prepay.severity, 'clean');
  assert.strictEqual(prepay.classification, undefined);
  assert.ok(prepay.summary.includes('Fixed-rate facility'));
});

runTest('Fabricated pageClauseRef with placeholder source text evaluates to isVerifiedInSource: false', () => {
  const result = verifySourceSubstantiation(4200000, 'Not specified in document', 'Page 4, Clause 2.1', 'loanAmount');
  assert.strictEqual(result.isVerified, false);
  assert.ok(result.reason?.includes('Verbatim excerpt missing'));

  const resultEmpty = verifySourceSubstantiation(4200000, '', 'Page 4, Clause 2.1', 'loanAmount');
  assert.strictEqual(resultEmpty.isVerified, false);
});

runTest('Plausible pageClauseRef with mismatched numeric source text evaluates to isVerifiedInSource: false', () => {
  const resultRate = verifySourceSubstantiation(8.75, 'The applicable interest rate is 10.50% per annum.', 'Page 2, Clause 3', 'interestRate');
  assert.strictEqual(resultRate.isVerified, false);
  assert.ok(resultRate.reason?.includes('does not substantiate'));

  const resultAmt = verifySourceSubstantiation(4200000, 'The Borrower shall pay processing fee of Rs. 5,000.', 'Page 1, Clause 1', 'loanAmount');
  assert.strictEqual(resultAmt.isVerified, false);
  assert.ok(resultAmt.reason?.includes('does not substantiate'));
});

runTest('Supported citation with matching source text and numbers evaluates to source_verified', () => {
  const sampleDocText = `
    Key Facts Statement:
    Applicable rate of interest shall be floating rate of 8.75% per annum.
    Sanctioned facility amount of INR 42,00,000/- (Forty Two Lakhs Only).
    Loan tenure shall be 240 months from first disbursement.
  `;
  const resultRate = verifySourceSubstantiation(8.75, 'Applicable rate of interest shall be floating rate of 8.75% per annum.', 'Page 1, Clause 2.1', 'interestRate', sampleDocText);
  assert.strictEqual(resultRate.isVerified, true);
  assert.strictEqual(resultRate.verificationLevel, 'source_verified');

  const resultAmt = verifySourceSubstantiation(4200000, 'Sanctioned facility amount of INR 42,00,000/- (Forty Two Lakhs Only).', 'Page 1, Schedule A', 'loanAmount', sampleDocText);
  assert.strictEqual(resultAmt.isVerified, true);
  assert.strictEqual(resultAmt.verificationLevel, 'source_verified');

  const resultTenure = verifySourceSubstantiation(240, 'Loan tenure shall be 240 months from first disbursement.', 'Page 2, Item 4', 'tenureMonths', sampleDocText);
  assert.strictEqual(resultTenure.isVerified, true);
  assert.strictEqual(resultTenure.verificationLevel, 'source_verified');
});

// ---------------------------------------------------------
// 11. MULTI-TIER SOURCE VERIFICATION & STRICT MATCHING AUDIT
// ---------------------------------------------------------
console.log('\n[11] Multi-Tier Source Verification & Strict Matching Audit:');

runTest('AI excerpt with plausible citation without source text is marked excerpt_corroborated and isVerified: false', () => {
  const result = verifySourceSubstantiation(
    8.75,
    'Applicable rate of interest shall be floating rate of 8.75% per annum.',
    'Page 1, Clause 2.1',
    'interestRate'
    // sourceText omitted / unavailable
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'excerpt_corroborated');
  assert.ok(result.details?.includes('source document text not independently verified'));
});

runTest('AI excerpt that does not exist in provided source text is marked ai_extracted and fails verification', () => {
  const sourceText = 'Sanction letter for Mr. Sharma. Loan sanctioned is Rs. 40,00,000 at 9.00% p.a.';
  const fabricatedExcerpt = 'Special promotional interest rate of 8.75% per annum approved.';
  const result = verifySourceSubstantiation(
    8.75,
    fabricatedExcerpt,
    'Page 1, Clause 2',
    'interestRate',
    sourceText
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'ai_extracted');
  assert.ok(result.reason?.includes('does not exist in provided document text'));
});

runTest('Strict numeric token boundary: 500 does NOT match inside 5000 or 15000', () => {
  // Test numeric boundary function directly
  assert.strictEqual(matchesNumericToken('Processing fee of Rs 5000', 500), false);
  assert.strictEqual(matchesNumericToken('Late charges of INR 15,000', 500), false);
  assert.strictEqual(matchesNumericToken('Penalty of 50000 INR', 500), false);
  assert.strictEqual(matchesNumericToken('Prepayment fee ₹5,000/-', 500), false);

  // Correct matches
  assert.strictEqual(matchesNumericToken('Processing fee of Rs. 500/-', 500), true);
  assert.strictEqual(matchesNumericToken('Flat ₹500 per month', 500), true);
  assert.strictEqual(matchesNumericToken('Overdue fee of INR 500.00', 500), true);
  assert.strictEqual(matchesNumericToken('Fee is 5,000 INR', 5000), true);

  // Test through verifySourceSubstantiation
  const resSubstring5000 = verifySourceSubstantiation(
    500,
    'Processing fee of Rs. 5,000/- plus applicable taxes.',
    'Page 2, Schedule A',
    'processingFees'
  );
  assert.strictEqual(resSubstring5000.isVerified, false);
  assert.strictEqual(resSubstring5000.verificationLevel, 'unverified');

  const resSubstring15000 = verifySourceSubstantiation(
    500,
    'Late payment penal charge of INR 15,000 fixed.',
    'Page 3, Clause 8',
    'emi'
  );
  assert.strictEqual(resSubstring15000.isVerified, false);
  assert.strictEqual(resSubstring15000.verificationLevel, 'unverified');
});

runTest('Processing fee strictness: word "fee" or "processing" alone without numeric fee fails substantiation', () => {
  const resGenericWord = verifySourceSubstantiation(
    5000,
    'The borrower shall pay standard processing fee and administrative fee.',
    'Page 2, Clause 4',
    'processingFees'
  );
  assert.strictEqual(resGenericWord.isVerified, false);
  assert.strictEqual(resGenericWord.verificationLevel, 'unverified');
  assert.ok(resGenericWord.reason?.includes('does not substantiate'));

  // Exact amount 5000 passes corroboration
  const resExactAmount = verifySourceSubstantiation(
    5000,
    'Flat processing fee of INR 5,000 plus GST.',
    'Page 2, Clause 4',
    'processingFees'
  );
  assert.strictEqual(resExactAmount.verificationLevel, 'excerpt_corroborated');

  // Percentage fee passes corroboration
  const resPercentFee = verifySourceSubstantiation(
    5000,
    'Processing charges at 0.50% of sanctioned loan amount.',
    'Page 2, Clause 4',
    'processingFees'
  );
  assert.strictEqual(resPercentFee.verificationLevel, 'excerpt_corroborated');
});

runTest('Formatted currency, percentages, and tenure correctly match normalized source text', () => {
  const fullDocumentSource = `
    KEY FACTS STATEMENT (KFS)
    Sanctioned Loan Facility: INR 42,00,000/- (Forty-Two Lakhs Only).
    Applicable Interest Rate: 8.75% p.a. (Floating: Repo 6.50% + 2.25%).
    Annual Percentage Rate (APR): 9.15% per annum all inclusive.
    Repayment Tenure: 20 years (240 equated monthly installments).
    Monthly Installment (EMI): ₹37,116 per month.
    Processing Fee: ₹5,000 + 18% GST.
  `;

  // INR Lakhs normalization
  const resAmt = verifySourceSubstantiation(
    4200000,
    'INR 42,00,000/- (Forty-Two Lakhs Only)',
    'Page 1, Table 1',
    'loanAmount',
    fullDocumentSource
  );
  assert.strictEqual(resAmt.isVerified, true);
  assert.strictEqual(resAmt.verificationLevel, 'source_verified');

  // Percentage normalization
  const resRate = verifySourceSubstantiation(
    8.75,
    '8.75% p.a. (Floating: Repo 6.50% + 2.25%)',
    'Page 1, Clause 2',
    'interestRate',
    fullDocumentSource
  );
  assert.strictEqual(resRate.isVerified, true);
  assert.strictEqual(resRate.verificationLevel, 'source_verified');

  // Tenure months to years normalization
  const resTenure = verifySourceSubstantiation(
    240,
    '20 years (240 equated monthly installments)',
    'Page 1, Table 1',
    'tenureMonths',
    fullDocumentSource
  );
  assert.strictEqual(resTenure.isVerified, true);
  assert.strictEqual(resTenure.verificationLevel, 'source_verified');

  // EMI with ₹ symbol and commas
  const resEmi = verifySourceSubstantiation(
    37116,
    '₹37,116 per month',
    'Page 2, Schedule B',
    'emi',
    fullDocumentSource
  );
  assert.strictEqual(resEmi.isVerified, true);
  assert.strictEqual(resEmi.verificationLevel, 'source_verified');
});

runTest('Genuinely supported excerpt present in source text evaluates to source_verified and isVerified: true', () => {
  const sourceText = 'This Agreement confirms the loan amount of ₹42,00,000 sanctioned to the Borrower.';
  const excerpt = 'loan amount of ₹42,00,000 sanctioned';
  const result = verifySourceSubstantiation(
    4200000,
    excerpt,
    'Page 1, Clause 1.1',
    'loanAmount',
    sourceText
  );
  assert.strictEqual(result.isVerified, true);
  assert.strictEqual(result.verificationLevel, 'source_verified');
  assert.strictEqual(result.details, 'Source independently verified in document text');
});

runTest('Scanned or unavailable source text returns explicit unverified-source state (excerpt_corroborated, isVerified: false)', () => {
  const result = verifySourceSubstantiation(
    37116,
    'Equated Monthly Installment (EMI) shall be INR 37,116/- payable by 5th of each month.',
    'Page 2, Clause 4',
    'emi',
    undefined // sourceText unavailable for binary/scanned PDF
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'excerpt_corroborated');
  assert.strictEqual(result.details, 'Excerpt corroborated — source document text not independently verified');
});

// ---------------------------------------------------------
// 12. EVIDENCE VERIFICATION HARDENING & ADVERSARIAL REGRESSION AUDIT
// ---------------------------------------------------------
console.log('\n[12] Evidence Verification Hardening & Adversarial Regression Audit:');

runTest('1. Fabricated long excerpt with matching 40-char prefix fails source verification', () => {
  const sourceText = 'Applicable rate of interest shall be floating rate of 8.75% per annum based on 3-month EBLR.';
  const fabricatedLongExcerpt = 'Applicable rate of interest shall be floating rate of 8.75% with promotional lifetime zero percent interest waiver.';

  // verifyExcerptInSourceText must reject fabricated continuation despite matching prefix
  assert.strictEqual(verifyExcerptInSourceText(fabricatedLongExcerpt, sourceText), false);

  // verifySourceSubstantiation must downgrade to ai_extracted and fail isVerified
  const result = verifySourceSubstantiation(8.75, fabricatedLongExcerpt, 'Page 1, Clause 2', 'interestRate', sourceText);
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'ai_extracted');
  assert.ok(result.reason?.includes('does not exist in provided document text'));
});

runTest('2. Truncated excerpt whose continuation is not present in the source fails verification', () => {
  const sourceText = 'Applicable rate of interest shall be floating rate of 8.75% per annum based on 3-month EBLR.';
  const fabricatedEllipsisExcerpt = 'Applicable rate of interest shall be floating rate of 8.75% ... with zero interest forever';

  // verifyExcerptInSourceText must reject because second segment is missing
  assert.strictEqual(verifyExcerptInSourceText(fabricatedEllipsisExcerpt, sourceText), false);

  const result = verifySourceSubstantiation(8.75, fabricatedEllipsisExcerpt, 'Page 1, Clause 2', 'interestRate', sourceText);
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'ai_extracted');
});

runTest('3. Complete source excerpt with harmless formatting differences passes verification', () => {
  const sourceText = 'KEY FACTS STATEMENT:\n\t“Applicable Rate of Interest” – 8.75% p.a. (floating rate).';
  const excerpt = '"Applicable Rate of Interest" - 8.75% p.a. (floating rate).';

  assert.strictEqual(verifyExcerptInSourceText(excerpt, sourceText), true);

  const result = verifySourceSubstantiation(8.75, excerpt, 'Page 1, Clause 2', 'interestRate', sourceText);
  assert.strictEqual(result.isVerified, true);
  assert.strictEqual(result.verificationLevel, 'source_verified');
});

runTest('4. Plausible but nonexistent page or clause reference fails location verification', () => {
  const sourceWithPagesAndClauses = `
    Page 1
    Clause 1. Loan Facility
    Sanctioned loan amount of INR 42,00,000/-.

    Page 2
    Clause 2. Interest Rate
    Applicable interest rate shall be 8.75% per annum.
  `;

  // Clause 42 does not exist in source text
  const locClauseFail = verifyCitationLocation('Page 2, Clause 42', sourceWithPagesAndClauses);
  assert.strictEqual(locClauseFail.isLocationVerified, false);
  assert.strictEqual(locClauseFail.locationStatus, 'unverified');
  assert.ok(locClauseFail.details.includes('Cited Clause 42 was not found'));

  // Page 99 does not exist in source text
  const locPageFail = verifyCitationLocation('Page 99, Clause 2', sourceWithPagesAndClauses);
  assert.strictEqual(locPageFail.isLocationVerified, false);
  assert.strictEqual(locPageFail.locationStatus, 'unverified');
  assert.ok(locPageFail.details.includes('Cited Page 99 does not exist'));
});

runTest('5. Page reference unverified (unpaginated text) while excerpt itself is present', () => {
  const unpaginatedSource = 'Clause 2. Applicable interest rate shall be 8.75% per annum for retail loan.';
  const excerpt = 'Applicable interest rate shall be 8.75% per annum for retail loan.';

  const locResult = verifyCitationLocation('Page 4', unpaginatedSource);
  assert.strictEqual(locResult.isLocationVerified, false);
  assert.strictEqual(locResult.locationStatus, 'unpaginated_source');
  assert.ok(locResult.details.includes('Document text is unpaginated'));

  const substantiation = verifySourceSubstantiation(8.75, excerpt, 'Page 4', 'interestRate', unpaginatedSource);
  assert.strictEqual(substantiation.isVerified, true);
  assert.strictEqual(substantiation.verificationLevel, 'source_verified');
  assert.strictEqual(substantiation.isLocationVerified, false);
  assert.strictEqual(substantiation.locationStatus, 'unpaginated_source');
});

runTest('6. Correct processing-fee percentage with proper context passes fee corroboration', () => {
  const sourceText = 'The Borrower shall pay upfront processing fee of 0.50% of the sanctioned loan amount plus GST.';
  const excerpt = 'upfront processing fee of 0.50% of the sanctioned loan amount';

  const result = verifySourceSubstantiation(
    5000,
    excerpt,
    'Page 2, Schedule A',
    'processingFees',
    sourceText,
    { percentage: 0.50 }
  );
  assert.strictEqual(result.isVerified, true);
  assert.strictEqual(result.verificationLevel, 'source_verified');
});

runTest('7. Unrelated percentage in an interest-rate sentence fails fee corroboration', () => {
  const excerpt = 'The applicable rate of interest shall be floating rate of 8.75% p.a. with standard fee schedule.';

  const result = verifySourceSubstantiation(
    5000,
    excerpt,
    'Page 1, Clause 2',
    'processingFees',
    null,
    { percentage: 8.75 }
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'unverified');
  assert.ok(result.reason?.includes('does not substantiate'));
});

runTest('8. Mismatched percentage in a processing-fee sentence fails fee corroboration', () => {
  const excerpt = 'Processing charges shall be levied at 1.50% of the sanctioned loan amount.';

  const result = verifySourceSubstantiation(
    5000,
    excerpt,
    'Page 2, Clause 4',
    'processingFees',
    null,
    { percentage: 0.50 }
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'unverified');
});

runTest('9. Insurance keyword without support for extracted amount or mandatory status fails', () => {
  const excerpt = 'Insurance coverage may be availed through the lender’s preferred insurance partner.';

  // Claiming specific premium of 78,000 without numeric support in excerpt
  const resAmount = verifySourceSubstantiation(
    78000,
    excerpt,
    'Page 3, Clause 6',
    'insurance',
    null,
    { isMandatory: false }
  );
  assert.strictEqual(resAmount.isVerified, false);
  assert.strictEqual(resAmount.verificationLevel, 'unverified');
  assert.ok(resAmount.reason?.includes('does not substantiate the extracted premium amount'));

  // Claiming insurance is mandatory when excerpt specifies voluntary/optional status
  const excerptOptional = 'Insurance coverage is optional with zero premium charged on loan.';
  const resMandatory = verifySourceSubstantiation(
    0,
    excerptOptional,
    'Page 3, Clause 6',
    'insurance',
    null,
    { isMandatory: true }
  );
  assert.strictEqual(resMandatory.isVerified, false);
  assert.strictEqual(resMandatory.verificationLevel, 'unverified');
  assert.ok(resMandatory.reason?.includes('does not substantiate claim that insurance is mandatory'));
});

runTest('10. Penal-charge keyword without support for claimed charge or compliance assertion fails', () => {
  const excerpt = 'Default in repayment shall attract penal charges as determined by the lender from time to time.';

  // Claiming specific charge of ₹500 per month without numeric support
  const resCharge = verifySourceSubstantiation(
    '₹500 per month',
    excerpt,
    'Page 3, Clause 8',
    'penalCharges',
    null,
    { isRbiCompliant: false }
  );
  assert.strictEqual(resCharge.isVerified, false);
  assert.strictEqual(resCharge.verificationLevel, 'unverified');

  // Claiming verified RBI compliance (simple flat fee) without evidence of flat structure in excerpt
  const resCompliance = verifySourceSubstantiation(
    'As per bank policy',
    excerpt,
    'Page 3, Clause 8',
    'penalCharges',
    null,
    { isRbiCompliant: true }
  );
  assert.strictEqual(resCompliance.isVerified, false);
  assert.strictEqual(resCompliance.verificationLevel, 'unverified');
  assert.ok(resCompliance.reason?.includes('does not provide evidence of RBI-compliant'));
});

runTest('11. Prepayment keyword without support for claimed penalty or waiver fails', () => {
  const excerpt = 'Prepayment of the loan facility is subject to standard bank rules and procedures.';

  // Claiming penalty of 2% when excerpt has no penalty rate
  const resPenalty = verifySourceSubstantiation(
    '2% penalty',
    excerpt,
    'Page 4, Clause 11',
    'prepaymentCharges',
    null,
    { hasPenalty: true }
  );
  assert.strictEqual(resPenalty.isVerified, false);
  assert.strictEqual(resPenalty.verificationLevel, 'unverified');

  // Claiming nil prepayment waiver when excerpt has no waiver terms
  const resWaiver = verifySourceSubstantiation(
    'Nil / Zero',
    excerpt,
    'Page 4, Clause 11',
    'prepaymentCharges',
    null,
    { hasPenalty: false, isFloatingNilExempt: true }
  );
  assert.strictEqual(resWaiver.isVerified, false);
  assert.strictEqual(resWaiver.verificationLevel, 'unverified');
});

runTest('12. Source text unavailable for a scanned PDF or image stays excerpt_corroborated and isVerified: false', () => {
  const result = verifySourceSubstantiation(
    5000,
    'The borrower shall pay upfront processing fee of Rs. 5,000/- plus applicable GST.',
    'Page 2, Schedule A',
    'processingFees',
    undefined // Scanned/binary PDF without local OCR
  );
  assert.strictEqual(result.isVerified, false);
  assert.strictEqual(result.verificationLevel, 'excerpt_corroborated');
  assert.strictEqual(result.isLocationVerified, false);
  assert.strictEqual(result.locationStatus, 'ai_reported');
  assert.ok(result.details?.includes('source document text not independently verified'));
});

runTest('13. Existing comparator behavior remains conservative when verification data is missing', () => {
  const docMissingVer: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      loanAmount: {
        value: 4200000,
        rawText: 'Loan amount Rs 42 Lakhs',
        pageClauseRef: 'Page reference not detected in document text',
        isVerifiedInSource: false,
        verificationLevel: 'unverified',
      },
    },
  };
  const doc2: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      loanAmount: {
        value: 4500000,
        rawText: 'Loan amount Rs 45 Lakhs',
        pageClauseRef: 'Page 1, Clause 1',
        isVerifiedInSource: true,
        verificationLevel: 'source_verified',
      },
    },
  };

  const report = compareLoanDocuments(docMissingVer, null, doc2);
  const amountComp = report.comparisons.find((c) => c.fieldKey === 'loanAmount');
  assert.strictEqual(amountComp?.status, 'mismatch');
  assert.strictEqual(amountComp?.classification, 'Needs manual verification');
});

runTest('14. Demo-data isolation remains strictly intact', () => {
  const realDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    id: 'real-user-doc-1',
    isDemo: false,
  };
  const demoDoc: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    id: 'demo-doc-1',
    isDemo: true,
  };

  // Cross-audit between real and demo doc must throw
  assert.throws(
    () => compareLoanDocuments(realDoc, null, demoDoc),
    /Data Isolation Violation/
  );

  // Single real document must throw
  assert.throws(
    () => compareLoanDocuments(realDoc, null, null),
    /Insufficient Real Documents/
  );
});

runTest('15. Very short or generic excerpts do not independently establish a source match', () => {
  const sourceText = 'Sanction letter for home loan. Interest rate is 8.75% per annum. Processing fee is 5000.';

  // Generic phrase in GENERIC_EXCERPT_PATTERNS
  assert.strictEqual(verifyExcerptInSourceText('interest rate', sourceText), false);
  assert.strictEqual(verifyExcerptInSourceText('processing fee', sourceText), false);
  assert.strictEqual(verifyExcerptInSourceText('loan amount', sourceText), false);

  // Excerpt shorter than 10 characters
  assert.strictEqual(verifyExcerptInSourceText('8.75%', sourceText), false);
  assert.strictEqual(verifyExcerptInSourceText('5000', sourceText), false);
});

// -------------------------------------------------------------
// 13. FINANCIAL CALCULATIONS, BOUNDARY TOLERANCES & FORMATTING EDGE CASES
// -------------------------------------------------------------
console.log('\n[13] Financial Calculations, Boundary Tolerances & Formatting Edge Cases:');

runTest('1. Missing numeric values (loanAmount 0 or null) are categorized as missing, not formatted as ₹0', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      loanAmount: {
        value: null as any,
        rawText: 'Amount not specified',
        pageClauseRef: 'Page 1, Item 1',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      loanAmount: {
        value: 0 as any,
        rawText: 'Amount: ₹0',
        pageClauseRef: 'Page 1, Clause 1',
        isVerifiedInSource: true,
      },
    },
  };

  const report = compareLoanDocuments(kfs, null, agreement);
  const amountComp = report.comparisons.find((c) => c.fieldKey === 'loanAmount');
  assert.ok(amountComp);
  assert.strictEqual(amountComp.status, 'missing');
  assert.strictEqual(amountComp.values.kfs?.display, 'Not extracted');
  assert.strictEqual(amountComp.values.loanAgreement?.display, 'Not extracted');
});

runTest('2. Valid zero values for insurance and processing fees format as waived/voluntary and match', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.kfsDoc.fields,
      processingFees: {
        value: 0,
        rawText: 'Processing fee: Nil (Festival waiver)',
        pageClauseRef: 'Page 1, Fee Schedule',
        isVerifiedInSource: true,
      },
      insurance: {
        value: 0,
        isMandatory: false,
        rawText: 'Insurance: Optional / None opted',
        pageClauseRef: 'Page 2, Item 7',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      processingFees: {
        value: 0,
        rawText: 'Processing fee: Waived',
        pageClauseRef: 'Page 2, Clause 4',
        isVerifiedInSource: true,
      },
      insurance: {
        value: 0,
        isMandatory: false,
        rawText: 'Insurance: ₹0',
        pageClauseRef: 'Page 3, Clause 8',
        isVerifiedInSource: true,
      },
    },
  };

  const report = compareLoanDocuments(kfs, null, agreement);
  const feeComp = report.comparisons.find((c) => c.fieldKey === 'processingFees');
  const insComp = report.comparisons.find((c) => c.fieldKey === 'insurance');

  assert.ok(feeComp);
  assert.strictEqual(feeComp.status, 'match');
  assert.strictEqual(feeComp.values.kfs?.display, '₹0 (Nil / Waived)');
  assert.strictEqual(feeComp.values.loanAgreement?.display, '₹0 (Nil / Waived)');

  assert.ok(insComp);
  assert.strictEqual(insComp.status, 'match');
  assert.strictEqual(insComp.values.kfs?.display, '₹0 (None / Voluntary)');
  assert.strictEqual(insComp.values.loanAgreement?.display, '₹0 (None / Voluntary)');
});

runTest('3. Interest rate tolerance boundary: diff <= 0.05% matches, diff > 0.05% mismatches', () => {
  const baseKfs = DEMO_SCENARIO_CLEAN.kfsDoc; // Rate = 11.50%

  // Case A: 11.50% vs 11.53% (0.03% difference -> within 0.05% tolerance)
  const agreementWithinTol: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.interestRate,
        value: 11.53,
      },
    },
  };
  const reportWithin = compareLoanDocuments(baseKfs, null, agreementWithinTol);
  const rateWithin = reportWithin.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.strictEqual(rateWithin?.status, 'match', 'Difference <= 0.05% must match within tolerance');

  // Case B: 11.50% vs 11.58% (0.08% difference -> exceeds tolerance)
  const agreementExceedsTol: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      interestRate: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.interestRate,
        value: 11.58,
      },
    },
  };
  const reportExceeds = compareLoanDocuments(baseKfs, null, agreementExceedsTol);
  const rateExceeds = reportExceeds.comparisons.find((c) => c.fieldKey === 'interestRate');
  assert.strictEqual(rateExceeds?.status, 'mismatch', 'Difference > 0.05% must flag mismatch');
  assert.strictEqual(rateExceeds?.severity, 'critical');
});

runTest('4. EMI tolerance boundary: diff <= ₹50 matches, diff > ₹50 mismatches', () => {
  const baseKfs = DEMO_SCENARIO_CLEAN.kfsDoc; // EMI = 16,490

  // Case A: 16,490 vs 16,520 (₹30 difference -> within ₹50 tolerance)
  const agreementWithinTol: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      emi: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.emi,
        value: 16520,
      },
    },
  };
  const reportWithin = compareLoanDocuments(baseKfs, null, agreementWithinTol);
  const emiWithin = reportWithin.comparisons.find((c) => c.fieldKey === 'emi');
  assert.strictEqual(emiWithin?.status, 'match', 'EMI diff <= ₹50 must match within rounding tolerance');

  // Case B: 16,490 vs 16,580 (₹90 difference -> exceeds tolerance)
  const agreementExceedsTol: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_CLEAN.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_CLEAN.agreementDoc.fields,
      emi: {
        ...DEMO_SCENARIO_CLEAN.agreementDoc.fields.emi,
        value: 16580,
      },
    },
  };
  const reportExceeds = compareLoanDocuments(baseKfs, null, agreementExceedsTol);
  const emiExceeds = reportExceeds.comparisons.find((c) => c.fieldKey === 'emi');
  assert.strictEqual(emiExceeds?.status, 'mismatch', 'EMI diff > ₹50 must flag mismatch');
  assert.strictEqual(emiExceeds?.severity, 'critical');
  assert.ok(emiExceeds?.financialImpact?.includes('totals ₹3,240'));
});

runTest('5. Lifetime financial calculation yields explicit limitation when tenure is missing', () => {
  const kfs: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_DISCREPANCY.kfsDoc,
    fields: {
      ...DEMO_SCENARIO_DISCREPANCY.kfsDoc.fields,
      tenureMonths: {
        value: null as any,
        rawText: 'Tenure not stated',
        pageClauseRef: 'Page 1, Clause 3',
        isVerifiedInSource: true,
      },
    },
  };
  const agreement: ExtractedLoanDocument = {
    ...DEMO_SCENARIO_DISCREPANCY.agreementDoc,
    fields: {
      ...DEMO_SCENARIO_DISCREPANCY.agreementDoc.fields,
      tenureMonths: {
        value: 0 as any,
        rawText: 'Tenure: 0',
        pageClauseRef: 'Page 2, Clause 5',
        isVerifiedInSource: true,
      },
    },
  };

  const report = compareLoanDocuments(kfs, null, agreement);
  const emiComp = report.comparisons.find((c) => c.fieldKey === 'emi');
  assert.ok(emiComp);
  assert.strictEqual(emiComp.financialImpact, 'Insufficient information to estimate');
  assert.ok(emiComp.calculationAssumptions?.[0].includes('Tenure is required'));
});

console.log(`\n========================================`);
console.log(`All ${passedTests} of ${totalTests} Comprehensive Quality & Audit Tests Passed!`);
console.log(`========================================\n`);

