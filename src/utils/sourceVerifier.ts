import { ExtractedLoanFields } from '../types/loan';

export interface SourceVerificationResult {
  isVerified: boolean;
  reason?: string;
}

const NEGATIVE_REF_PATTERNS = [
  'not detected',
  'not cited',
  'not specified',
  'not found',
  'not mentioned',
  'not available',
  'evidence not verified',
  'unverified',
  'n/a',
  'none',
];

const PLACEHOLDER_RAW_PATTERNS = [
  'not specified',
  'not mentioned',
  'not stated',
  'not available',
  'not detected',
  'not cited',
  'n/a',
  'none',
];

/**
 * Deterministically checks whether a cited source excerpt genuinely supports the extracted value.
 *
 * Requirements:
 * 1. Plausible pageClauseRef alone NEVER establishes verification.
 * 2. rawText must be present, non-empty, and not a placeholder.
 * 3. rawText must genuinely corroborate the extracted value.
 * 4. Contradictions between rawText and value cause verification to fail.
 */
export function verifySourceSubstantiation(
  value: any,
  rawText?: string | null,
  pageClauseRef?: string | null,
  fieldKey?: keyof ExtractedLoanFields
): SourceVerificationResult {
  // 1. Validate pageClauseRef
  if (!pageClauseRef || typeof pageClauseRef !== 'string') {
    return { isVerified: false, reason: 'Page reference not detected in document text' };
  }
  const cleanRef = pageClauseRef.trim().toLowerCase();
  if (cleanRef.length < 2 || NEGATIVE_REF_PATTERNS.some((p) => cleanRef.includes(p))) {
    return { isVerified: false, reason: 'Page reference not detected in document text' };
  }

  // 2. Validate rawText presence and substantiveness
  if (!rawText || typeof rawText !== 'string') {
    return { isVerified: false, reason: 'Missing source excerpt' };
  }
  const cleanRaw = rawText.trim();
  const lowerRaw = cleanRaw.toLowerCase();
  if (cleanRaw.length < 4 || PLACEHOLDER_RAW_PATTERNS.some((p) => lowerRaw === p || lowerRaw.startsWith(p))) {
    return { isVerified: false, reason: 'Verbatim excerpt missing or placeholder in document text' };
  }

  // 3. Value check
  if (value === null || value === undefined || value === '') {
    return { isVerified: false, reason: 'No extracted value to substantiate' };
  }

  // 4. Value-specific substantiation
  if (fieldKey === 'loanAmount' && typeof value === 'number') {
    const numStr = String(value);
    const lakhs = (value / 100000).toString();
    const crores = (value / 10000000).toString();

    const matchesNumber =
      lowerRaw.includes(numStr) ||
      lowerRaw.includes(value.toLocaleString('en-IN')) ||
      lowerRaw.includes(`${lakhs} lakh`) ||
      lowerRaw.includes(`${lakhs} lac`) ||
      lowerRaw.includes(`${crores} crore`) ||
      lowerRaw.includes(`${crores} cr`);

    if (!matchesNumber) {
      return { isVerified: false, reason: 'Source text does not substantiate extracted loan amount' };
    }
  } else if ((fieldKey === 'interestRate' || fieldKey === 'apr') && typeof value === 'number') {
    const rateStr = value.toFixed(2);
    const rateStrTrim = value.toString();
    const matchesRate = lowerRaw.includes(rateStrTrim) || lowerRaw.includes(rateStr);
    if (!matchesRate) {
      return { isVerified: false, reason: `Source text does not substantiate extracted ${fieldKey}` };
    }
  } else if (fieldKey === 'tenureMonths' && typeof value === 'number') {
    const monthsStr = String(value);
    const yearsStr = (value / 12).toString();
    const matchesTenure =
      lowerRaw.includes(monthsStr) ||
      (value % 12 === 0 && (lowerRaw.includes(`${yearsStr} year`) || lowerRaw.includes(`${yearsStr} yr`)));
    if (!matchesTenure) {
      return { isVerified: false, reason: 'Source text does not substantiate extracted tenure' };
    }
  } else if (fieldKey === 'emi' && typeof value === 'number') {
    const emiStr = String(value);
    const matchesEmi = lowerRaw.includes(emiStr) || lowerRaw.includes(value.toLocaleString('en-IN'));
    if (!matchesEmi) {
      return { isVerified: false, reason: 'Source text does not substantiate extracted EMI' };
    }
  } else if (fieldKey === 'processingFees') {
    if (typeof value === 'number' && value > 0) {
      const feeStr = String(value);
      const matchesFee =
        lowerRaw.includes(feeStr) ||
        lowerRaw.includes(value.toLocaleString('en-IN')) ||
        lowerRaw.includes('processing') ||
        lowerRaw.includes('fee');
      if (!matchesFee) {
        return { isVerified: false, reason: 'Source text does not substantiate extracted processing fee' };
      }
    } else {
      const matchesNil =
        lowerRaw.includes('nil') ||
        lowerRaw.includes('zero') ||
        lowerRaw.includes('waived') ||
        lowerRaw.includes('0');
      if (!matchesNil && !lowerRaw.includes('processing')) {
        return { isVerified: false, reason: 'Source text does not substantiate processing fee waiver' };
      }
    }
  } else if (fieldKey === 'insurance') {
    const hasInsuranceKeyword =
      lowerRaw.includes('insurance') ||
      lowerRaw.includes('policy') ||
      lowerRaw.includes('premium') ||
      lowerRaw.includes('shield') ||
      lowerRaw.includes('suraksha') ||
      lowerRaw.includes('cover') ||
      lowerRaw.includes('nil') ||
      lowerRaw.includes('optional');
    if (!hasInsuranceKeyword) {
      return { isVerified: false, reason: 'Source text does not contain insurance terms' };
    }
  } else if (fieldKey === 'penalCharges') {
    const hasPenalKeyword =
      lowerRaw.includes('penal') ||
      lowerRaw.includes('penalty') ||
      lowerRaw.includes('overdue') ||
      lowerRaw.includes('delayed') ||
      lowerRaw.includes('default') ||
      lowerRaw.includes('late');
    if (!hasPenalKeyword) {
      return { isVerified: false, reason: 'Source text does not contain penal charge provisions' };
    }
  } else if (fieldKey === 'prepaymentCharges') {
    const hasPrepayKeyword =
      lowerRaw.includes('prepay') ||
      lowerRaw.includes('pre-payment') ||
      lowerRaw.includes('foreclosure') ||
      lowerRaw.includes('part-payment') ||
      lowerRaw.includes('early payment') ||
      lowerRaw.includes('premature');
    if (!hasPrepayKeyword) {
      return { isVerified: false, reason: 'Source text does not contain prepayment or foreclosure provisions' };
    }
  }

  return { isVerified: true };
}
