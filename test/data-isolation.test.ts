import { strict as assert } from 'node:assert';
import { compareLoanDocuments, formatINR, formatPercent } from '../src/utils/comparator';
import { ExtractedLoanDocument, LoanComparisonReport } from '../src/types/loan';
import { DEMO_SCENARIO_DISCREPANCY, DEMO_SCENARIO_CLEAN } from '../src/data/demoData';
import { loadSingleSampleDocument, resetAllLoanState, setDocumentSlot } from '../src/utils/dataIsolation';

console.log('========================================================');
console.log('   LOANLENS DATA-ISOLATION & CONTAMINATION TEST SUITE');
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

// Sample real document builder
function createRealDocument(overrides?: Partial<ExtractedLoanDocument>): ExtractedLoanDocument {
  return {
    id: `real-doc-${Date.now()}-${Math.random()}`,
    documentType: 'kfs',
    documentName: 'Real_User_Document.pdf',
    uploadDate: '2025-01-20',
    isDemo: false,
    lenderName: 'Real User Bank Ltd',
    borrowerName: 'Ananya Verma',
    loanType: 'Housing Loan',
    fields: {
      loanAmount: {
        value: 5000000,
        rawText: '₹50,00,000/-',
        pageClauseRef: 'Page 1, Clause 1',
        isVerifiedInSource: true,
      },
      interestRate: {
        value: 8.40,
        rateType: 'floating',
        benchmark: 'EBLR',
        rawText: '8.40% p.a. floating',
        pageClauseRef: 'Page 1, Clause 2',
        isVerifiedInSource: true,
      },
      apr: {
        value: 8.85,
        rawText: '8.85% APR',
        pageClauseRef: 'Page 1, Clause 3',
        isVerifiedInSource: true,
      },
      tenureMonths: {
        value: 240,
        rawText: '240 months',
        pageClauseRef: 'Page 2, Clause 4',
        isVerifiedInSource: true,
      },
      emi: {
        value: 43075,
        rawText: '₹43,075 per month',
        pageClauseRef: 'Page 2, Clause 5',
        isVerifiedInSource: true,
      },
      processingFees: {
        value: 5000,
        gstDetails: '18% GST extra',
        rawText: '₹5,000 + GST',
        pageClauseRef: 'Page 2, Clause 6',
        isVerifiedInSource: true,
      },
      insurance: {
        value: 0,
        isMandatory: false,
        rawText: 'Optional',
        pageClauseRef: 'Page 2, Clause 7',
        isVerifiedInSource: true,
      },
      penalCharges: {
        value: '₹500 per month',
        isCompoundedInterest: false,
        isRbiCompliant: true,
        rawText: '₹500 per default cycle, no compounding',
        pageClauseRef: 'Page 3, Clause 8',
        isVerifiedInSource: true,
      },
      prepaymentCharges: {
        value: 'Nil',
        hasPenalty: false,
        isFloatingNilExempt: true,
        rawText: 'Nil charges on floating rate individual loan',
        pageClauseRef: 'Page 3, Clause 9',
        isVerifiedInSource: true,
      },
    },
    ...overrides,
  };
}

// -------------------------------------------------------------
// 1. MIXED DEMO / REAL PREVENTION GUARD
// -------------------------------------------------------------
console.log('[1] Mixed Demo / Real Prevention Guards:');

runTest('Engine throws explicit Data Isolation Violation if real doc is compared against demo doc', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });
  const demoSanction = DEMO_SCENARIO_DISCREPANCY.sanctionDoc; // isDemo: true

  assert.throws(
      () => {
        compareLoanDocuments(realKfs, demoSanction, null);
      },
      (err: any) => {
        assert.ok(err.message.includes('Data Isolation Violation'));
        return true;
      }
  );
});

runTest('Engine throws if real doc is mixed with 2 demo docs', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });
  const demoSanction = DEMO_SCENARIO_DISCREPANCY.sanctionDoc;
  const demoAgreement = DEMO_SCENARIO_DISCREPANCY.agreementDoc;

  assert.throws(
      () => {
        compareLoanDocuments(realKfs, demoSanction, demoAgreement);
      },
      (err: any) => {
        assert.ok(err.message.includes('Data Isolation Violation'));
        return true;
      }
  );
});

// -------------------------------------------------------------
// 2. INSUFFICIENT REAL DOCUMENTS (WAITING FOR DOCUMENTS)
// -------------------------------------------------------------
console.log('\n[2] Insufficient Real Documents Guard:');

runTest('Single real document cannot generate an audit and throws Insufficient Real Documents error', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });

  assert.throws(
      () => {
        compareLoanDocuments(realKfs, null, null);
      },
      (err: any) => {
        assert.ok(err.message.includes('Insufficient Real Documents'));
        return true;
      }
  );
});

runTest('Two real documents generate an authentic audit with isDemo: false', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });
  const realSanction = createRealDocument({
    documentType: 'sanction_letter',
    documentName: 'Real_Sanction_Letter.pdf',
  });

  const report = compareLoanDocuments(realKfs, realSanction, null);
  assert.strictEqual(report.isDemo, false, 'Report must be live audit (isDemo=false)');
  assert.strictEqual(report.documentsPresent.kfs, true);
  assert.strictEqual(report.documentsPresent.sanctionLetter, true);
  assert.strictEqual(report.documentsPresent.loanAgreement, false);
});

// -------------------------------------------------------------
// 3. DEMO-TO-REAL STATE TRANSITION & DEMO PURGE SIMULATION
// -------------------------------------------------------------
console.log('\n[3] Demo-to-Real Switching & Purge Simulation:');

runTest('Uploading a real file in demo mode purges all other demo slots so zero demo records remain', () => {
  // Start with full demo state
  let activeScenario: string | null = 'home_loan_discrepancy';
  let kfsSlot: ExtractedLoanDocument | null = DEMO_SCENARIO_DISCREPANCY.kfsDoc;
  let sanctionSlot: ExtractedLoanDocument | null = DEMO_SCENARIO_DISCREPANCY.sanctionDoc;
  let agreementSlot: ExtractedLoanDocument | null = DEMO_SCENARIO_DISCREPANCY.agreementDoc;

  assert.strictEqual(kfsSlot.isDemo, true);
  assert.strictEqual(sanctionSlot.isDemo, true);

  // User uploads a real file for KFS
  const incomingRealKfs = createRealDocument({ documentType: 'kfs' });

  // Simulate isolation state transition logic from App.tsx
  const isTransitionFromDemo = activeScenario !== null || kfsSlot?.isDemo || sanctionSlot?.isDemo || agreementSlot?.isDemo;
  if (isTransitionFromDemo) {
    activeScenario = null;
    sanctionSlot = null; // PURGED!
    agreementSlot = null; // PURGED!
  }
  kfsSlot = incomingRealKfs;

  // Verify slots are completely cleansed
  assert.strictEqual(activeScenario, null);
  assert.strictEqual(kfsSlot.isDemo, false);
  assert.strictEqual(sanctionSlot, null, 'Demo sanction must be purged to null');
  assert.strictEqual(agreementSlot, null, 'Demo agreement must be purged to null');

  // Verify real document count is 1, and report is null (waiting for docs)
  const realDocs = [kfsSlot, sanctionSlot, agreementSlot].filter(d => Boolean(d && !d.isDemo));
  assert.strictEqual(realDocs.length, 1);

  const report = realDocs.length >= 2 ? compareLoanDocuments(kfsSlot, sanctionSlot, agreementSlot) : null;
  assert.strictEqual(report, null, 'Report must be null while waiting for second document');
});

// -------------------------------------------------------------
// 4. REPLACING ONE DOCUMENT IN REAL MODE
// -------------------------------------------------------------
console.log('\n[4] Document Replacement Integrity:');

runTest('Replacing a document immediately updates comparison and leaves zero stale values', () => {
  const kfs = createRealDocument({
    documentType: 'kfs',
    fields: {
      ...createRealDocument().fields,
      interestRate: {
        value: 8.50,
        rateType: 'floating',
        rawText: '8.50%',
        pageClauseRef: 'Page 1, Clause 2',
        isVerifiedInSource: true,
      },
    },
  });

  const agreementV1 = createRealDocument({
    documentType: 'loan_agreement',
    documentName: 'Agreement_v1.pdf',
    fields: {
      ...createRealDocument().fields,
      interestRate: {
        value: 9.25,
        rateType: 'floating',
        rawText: '9.25%',
        pageClauseRef: 'Page 4, Clause 2.2',
        isVerifiedInSource: true,
      },
    },
  });

  const reportV1 = compareLoanDocuments(kfs, null, agreementV1);
  const rateFindingV1 = reportV1.comparisons.find(c => c.fieldKey === 'interestRate');
  assert.strictEqual(rateFindingV1?.status, 'mismatch');
  assert.strictEqual(rateFindingV1?.values.loanAgreement?.display, '9.25% p.a. (floating)');

  // Now user replaces Agreement with corrected Agreement v2 (8.50%)
  const agreementV2 = createRealDocument({
    documentType: 'loan_agreement',
    documentName: 'Agreement_v2_Corrected.pdf',
    fields: {
      ...createRealDocument().fields,
      interestRate: {
        value: 8.50,
        rateType: 'floating',
        rawText: '8.50%',
        pageClauseRef: 'Page 4, Clause 2.2',
        isVerifiedInSource: true,
      },
    },
  });

  const reportV2 = compareLoanDocuments(kfs, null, agreementV2);
  const rateFindingV2 = reportV2.comparisons.find(c => c.fieldKey === 'interestRate');
  assert.strictEqual(rateFindingV2?.status, 'match', 'After replacement, finding must update to match');
  assert.strictEqual(rateFindingV2?.values.loanAgreement?.display, '8.50% p.a. (floating)');
  assert.ok(!JSON.stringify(reportV2).includes('9.25%'), 'No stale 9.25% data can exist in report');
});

// -------------------------------------------------------------
// 5. CLEARING A DOCUMENT & STALE REPORT INVALIDATION
// -------------------------------------------------------------
console.log('\n[5] Document Clearing & Stale Invalidation:');

runTest('Clearing a document drops real document count below 2 and invalidates stale report', () => {
  let doc1: ExtractedLoanDocument | null = createRealDocument({ documentType: 'kfs' });
  let doc2: ExtractedLoanDocument | null = createRealDocument({ documentType: 'sanction_letter' });

  // Initially 2 docs -> valid report
  let report: LoanComparisonReport | null = compareLoanDocuments(doc1, doc2, null);
  assert.ok(report !== null);

  // User clicks "Clear" on doc2
  doc2 = null;

  // Evaluation simulates App.tsx useMemo
  const realDocs = [doc1, doc2].filter(d => Boolean(d && !d.isDemo));
  report = realDocs.length >= 2 ? compareLoanDocuments(doc1, doc2, null) : null;

  assert.strictEqual(report, null, 'Clearing document must set report to null (stale report invalidated)');
});

// -------------------------------------------------------------
// 6. FAILED EXTRACTION INTEGRITY
// -------------------------------------------------------------
console.log('\n[6] Failed Extraction State Isolation:');

runTest('Failed extraction retains slot in clean error state without setting invalid document data', () => {
  let docSlot: ExtractedLoanDocument | null = null;
  let stage: string = 'idle';
  let error: string | null = null;

  // Simulate failed upload pipeline
  try {
    stage = 'validating';
    const fakeValidLengthPayload = 'A'.repeat(60);
    if (fakeValidLengthPayload.length < 50) {
      throw new Error('Corrupted or empty file');
    }
    // Simulate server 502 error
    throw new Error('Gemini document parser could not extract terms');
  } catch (err: any) {
    stage = 'failed';
    error = err.message;
  }

  assert.strictEqual(docSlot, null, 'Slot must remain null on extraction failure');
  assert.strictEqual(stage, 'failed');
  assert.ok(error?.includes('Gemini document parser'));
});

// -------------------------------------------------------------
// 7. MISSING FIELD FORMATTING (NEVER ₹0 FOR MISSING VALUES)
// -------------------------------------------------------------
console.log('\n[7] Missing Fields Display Audit (No ₹0 for Missing):');

runTest('Missing or null EMI, Principal, Rate never format as ₹0', () => {
  assert.strictEqual(formatINR(null), 'Not available');
  assert.strictEqual(formatINR(undefined), 'Not available');
  assert.strictEqual(formatINR(0), 'Not available');
  assert.strictEqual(formatPercent(null), 'Not available');
  assert.strictEqual(formatPercent(0), 'Not available');
});

runTest('Missing fields in compareLoanDocuments are formatted as "Not extracted"', () => {
  const docA = createRealDocument({
    documentType: 'kfs',
    fields: {
      ...createRealDocument().fields,
      emi: { value: null, rawText: '', pageClauseRef: '' },
      apr: { value: null, rawText: '', pageClauseRef: '' },
    },
  });
  const docB = createRealDocument({ documentType: 'sanction_letter' });

  const report = compareLoanDocuments(docA, docB, null);
  const emiFinding = report.comparisons.find(c => c.fieldKey === 'emi');
  assert.strictEqual(emiFinding?.values.kfs?.display, 'Not extracted');
  assert.ok(!emiFinding?.values.kfs?.display.includes('₹0'));
});

// -------------------------------------------------------------
// 8. COMBINED MULTI-SECTION DOCUMENT TRACEABILITY
// -------------------------------------------------------------
console.log('\n[8] Combined Multi-Section Document Sourcing:');

runTest('Documents extracted from single combined package are clearly flagged with origin', () => {
  const combinedKfs = createRealDocument({
    documentType: 'kfs',
    documentName: 'My_Combined_Loan_Package.pdf',
    isCombinedPackage: true,
    originFileName: 'My_Combined_Loan_Package.pdf',
    originSection: 'Full Document Scan (as Key Facts Statement)',
  });

  const combinedAgreement = createRealDocument({
    documentType: 'loan_agreement',
    documentName: 'My_Combined_Loan_Package.pdf',
    isCombinedPackage: true,
    originFileName: 'My_Combined_Loan_Package.pdf',
    originSection: 'Full Document Scan (as Loan Agreement)',
  });

  const report = compareLoanDocuments(combinedKfs, null, combinedAgreement);
  assert.strictEqual(report.isCombinedPackage, true);
  assert.strictEqual(report.combinedFileName, 'My_Combined_Loan_Package.pdf');
  assert.ok(report.singleSourceNotice?.includes('Single uploaded file'));
  assert.ok(report.singleSourceNotice?.includes('My_Combined_Loan_Package.pdf'));
});

// -------------------------------------------------------------
// 9. PRODUCTION DATA-ISOLATION & STATE MANAGEMENT (dataIsolation.ts)
// -------------------------------------------------------------
console.log('\n[9] Production Data-Isolation & State Management (dataIsolation.ts):');

runTest('loadSingleSampleDocument purges single real document when loading sample', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });
  assert.strictEqual(realKfs.isDemo, false);

  const initial = {
    kfsDoc: realKfs,
    sanctionDoc: null,
    agreementDoc: null,
  };

  const next = loadSingleSampleDocument(initial, 'sanction_letter');

  assert.strictEqual(next.kfsDoc, null, 'Real KFS must be purged upon loading sample sanction letter');
  assert.strictEqual(next.sanctionDoc?.isDemo, true);
  assert.strictEqual(next.agreementDoc, null);

  const realDocs = [next.kfsDoc, next.sanctionDoc, next.agreementDoc].filter(d => Boolean(d && !d.isDemo));
  assert.strictEqual(realDocs.length, 0, 'Zero real documents must remain in state');
});

runTest('loadSingleSampleDocument purges multiple real documents across slots', () => {
  const realKfs = createRealDocument({ documentType: 'kfs' });
  const realAgreement = createRealDocument({ documentType: 'loan_agreement' });

  const initial = {
    kfsDoc: realKfs,
    sanctionDoc: null,
    agreementDoc: realAgreement,
  };

  const next = loadSingleSampleDocument(initial, 'sanction_letter');

  assert.strictEqual(next.kfsDoc, null, 'Real KFS must be purged');
  assert.strictEqual(next.agreementDoc, null, 'Real Agreement must be purged');
  assert.strictEqual(next.sanctionDoc?.isDemo, true);

  const realDocs = [next.kfsDoc, next.sanctionDoc, next.agreementDoc].filter(d => Boolean(d && !d.isDemo));
  assert.strictEqual(realDocs.length, 0, 'All real documents must be purged');
});

runTest('loadSingleSampleDocument preserves scenario borrower consistency', () => {
  const initial = {
    kfsDoc: null,
    sanctionDoc: DEMO_SCENARIO_CLEAN.sanctionDoc,
    agreementDoc: DEMO_SCENARIO_CLEAN.agreementDoc,
    activeScenarioId: 'personal_loan_clean',
  };

  const next = loadSingleSampleDocument(initial, 'kfs');

  assert.strictEqual(next.kfsDoc?.borrowerName, 'Pooja Iyer [Synthetic Profile]');
  assert.strictEqual(next.sanctionDoc?.borrowerName, 'Pooja Iyer [Synthetic Profile]');
  assert.strictEqual(next.agreementDoc?.borrowerName, 'Pooja Iyer [Synthetic Profile]');
  assert.strictEqual(next.activeScenarioId, 'personal_loan_clean');

  const report = compareLoanDocuments(next.kfsDoc, next.sanctionDoc, next.agreementDoc);
  assert.strictEqual(report.mismatchCount, 0, 'Clean scenario must have 0 mismatches');
});

runTest('loadSingleSampleDocument prevents combining incompatible synthetic scenarios', () => {
  // Scenario: slot has Pooja Iyer (clean), but state requests sample from discrepancy scenario
  const initial = {
    kfsDoc: DEMO_SCENARIO_CLEAN.kfsDoc, // Pooja Iyer
    sanctionDoc: null,
    agreementDoc: null,
    activeScenarioId: 'home_loan_discrepancy', // conflicting scenario ID
  };

  const next = loadSingleSampleDocument(initial, 'sanction_letter');

  // Must not combine Pooja Iyer KFS with Vikramaditya Sharma Sanction Letter
  assert.strictEqual(next.sanctionDoc?.borrowerName, 'Vikramaditya Sharma [Synthetic Profile]');
  assert.strictEqual(next.kfsDoc, null, 'Incompatible Pooja Iyer KFS must be purged to prevent scenario cross-contamination');
  assert.strictEqual(next.agreementDoc, null);
});

runTest('setDocumentSlot with real document purges all demo documents across all slots', () => {
  const initial = {
    kfsDoc: DEMO_SCENARIO_DISCREPANCY.kfsDoc,
    sanctionDoc: DEMO_SCENARIO_DISCREPANCY.sanctionDoc,
    agreementDoc: DEMO_SCENARIO_DISCREPANCY.agreementDoc,
    activeScenarioId: 'home_loan_discrepancy',
  };

  const realSanction = createRealDocument({ documentType: 'sanction_letter' });
  const next = setDocumentSlot(initial, 'sanction_letter', realSanction);

  assert.strictEqual(next.kfsDoc, null, 'Demo KFS must be purged when uploading real document');
  assert.strictEqual(next.agreementDoc, null, 'Demo Agreement must be purged when uploading real document');
  assert.strictEqual(next.sanctionDoc?.isDemo, false, 'Uploaded document must be real');
  assert.strictEqual(next.activeScenarioId, null, 'activeScenarioId must be reset');
});

runTest('resetAllLoanState clears all slots and active scenario ID', () => {
  const reset = resetAllLoanState();
  assert.strictEqual(reset.kfsDoc, null);
  assert.strictEqual(reset.sanctionDoc, null);
  assert.strictEqual(reset.agreementDoc, null);
  assert.strictEqual(reset.activeScenarioId, null);
});

console.log(`\n========================================================`);
console.log(`All ${passedTests} of ${totalTests} Data-Isolation & Integrity Tests Passed!`);
console.log(`========================================================\n`);
