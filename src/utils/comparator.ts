import {
  ExtractedLoanDocument,
  ExtractedLoanFields,
  FieldComparison,
  LoanComparisonReport,
  DiscrepancyStatus,
  DiscrepancySeverity,
  ReviewRecommendation,
  FindingClassification,
} from '../types/loan';
import { compareLifetimeImpact } from './financialMath';
import { REGULATORY_RULES } from './regulatoryRules';
import {
  normalizeTenure,
  detectTenureUnitConflict,
} from './unitConverter';

// Indian currency formatter (Lakhs and Crores: 12,34,567)
export function formatINR(val: number | null | undefined, allowZero = false): string {
  if (val === null || val === undefined || isNaN(val)) return 'Not available';
  if (val === 0 && !allowZero) return 'Not available';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return 'Not available';
  return `${val.toFixed(2)}% p.a.`;
}

interface DocValues {
  kfs?: {
    display: string;
    rawText: string;
    pageClauseRef: string;
    notes?: string;
    isVerifiedInSource?: boolean;
  };
  sanctionLetter?: {
    display: string;
    rawText: string;
    pageClauseRef: string;
    notes?: string;
    isVerifiedInSource?: boolean;
  };
  loanAgreement?: {
    display: string;
    rawText: string;
    pageClauseRef: string;
    notes?: string;
    isVerifiedInSource?: boolean;
  };
}

export function deriveFindingClassification(
  fieldKey: keyof ExtractedLoanFields,
  status: DiscrepancyStatus,
  severity: DiscrepancySeverity,
  values: DocValues
): FindingClassification | undefined {
  if (status === 'match') {
    return undefined;
  }
  if (status === 'missing') {
    return 'Missing information';
  }
  if (fieldKey === 'penalCharges' || fieldKey === 'prepaymentCharges' || fieldKey === 'insurance') {
    if (severity === 'warning' || severity === 'critical') {
      return 'Possible regulatory concern';
    }
  }
  const valList = [values.kfs, values.sanctionLetter, values.loanAgreement].filter(Boolean);
  const hasUnverified = valList.some(
      (v) =>
          v?.isVerifiedInSource === false ||
          !v?.pageClauseRef ||
          v.pageClauseRef.toLowerCase().includes('not detected') ||
          v.pageClauseRef.toLowerCase().includes('not cited')
  );
  if (hasUnverified && status === 'mismatch') {
    return 'Needs manual verification';
  }
  if (status === 'mismatch') {
    return 'Confirmed discrepancy';
  }
  return 'Needs manual verification';
}

export function compareLoanDocuments(
    kfsDoc: ExtractedLoanDocument | null,
    sanctionDoc: ExtractedLoanDocument | null,
    agreementDoc: ExtractedLoanDocument | null
): LoanComparisonReport {
  const docs = [kfsDoc, sanctionDoc, agreementDoc].filter(Boolean) as ExtractedLoanDocument[];

  if (docs.length === 0) {
    throw new Error('No documents provided for comparison.');
  }

  const realDocs = docs.filter((d) => !d.isDemo);
  const demoDocs = docs.filter((d) => Boolean(d.isDemo));

  // HARD ISOLATION GUARD: Never allow real docs to be compared against synthetic demo docs!
  if (realDocs.length > 0 && demoDocs.length > 0) {
    throw new Error(
        'Data Isolation Violation: Cannot compare real uploaded documents with synthetic demo documents. Switch to real mode or clear demo records before auditing user files.'
    );
  }

  // Real Mode Guard: A real-document comparison requires at least 2 real documents
  if (realDocs.length > 0 && realDocs.length < 2) {
    throw new Error(
        'Insufficient Real Documents: At least two real documents (e.g., KFS and Sanction Letter or Loan Agreement) are required to generate an authentic cross-document audit.'
    );
  }

  const isDemo = demoDocs.length > 0;
  const isCombined = docs.some((d) => Boolean(d.isCombinedPackage));
  const combinedFileName =
      docs.find((d) => d.isCombinedPackage)?.originFileName ||
      docs.find((d) => d.isCombinedPackage)?.documentName;
  const singleSourceNotice = isCombined
      ? `Source: Single uploaded file ("${combinedFileName}") containing multiple labeled contract sections. Findings compare extracted terms across sections of this single document.`
      : undefined;

  const lenderName =
      kfsDoc?.lenderName || sanctionDoc?.lenderName || agreementDoc?.lenderName || 'Lending Institution';
  const borrowerName =
      kfsDoc?.borrowerName || sanctionDoc?.borrowerName || agreementDoc?.borrowerName || 'Borrower';
  const loanType =
      kfsDoc?.loanType || sanctionDoc?.loanType || agreementDoc?.loanType || 'Retail Term Loan';

  const comparisons: FieldComparison[] = [];

  // Helper to build 3-column values
  const buildValues = (
      kfsField?: { value: any; rawText: string; pageClauseRef: string; notes?: string; isVerifiedInSource?: boolean },
      sanctionField?: { value: any; rawText: string; pageClauseRef: string; notes?: string; isVerifiedInSource?: boolean },
      agreeField?: { value: any; rawText: string; pageClauseRef: string; notes?: string; isVerifiedInSource?: boolean },
      key: keyof ExtractedLoanFields = 'loanAmount'
  ): DocValues => {
    const values: DocValues = {};

    const checkIsMissing = (val: any) =>
        val === null ||
        val === undefined ||
        val === '' ||
        (typeof val === 'number' && val <= 0 && key !== 'insurance' && key !== 'processingFees') ||
        (typeof val === 'string' &&
            (val.toLowerCase().includes('not specified') ||
                val.toLowerCase().includes('not mentioned') ||
                val.toLowerCase().includes('not stated')));

    const checkVerified = (field?: { value: any; pageClauseRef?: string; isVerifiedInSource?: boolean }) => {
      if (!field || checkIsMissing(field.value)) return false;
      const ref = field.pageClauseRef;
      if (!ref) return false;
      const lower = ref.toLowerCase();
      if (
          lower.includes('not detected') ||
          lower.includes('not cited') ||
          lower.includes('not specified') ||
          lower.includes('not found') ||
          lower.includes('evidence not verified')
      ) {
        return false;
      }
      return field.isVerifiedInSource === true;
    };

    if (kfsDoc && kfsField) {
      const isMissing = checkIsMissing(kfsField.value);
      const isVerified = checkVerified(kfsField);
      values.kfs = {
        display: formatFieldValue(key, kfsField.value, kfsField),
        rawText:
            isMissing
                ? 'Not stated in document'
                : kfsField.rawText &&
                !kfsField.rawText.toLowerCase().includes('not specified') &&
                !kfsField.rawText.toLowerCase().includes('not mentioned')
                    ? kfsField.rawText
                    : 'Not stated in document',
        pageClauseRef: isVerified ? kfsField.pageClauseRef : 'Evidence not verified',
        notes: kfsField.notes,
        isVerifiedInSource: isVerified,
      };
    }
    if (sanctionDoc && sanctionField) {
      const isMissing = checkIsMissing(sanctionField.value);
      const isVerified = checkVerified(sanctionField);
      values.sanctionLetter = {
        display: formatFieldValue(key, sanctionField.value, sanctionField),
        rawText:
            isMissing
                ? 'Not stated in document'
                : sanctionField.rawText &&
                !sanctionField.rawText.toLowerCase().includes('not specified') &&
                !sanctionField.rawText.toLowerCase().includes('not mentioned')
                    ? sanctionField.rawText
                    : 'Not stated in document',
        pageClauseRef: isVerified ? sanctionField.pageClauseRef : 'Evidence not verified',
        notes: sanctionField.notes,
        isVerifiedInSource: isVerified,
      };
    }
    if (agreementDoc && agreeField) {
      const isMissing = checkIsMissing(agreeField.value);
      const isVerified = checkVerified(agreeField);
      values.loanAgreement = {
        display: formatFieldValue(key, agreeField.value, agreeField),
        rawText:
            isMissing
                ? 'Not stated in document'
                : agreeField.rawText &&
                !agreeField.rawText.toLowerCase().includes('not specified') &&
                !agreeField.rawText.toLowerCase().includes('not mentioned')
                    ? agreeField.rawText
                    : 'Not stated in document',
        pageClauseRef: isVerified ? agreeField.pageClauseRef : 'Evidence not verified',
        notes: agreeField.notes,
        isVerifiedInSource: isVerified,
      };
    }
    return values;
  };

  // 1. LOAN AMOUNT
  {
    const kfsField = kfsDoc?.fields.loanAmount;
    const sanctionField = sanctionDoc?.fields.loanAmount;
    const agreeField = agreementDoc?.fields.loanAmount;
    const values = buildValues(kfsField, sanctionField, agreeField, 'loanAmount');

    const statedEntries: { docName: string; val: number }[] = [];
    if (kfsDoc && typeof kfsField?.value === 'number' && kfsField.value > 0) {
      statedEntries.push({ docName: 'Key Facts Statement', val: kfsField.value });
    }
    if (sanctionDoc && typeof sanctionField?.value === 'number' && sanctionField.value > 0) {
      statedEntries.push({ docName: 'Sanction Letter', val: sanctionField.value });
    }
    if (agreementDoc && typeof agreeField?.value === 'number' && agreeField.value > 0) {
      statedEntries.push({ docName: 'Loan Agreement', val: agreeField.value });
    }

    const nums = statedEntries.map((e) => e.val);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Sanctioned loan principal is consistent across submitted records.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    if (nums.length === 0) {
      status = 'missing';
      severity = 'warning';
      summary = 'Sanctioned loan principal amount was not stated in any of the submitted documents.';
      lenderQuestion = 'Please confirm the exact sanctioned principal amount that will be disbursed.';
    } else if (nums.length === 1) {
      status = 'missing';
      severity = 'info';
      summary = `Sanctioned principal of ${formatINR(nums[0])} is stated in the ${statedEntries[0].docName}, but is not stated in the other submitted document(s).`;
      lenderQuestion = `Please confirm that the approved loan principal of ${formatINR(nums[0])} is explicitly stated in all execution schedules.`;
    } else {
      const minVal = Math.min(...nums);
      const maxVal = Math.max(...nums);
      const diff = maxVal - minVal;

      if (diff > 100) {
        status = 'mismatch';
        severity = 'critical';
        summary = `Sanctioned principal differs by ${formatINR(diff)} across documents (${formatINR(minVal)} vs ${formatINR(maxVal)}).`;
        financialImpact = `Principal variance of ${formatINR(diff)} requires clarification before disbursement.`;
        calculationAssumptions = [
          `Assumed Minimum Principal: ${formatINR(minVal)}`,
          `Assumed Maximum Principal: ${formatINR(maxVal)}`,
          `Computed Difference: ${formatINR(maxVal)} - ${formatINR(minVal)} = ${formatINR(diff)}`,
          'Verify whether third-party administrative charges, insurance premiums, or documentation fees have been added to the principal balance.',
        ];
        lenderQuestion = `The loan amount is stated as ${formatINR(agreeField?.value ?? maxVal)} in the Loan Agreement, whereas earlier communications stated ${formatINR(kfsField?.value ?? minVal)}. Could you clarify if any fees or ancillary products have been capitalized into the principal debt?`;
      } else if (nums.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `Sanctioned loan principal is consistent across all submitted documents (${formatINR(minVal)}).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `Sanctioned principal aligns at ${formatINR(minVal)} where stated, but is not stated in all submitted documents.`;
        lenderQuestion = 'Please ensure the approved principal amount is clearly cited in the primary schedule of all execution copies.';
      }
    }

    const rule = REGULATORY_RULES.kfs_harmonization;

    comparisons.push({
      fieldKey: 'loanAmount',
      label: 'Loan Principal Amount',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 2. INTEREST RATE
  {
    const kfsField = kfsDoc?.fields.interestRate;
    const sanctionField = sanctionDoc?.fields.interestRate;
    const agreeField = agreementDoc?.fields.interestRate;
    const values = buildValues(kfsField, sanctionField, agreeField, 'interestRate');

    const statedEntries: { docName: string; val: number }[] = [];
    if (kfsDoc && typeof kfsField?.value === 'number' && kfsField.value > 0) {
      statedEntries.push({ docName: 'Key Facts Statement', val: kfsField.value });
    }
    if (sanctionDoc && typeof sanctionField?.value === 'number' && sanctionField.value > 0) {
      statedEntries.push({ docName: 'Sanction Letter', val: sanctionField.value });
    }
    if (agreementDoc && typeof agreeField?.value === 'number' && agreeField.value > 0) {
      statedEntries.push({ docName: 'Loan Agreement', val: agreeField.value });
    }

    const rates = statedEntries.map((e) => e.val);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Annual interest rate is consistent across submitted documents.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    if (rates.length === 0) {
      status = 'missing';
      severity = 'critical';
      summary = 'Annual interest rate is not stated in the submitted records.';
      lenderQuestion = 'What is the contracted annual interest rate (% p.a.) and the external benchmark spread?';
    } else if (rates.length === 1) {
      status = 'missing';
      severity = 'info';
      summary = `Annual interest rate of ${formatPercent(rates[0])} is stated in the ${statedEntries[0].docName}, but is not stated in the other submitted document(s).`;
      lenderQuestion = `Please confirm that the contracted interest rate of ${formatPercent(rates[0])} is explicitly cited across all loan documents.`;
    } else {
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      const rateDiff = +(maxRate - minRate).toFixed(3);

      if (rateDiff > 0.05) {
        status = 'mismatch';
        severity = 'critical';
        summary = `Interest rate differs by ${rateDiff.toFixed(2)}% p.a. across documents (${formatPercent(minRate)} vs ${formatPercent(maxRate)}).`;

        // Deterministic lifetime cost variance calculation with complete input validation
        const basePrincipal =
            kfsField?.value && kfsField.value > 0
                ? kfsDoc?.fields.loanAmount.value
                : sanctionDoc?.fields.loanAmount.value || agreementDoc?.fields.loanAmount.value;
        const compPrincipal = agreementDoc?.fields.loanAmount.value || basePrincipal;
        const tenureMonths =
            kfsDoc?.fields.tenureMonths.value ||
            agreementDoc?.fields.tenureMonths.value ||
            sanctionDoc?.fields.tenureMonths.value;

        if (
            !basePrincipal ||
            basePrincipal <= 0 ||
            !compPrincipal ||
            compPrincipal <= 0 ||
            !tenureMonths ||
            tenureMonths <= 0
        ) {
          financialImpact = 'Insufficient information to estimate';
          calculationAssumptions = [
            'Insufficient information to estimate: Calculating lifetime financial impact requires verified principal amount, interest rate variance, and tenure across documents.',
          ];
        } else {
          const impact = compareLifetimeImpact(
              { principal: basePrincipal, ratePercent: minRate, tenureMonths },
              { principal: compPrincipal, ratePercent: maxRate, tenureMonths }
          );

          if (impact.canCalculate) {
            financialImpact = `Potential difference of ${formatINR(impact.emiDifferenceMonthly)}/month and ~${formatINR(impact.lifetimeCostDifference)} in total lifetime outflows.`;
            calculationAssumptions = impact.assumptions;
          } else {
            financialImpact = impact.reason || 'Insufficient information to estimate';
            calculationAssumptions = impact.assumptions;
          }
        }

        lenderQuestion = `The Loan Agreement specifies an interest rate of ${formatPercent(agreeField?.value ?? maxRate)}, whereas earlier documents cited ${formatPercent(kfsField?.value ?? minRate)}. Has there been a revision in the external benchmark (e.g. Repo Rate) or the lender spread? Please provide written clarification.`;
      } else if (rates.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `Annual interest rate is consistent across submitted documents (${formatPercent(minRate)}).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `Interest rate aligns at ${formatPercent(minRate)} where stated, but is not stated across all submitted documents.`;
        lenderQuestion = 'Please confirm that the agreed rate of interest is reflected identically in the final execution schedule.';
      }
    }

    const rule = REGULATORY_RULES.external_benchmark_eblr;

    comparisons.push({
      fieldKey: 'interestRate',
      label: 'Annual Interest Rate (% p.a.)',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 3. ANNUAL PERCENTAGE RATE (APR)
  {
    const kfsField = kfsDoc?.fields.apr;
    const sanctionField = sanctionDoc?.fields.apr;
    const agreeField = agreementDoc?.fields.apr;
    const values = buildValues(kfsField, sanctionField, agreeField, 'apr');

    const statedEntries: { docName: string; val: number }[] = [];
    if (kfsDoc && typeof kfsField?.value === 'number' && kfsField.value > 0) {
      statedEntries.push({ docName: 'Key Facts Statement (KFS)', val: kfsField.value });
    }
    if (sanctionDoc && typeof sanctionField?.value === 'number' && sanctionField.value > 0) {
      statedEntries.push({ docName: 'Sanction Letter', val: sanctionField.value });
    }
    if (agreementDoc && typeof agreeField?.value === 'number' && agreeField.value > 0) {
      statedEntries.push({ docName: 'Loan Agreement', val: agreeField.value });
    }

    const aprs = statedEntries.map((e) => e.val);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'APR is disclosed and consistent across submitted records.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    if (aprs.length === 0) {
      status = 'missing';
      severity = 'info';
      summary = 'Annual Percentage Rate (APR) was not located in the submitted files.';
      lenderQuestion =
          'Under RBI Circular DOR.MCS.REC.17/01.01.001/2024-25, lenders must provide an all-inclusive APR in the KFS. Please provide the APR calculation breakdown.';
    } else if (aprs.length === 1) {
      // Requirement 2: The KFS states 9.45% APR, while the sanction letter and loan agreement do not state APR.
      // Show the KFS value and mark the other two as "Not stated in document." Do not report an APR difference of 9.45 percentage points.
      status = 'missing';
      severity = 'info';
      summary = `The KFS states ${aprs[0].toFixed(2)}% APR, while the sanction letter and loan agreement do not state APR. Under RBI mandates, all-inclusive APR disclosure is required in the Key Facts Statement.`;
      lenderQuestion =
          'The Key Facts Statement provides an all-inclusive APR. Please confirm that all fees incorporated into the APR are reflected without alteration in the final loan schedules.';
    } else {
      const minApr = Math.min(...aprs);
      const maxApr = Math.max(...aprs);
      const diff = +(maxApr - minApr).toFixed(2);

      if (diff > 0.1) {
        status = 'mismatch';
        severity = 'warning';
        summary = `APR differs by ${diff}% across documents (${minApr.toFixed(2)}% vs ${maxApr.toFixed(2)}%).`;
        financialImpact = `APR variance of ${diff}% reflects differences in itemized third-party charges or upfront fees.`;
        calculationAssumptions = [
          `Assumed Lower APR: ${minApr.toFixed(2)}% APR`,
          `Assumed Higher APR: ${maxApr.toFixed(2)}% APR`,
          `Computed Difference: ${diff} percentage points`,
          'Verify what documentation fees, insurance premiums, or administrative charges account for this APR spread.',
        ];
        lenderQuestion =
            'Why does the stated APR differ between documents? What third-party fees, documentation charges, or insurance costs account for this difference?';
      } else if (aprs.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `APR is disclosed and consistent across submitted records (${minApr.toFixed(2)}% APR).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `APR aligns at ${minApr.toFixed(2)}% APR where stated, but is not stated across all submitted documents.`;
      }
    }

    const rule = REGULATORY_RULES.kfs_harmonization;

    comparisons.push({
      fieldKey: 'apr',
      label: 'Annual Percentage Rate (APR)',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 4. TENURE
  {
    const kfsField = kfsDoc?.fields.tenureMonths;
    const sanctionField = sanctionDoc?.fields.tenureMonths;
    const agreeField = agreementDoc?.fields.tenureMonths;
    const values = buildValues(kfsField, sanctionField, agreeField, 'tenureMonths');

    const tenureDocs = [
      { docType: 'KFS', rawValue: kfsField?.value ?? null, rawText: kfsField?.rawText },
      { docType: 'Sanction Letter', rawValue: sanctionField?.value ?? null, rawText: sanctionField?.rawText },
      { docType: 'Loan Agreement', rawValue: agreeField?.value ?? null, rawText: agreeField?.rawText },
    ];
    const unitConflict = detectTenureUnitConflict(tenureDocs);

    const kfsNorm = normalizeTenure(kfsField?.value, kfsField?.rawText);
    const sanctionNorm = normalizeTenure(sanctionField?.value, sanctionField?.rawText);
    const agreeNorm = normalizeTenure(agreeField?.value, agreeField?.rawText);

    const statedTenures: { docName: string; months: number }[] = [];
    if (kfsDoc && typeof kfsNorm.months === 'number' && kfsNorm.months > 0) {
      statedTenures.push({ docName: 'Key Facts Statement', months: kfsNorm.months });
    }
    if (sanctionDoc && typeof sanctionNorm.months === 'number' && sanctionNorm.months > 0) {
      statedTenures.push({ docName: 'Sanction Letter', months: sanctionNorm.months });
    }
    if (agreementDoc && typeof agreeNorm.months === 'number' && agreeNorm.months > 0) {
      statedTenures.push({ docName: 'Loan Agreement', months: agreeNorm.months });
    }

    const tenures = statedTenures.map((e) => e.months);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Repayment tenure is identical across submitted documents.';
    let lenderQuestion = '';

    if (tenures.length === 0) {
      status = 'missing';
      severity = 'warning';
      summary = 'Loan repayment tenure is not specified in any of the submitted documents.';
      lenderQuestion = 'Please clarify the contracted repayment tenure in number of monthly installments.';
    } else if (tenures.length === 1) {
      status = 'missing';
      severity = 'info';
      summary = `Loan tenure of ${tenures[0]} months (${(tenures[0] / 12).toFixed(1)} yrs) is stated in the ${statedTenures[0].docName}, but is not stated in the other submitted document(s).`;
      lenderQuestion = `Please confirm that the repayment tenure of ${tenures[0]} months is explicitly stated across all loan schedules.`;
    } else if (unitConflict.hasConflict) {
      if (unitConflict.isEquivalentAfterConversion) {
        status = 'match';
        severity = 'clean';
        summary = `Repayment tenure aligns at ${tenures[0]} months (${(tenures[0] / 12).toFixed(1)} yrs). Note: Documents express tenure in differing units (Years vs Months) which convert to the same duration.`;
        lenderQuestion =
            'Documents quote tenure in differing units (years vs months). Please ensure the final execution copy cites total tenure in both months and years for precision.';
      } else {
        status = 'mismatch';
        severity = 'critical';
        summary = unitConflict.details || `Tenure variance with conflicting units.`;
        lenderQuestion = `Documents express tenure with conflicting units and differing durations. Please confirm the exact agreed repayment schedule.`;
      }
    } else {
      const minT = Math.min(...tenures);
      const maxT = Math.max(...tenures);

      if (maxT - minT > 1) {
        status = 'mismatch';
        severity = 'critical';
        summary = `Tenure variance: Documents show ${minT} months (${(minT / 12).toFixed(1)} yrs) vs ${maxT} months (${(maxT / 12).toFixed(1)} yrs).`;
        lenderQuestion = `The Loan Agreement specifies ${agreeNorm.months ?? agreeField?.value} months, while earlier communications stated ${sanctionNorm.months || kfsNorm.months} months. Please confirm the intended repayment duration.`;
      } else if (tenures.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `Repayment tenure is identical across submitted documents (${minT} months / ${(minT / 12).toFixed(1)} yrs).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `Loan tenure aligns at ${minT} months where stated, but is not stated in all submitted documents.`;
      }
    }

    comparisons.push({
      fieldKey: 'tenureMonths',
      label: 'Loan Tenure (Months)',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      rbiGuideline:
          'Loan tenure determines the total interest commitment and monthly liquidity. Any change in repayment schedule requires clear written agreement with the borrower.',
      verificationNotice: 'Applicability Caveat: Verify whether a moratorium period was added to the repayment commencement date.',
      isSampleData: isDemo,
    });
  }

  // 5. EMI (MONTHLY INSTALLMENT)
  {
    const kfsField = kfsDoc?.fields.emi;
    const sanctionField = sanctionDoc?.fields.emi;
    const agreeField = agreementDoc?.fields.emi;
    const values = buildValues(kfsField, sanctionField, agreeField, 'emi');

    const statedEntries: { docName: string; val: number }[] = [];
    if (kfsDoc && typeof kfsField?.value === 'number' && kfsField.value > 0) {
      statedEntries.push({ docName: 'Key Facts Statement', val: kfsField.value });
    }
    if (sanctionDoc && typeof sanctionField?.value === 'number' && sanctionField.value > 0) {
      statedEntries.push({ docName: 'Sanction Letter', val: sanctionField.value });
    }
    if (agreementDoc && typeof agreeField?.value === 'number' && agreeField.value > 0) {
      statedEntries.push({ docName: 'Loan Agreement', val: agreeField.value });
    }

    const emis = statedEntries.map((e) => e.val);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Monthly EMI is consistent across submitted records.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    // Requirement 3: None of the three test PDFs states a monthly EMI.
    // Mark EMI as "Not stated in document" for all three. Do not call it a match and do not calculate lifetime impact from missing EMI values.
    if (emis.length === 0) {
      status = 'missing';
      severity = 'info';
      summary = 'Monthly EMI is not stated in the submitted documents.';
      lenderQuestion = 'What is the exact monthly installment and the specific calendar due date?';
      financialImpact = '';
      calculationAssumptions = undefined;
    } else if (emis.length === 1) {
      status = 'missing';
      severity = 'info';
      summary = `Monthly EMI of ${formatINR(emis[0])} is stated in the ${statedEntries[0].docName}, but is not stated in the other submitted document(s).`;
      lenderQuestion = `Please confirm that the monthly installment of ${formatINR(emis[0])} is explicitly reflected across all contract copies.`;
      financialImpact = '';
      calculationAssumptions = undefined;
    } else {
      const minEmi = Math.min(...emis);
      const maxEmi = Math.max(...emis);
      const diff = maxEmi - minEmi;

      if (diff > 50) {
        status = 'mismatch';
        severity = 'critical';
        summary = `Monthly EMI differs by ${formatINR(diff)} per month between documents (${formatINR(minEmi)} vs ${formatINR(maxEmi)}).`;

        const tenureM = kfsDoc?.fields.tenureMonths.value || agreementDoc?.fields.tenureMonths.value;
        if (!tenureM || tenureM <= 0) {
          financialImpact = 'Insufficient information to estimate';
          calculationAssumptions = [
            'Insufficient information to estimate: Tenure is required to determine lifetime impact.',
          ];
        } else {
          const lifetimeEmiDiff = diff * tenureM;
          financialImpact = `An EMI difference of ${formatINR(diff)}/month over ${tenureM} months totals ${formatINR(lifetimeEmiDiff)}.`;
          calculationAssumptions = [
            `Assumed Principal: ${formatINR(kfsDoc?.fields.loanAmount.value || agreementDoc?.fields.loanAmount.value || sanctionDoc?.fields.loanAmount.value)}`,
            `Assumed Interest Rate: ${kfsDoc?.fields.interestRate.value ?? 'N/A'}% p.a.`,
            `Assumed Tenure: ${tenureM} months`,
            `Repayment Method: Equated Monthly Installment (reducing balance amortization)`,
            `Deterministic calculation: ${formatINR(diff)} difference * ${tenureM} months = ${formatINR(lifetimeEmiDiff)}.`,
            'Assumes the EMI remains unchanged over the entire duration without prepayments or benchmark adjustments.',
          ];
        }

        lenderQuestion = `Why is the monthly EMI in the agreement stated as ${formatINR(agreeField?.value ?? maxEmi)} instead of ${formatINR(kfsField?.value ?? minEmi)}? Please provide the detailed monthly amortization schedule.`;
      } else if (emis.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `Monthly EMI is consistent across submitted records (${formatINR(minEmi)}).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `Monthly EMI aligns at ${formatINR(minEmi)} where stated, but is not stated across all submitted documents.`;
      }
    }

    comparisons.push({
      fieldKey: 'emi',
      label: 'Equated Monthly Installment (EMI)',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline:
          'The KFS must contain an illustrative repayment schedule indicating installment breakdown into principal and interest.',
      verificationNotice: 'Applicability Caveat: Check whether broken-period interest or initial broken days were added to the first installment.',
      isSampleData: isDemo,
    });
  }

  // 6. PROCESSING FEES & CHARGES
  {
    const kfsField = kfsDoc?.fields.processingFees;
    const sanctionField = sanctionDoc?.fields.processingFees;
    const agreeField = agreementDoc?.fields.processingFees;
    const values = buildValues(kfsField, sanctionField, agreeField, 'processingFees');

    const statedEntries: { docName: string; val: number }[] = [];
    if (kfsDoc && typeof kfsField?.value === 'number') {
      statedEntries.push({ docName: 'Key Facts Statement', val: kfsField.value });
    }
    if (sanctionDoc && typeof sanctionField?.value === 'number') {
      statedEntries.push({ docName: 'Sanction Letter', val: sanctionField.value });
    }
    if (agreementDoc && typeof agreeField?.value === 'number') {
      statedEntries.push({ docName: 'Loan Agreement', val: agreeField.value });
    }

    const fees = statedEntries.map((e) => e.val);

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Processing fees and upfront charges align across documents.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    if (fees.length === 0) {
      status = 'missing';
      severity = 'info';
      summary = 'Processing fee specifics were not stated in the submitted documents.';
      lenderQuestion = 'Please confirm the total one-time upfront processing charges including 18% GST.';
    } else if (fees.length === 1) {
      status = 'missing';
      severity = 'info';
      summary = `Processing fee of ${fees[0] === 0 ? 'Nil' : formatINR(fees[0])} is stated in the ${statedEntries[0].docName}, but is not stated in the other submitted document(s).`;
      lenderQuestion = 'Please confirm the total upfront processing charges applicable across all execution schedules.';
    } else {
      const minFee = Math.min(...fees);
      const maxFee = Math.max(...fees);
      const diff = maxFee - minFee;

      if (diff > 100) {
        status = 'mismatch';
        severity = 'warning';
        summary = `Processing fee differs by ${formatINR(diff)} between documents (${formatINR(minFee)} in KFS vs ${formatINR(maxFee)} in Agreement).`;
        financialImpact = `Variance of ${formatINR(diff)} in upfront deductions.`;
        calculationAssumptions = [
          `Assumed Lower Fee: ${formatINR(minFee)}`,
          `Assumed Higher Fee: ${formatINR(maxFee)}`,
          `Fee difference computed as: ${formatINR(maxFee)} - ${formatINR(minFee)} = ${formatINR(diff)}.`,
          'Verify if the higher amount reflects GST (18%) or additional third-party legal/valuation charges.',
        ];
        lenderQuestion = `The processing fee is stated as ${formatINR(agreeField?.value ?? maxFee)} in the agreement, whereas earlier records listed ${formatINR(kfsField?.value ?? minFee)}. Does this difference include GST or third-party documentation fees?`;
      } else if (fees.length === docs.length) {
        status = 'match';
        severity = 'clean';
        summary = `Processing fees and upfront charges align across submitted documents (${minFee === 0 ? 'Nil' : formatINR(minFee)}).`;
      } else {
        status = 'missing';
        severity = 'info';
        summary = `Processing fees align at ${minFee === 0 ? 'Nil' : formatINR(minFee)} where stated, but are not stated across all submitted documents.`;
      }
    }

    const rule = REGULATORY_RULES.kfs_harmonization;

    comparisons.push({
      fieldKey: 'processingFees',
      label: 'Processing & Upfront Fees',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 7. INSURANCE (CREDIT SHIELD / PROPERTY INSURANCE)
  {
    const kfsField = kfsDoc?.fields.insurance;
    const sanctionField = sanctionDoc?.fields.insurance;
    const agreeField = agreementDoc?.fields.insurance;
    const values = buildValues(kfsField, sanctionField, agreeField, 'insurance');

    const agreeMandatory = agreeField?.isMandatory;
    const sanctionMandatory = sanctionField?.isMandatory;
    const agreeVal = typeof agreeField?.value === 'number' ? agreeField.value : 0;
    const kfsVal = typeof kfsField?.value === 'number' ? kfsField.value : 0;

    const hasKfsInsurance = kfsDoc && typeof kfsField?.value === 'number';
    const hasAgreeInsurance = agreementDoc && typeof agreeField?.value === 'number';

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Insurance terms are aligned or properly identified as voluntary.';
    let lenderQuestion = '';
    let financialImpact = '';
    let calculationAssumptions: string[] | undefined;

    if (!hasKfsInsurance && !hasAgreeInsurance) {
      status = 'missing';
      severity = 'info';
      summary = 'No explicit insurance policy clauses found in the submitted files.';
      lenderQuestion = 'Please confirm whether any loan protection or collateral property insurance is required.';
    } else if (agreeMandatory === true && (sanctionMandatory === false || kfsVal === 0)) {
      status = 'mismatch';
      severity = 'critical';
      summary = `Insurance condition variance: Pre-contract documents indicated insurance was voluntary or ₹0, but the draft agreement conditions precedent require a policy of ${formatINR(agreeVal)}.`;
      financialImpact = `Potential outlay of ${formatINR(agreeVal)} if added to loan proceeds or deducted upfront.`;
      calculationAssumptions = [
        `Assumed Insurance Premium: ${formatINR(agreeVal)}`,
        'Condition: Stated as mandatory condition precedent in the Loan Agreement draft',
        'Verify whether loan sanction is contingent upon this policy or if borrower has freedom of insurer choice.',
      ];
      lenderQuestion = `Clause ${agreeField?.pageClauseRef || 'in the Loan Agreement'} presents loan insurance of ${formatINR(agreeVal)} as a mandatory condition precedent, whereas earlier communications indicated it was optional. Could you clarify if this coverage is mandatory for sanction, and whether alternative insurance policies may be assigned?`;
    } else if (agreeVal > 0 && kfsVal === 0) {
      status = 'mismatch';
      severity = 'warning';
      summary = `An insurance premium of ${formatINR(agreeVal)} is referenced in the agreement draft, but was not detailed in the KFS table.`;
      financialImpact = `Potential outlay of ${formatINR(agreeVal)} if debited from loan proceeds.`;
      calculationAssumptions = [
        `Assumed Insurance Premium: ${formatINR(agreeVal)}`,
        'Verify whether this premium is debited upfront or capitalized into the principal balance.',
      ];
      lenderQuestion = `Please clarify if the insurance coverage of ${formatINR(agreeVal)} is optional, and whether borrowers have the choice of insurer.`;
    } else if (hasKfsInsurance && hasAgreeInsurance && agreeVal === kfsVal) {
      status = 'match';
      severity = 'clean';
      summary = 'Insurance terms are aligned or properly identified as voluntary.';
    } else {
      status = 'missing';
      severity = 'info';
      summary = 'Insurance terms are not detailed in all submitted documents.';
      lenderQuestion = 'Please clarify whether credit life or property insurance is required for this facility.';
    }

    const rule = REGULATORY_RULES.insurance_bundling;

    comparisons.push({
      fieldKey: 'insurance',
      label: 'Insurance & Ancillary Products',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      financialImpact,
      calculationAssumptions,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 8. PENAL CHARGES & DEFAULT TERMS
  {
    const kfsField = kfsDoc?.fields.penalCharges;
    const sanctionField = sanctionDoc?.fields.penalCharges;
    const agreeField = agreementDoc?.fields.penalCharges;
    const values = buildValues(kfsField, sanctionField, agreeField, 'penalCharges');

    const agreeCompounded = agreeField?.isCompoundedInterest;
    const agreeCompliant = agreeField?.isRbiCompliant;

    const hasKfsPenal = Boolean(kfsDoc && kfsField?.value && !kfsField.value.toLowerCase().includes('not specified') && !kfsField.value.toLowerCase().includes('not mentioned'));
    const hasAgreePenal = Boolean(agreementDoc && agreeField?.value && !agreeField.value.toLowerCase().includes('not specified') && !agreeField.value.toLowerCase().includes('not mentioned'));

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Penal charges follow RBI guidelines as simple charges without interest compounding.';
    let lenderQuestion = '';

    if (!hasKfsPenal && !hasAgreePenal) {
      status = 'missing';
      severity = 'warning';
      summary = 'Penal charges schedule was not found in the submitted records.';
      lenderQuestion = 'What is the exact penal charge for late monthly installment payments?';
    } else if (agreeCompounded || agreeCompliant === false) {
      status = 'mismatch';
      severity = 'warning';
      summary =
          'Compounding penal interest clause noted in the draft agreement. Needs verification under RBI Circular DoR.MCS.REC.28/01.01.001/2023-24.';
      lenderQuestion = `Clause ${agreeField?.pageClauseRef || 'in the agreement'} specifies compounding penal interest on delayed installments. Under RBI Circular DoR.MCS.REC.28/01.01.001/2023-24 (effective April 1, 2024), lenders are required to levy reasonable penal charges rather than compounding penal interest. Could you clarify if this clause will be updated to reflect simple penal charges?`;
    } else if (hasKfsPenal && hasAgreePenal) {
      status = 'match';
      severity = 'clean';
      summary = 'Penal charges follow RBI guidelines as simple charges without interest compounding.';
    } else {
      status = 'missing';
      severity = 'info';
      summary = 'Penal charges terms are not stated in all submitted documents.';
      lenderQuestion = 'Please confirm the schedule of penal charges for default or delayed payment.';
    }

    const rule = REGULATORY_RULES.penal_charges;

    comparisons.push({
      fieldKey: 'penalCharges',
      label: 'Penal Charges & Default Terms',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // 9. PREPAYMENT & FORECLOSURE CHARGES
  {
    const kfsField = kfsDoc?.fields.prepaymentCharges;
    const sanctionField = sanctionDoc?.fields.prepaymentCharges;
    const agreeField = agreementDoc?.fields.prepaymentCharges;
    const values = buildValues(kfsField, sanctionField, agreeField, 'prepaymentCharges');

    const agreePenalty = agreeField?.hasPenalty;
    const isFloating =
        kfsDoc?.fields.interestRate.rateType === 'floating' ||
        sanctionDoc?.fields.interestRate.rateType === 'floating' ||
        agreementDoc?.fields.interestRate.rateType === 'floating';

    const hasKfsPrepay = Boolean(kfsDoc && kfsField?.value && !kfsField.value.toLowerCase().includes('not specified') && !kfsField.value.toLowerCase().includes('not mentioned'));
    const hasAgreePrepay = Boolean(agreementDoc && agreeField?.value && !agreeField.value.toLowerCase().includes('not specified') && !agreeField.value.toLowerCase().includes('not mentioned'));

    let status: DiscrepancyStatus = 'match';
    let severity: DiscrepancySeverity = 'clean';
    let summary = 'Prepayment and foreclosure provisions align with standard norms.';
    let lenderQuestion = '';

    if (!hasAgreePrepay && !hasKfsPrepay) {
      status = 'missing';
      severity = 'info';
      summary = 'Prepayment and part-payment terms were not explicitly stated in the submitted records.';
      lenderQuestion = 'Please confirm the prepayment and part-prepayment fee schedule applicable to this facility.';
    } else if (isFloating && agreePenalty) {
      status = 'mismatch';
      severity = 'warning';
      summary =
          'Prepayment charge clause noted. Needs verification under RBI Circular DBOD.Dir.BC.115/13.03.00/2013-14 for individual floating-rate loans.';
      lenderQuestion = `Clause ${agreeField?.pageClauseRef || 'in the agreement'} references a prepayment or foreclosure fee. Under RBI Circular DBOD.Dir.BC.115/13.03.00/2013-14, foreclosure penalties are prohibited on floating-rate term loans to individual borrowers. If this facility is sanctioned to an individual on a floating rate, could you confirm that zero foreclosure charges apply?`;
    } else if (hasKfsPrepay && hasAgreePrepay) {
      status = 'match';
      severity = 'clean';
      summary = 'Prepayment and foreclosure provisions align with standard norms.';
    } else {
      status = 'missing';
      severity = 'info';
      summary = 'Prepayment provisions are not detailed in all submitted documents.';
      lenderQuestion = 'Please confirm whether prepayment or foreclosure penalties apply to this loan.';
    }

    const rule = REGULATORY_RULES.foreclosure_floating;

    comparisons.push({
      fieldKey: 'prepaymentCharges',
      label: 'Prepayment & Foreclosure Charges',
      status,
      severity,
      values,
      summary,
      lenderQuestion,
      rbiGuideline: rule.guidanceText,
      circularReference: rule.circularId,
      sourceUrl: rule.sourceUrl,
      verificationNotice: rule.verificationNotice,
      isSampleData: isDemo,
    });
  }

  // Summary tallies
  const matchCount = comparisons.filter((c) => c.status === 'match').length;
  const mismatchCount = comparisons.filter((c) => c.status === 'mismatch').length;
  const missingCount = comparisons.filter((c) => c.status === 'missing').length;

  const criticalCount = comparisons.filter((c) => c.severity === 'critical').length;
  const warningCount = comparisons.filter((c) => c.severity === 'warning').length;

  // Cautious, balanced review recommendations
  let riskRating: 'Consistent' | 'Minor Variances' | 'Variances Noted' = 'Consistent';
  let recommendation: ReviewRecommendation = 'Terms Aligned Across Documents';
  let recommendationNote =
      'Extracted terms across submitted documents demonstrate consistent alignment. Standard review before execution is always recommended.';

  if (criticalCount > 0) {
    riskRating = 'Variances Noted';
    recommendation = 'Review Variances with Lender';
    recommendationNote =
        'Material variances were identified between pre-contract offers and the draft agreement. Variances frequently occur due to benchmark reset timing, updated schedules, or ancillary service inclusions. We recommend reviewing these points with your loan officer before executing the contract.';
  } else if (warningCount > 0 || mismatchCount > 0) {
    riskRating = 'Minor Variances';
    recommendation = 'Clarifications Recommended';
    recommendationNote =
        'Minor variances or omitted disclosures were observed. Request written clarification from your lender to ensure the final execution copy mirrors your agreed terms.';
  }

  comparisons.forEach((c) => {
    if (!c.classification) {
      c.classification = deriveFindingClassification(c.fieldKey, c.status, c.severity, c.values);
    }
  });

  const keyWarnings: string[] = comparisons
      .filter((c) => c.severity === 'critical' || (c.severity === 'warning' && c.status === 'mismatch'))
      .map((c) => `${c.label}: ${c.summary}`);

  return {
    comparedAt: new Date().toISOString(),
    isDemo,
    isCombinedPackage: isCombined,
    combinedFileName,
    singleSourceNotice,
    documentsPresent: {
      kfs: Boolean(kfsDoc),
      sanctionLetter: Boolean(sanctionDoc),
      loanAgreement: Boolean(agreementDoc),
    },
    lenderName,
    borrowerName,
    loanType,
    totalTermsEvaluated: comparisons.length,
    matchCount,
    mismatchCount,
    missingCount,
    riskRating,
    keyWarnings,
    recommendation,
    recommendationNote,
    comparisons,
  };
}

function formatFieldValue(key: keyof ExtractedLoanFields, val: any, fullField?: any): string {
  if (val === null || val === undefined || val === '') return 'Not extracted';

  switch (key) {
    case 'loanAmount':
    case 'emi':
      if (typeof val === 'number') {
        if (val <= 0) return 'Not extracted';
        return formatINR(val, false);
      }
      return val ? String(val) : 'Not extracted';
    case 'interestRate': {
      if (typeof val === 'number') {
        if (val <= 0) return 'Not extracted';
        const typeStr = fullField?.rateType && fullField.rateType !== 'unknown' ? ` (${fullField.rateType})` : '';
        return `${formatPercent(val)}${typeStr}`;
      }
      return val ? String(val) : 'Not extracted';
    }
    case 'apr':
      if (typeof val === 'number') {
        if (val <= 0) return 'Not extracted';
        return `${val.toFixed(2)}% APR`;
      }
      return val ? String(val) : 'Not extracted';
    case 'tenureMonths':
      if (typeof val === 'number') {
        if (val <= 0) return 'Not extracted';
        const yrs = (val / 12).toFixed(1);
        return `${val} months (${yrs} yrs)`;
      }
      return val ? String(val) : 'Not extracted';
    case 'processingFees':
      if (typeof val === 'number') {
        if (val === 0) return '₹0 (Nil / Waived)';
        return formatINR(val, false);
      }
      return val ? String(val) : 'Not extracted';
    case 'insurance':
      if (typeof val === 'number') {
        return val === 0
            ? '₹0 (None / Voluntary)'
            : `${formatINR(val, false)}${fullField?.isMandatory ? ' [Mandatory]' : ' [Optional]'}`;
      }
      return val ? String(val) : 'Not extracted';
    case 'penalCharges':
    case 'prepaymentCharges': {
      const str = String(val).trim();
      if (
          !str ||
          str.toLowerCase().includes('not specified') ||
          str.toLowerCase().includes('not mentioned') ||
          str.toLowerCase().includes('not stated')
      ) {
        return 'Not extracted';
      }
      return str;
    }
    default:
      return String(val);
  }
}
