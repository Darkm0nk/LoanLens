import { ExtractedLoanFields, SourceVerificationLevel } from '../types/loan';

export interface SourceVerificationResult {
  isVerified: boolean;
  verificationLevel: SourceVerificationLevel;
  reason?: string;
  details?: string;
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
 * Normalizes text for reliable substring matching across whitespace and formatting variations.
 */
export function normalizeTextForMatching(text: string): string {
  return text
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[“”"']/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether an excerpt exists in the actual document source text.
 */
export function verifyExcerptInSourceText(
  excerpt?: string | null,
  sourceText?: string | null
): boolean {
  if (!excerpt || typeof excerpt !== 'string' || !sourceText || typeof sourceText !== 'string') {
    return false;
  }
  const cleanExcerpt = excerpt.replace(/^["'“”‘«]+|["'“”’»]+$/g, '').trim();
  if (cleanExcerpt.length < 4) return false;

  const normExcerpt = normalizeTextForMatching(cleanExcerpt);
  const normSource = normalizeTextForMatching(sourceText);

  if (!normSource || normSource.length < 5) return false;

  // Direct normalized substring match
  if (normSource.includes(normExcerpt)) {
    return true;
  }

  // If excerpt is long (e.g. > 45 chars), check core window in case of trailing ellipsis or minor whitespace diffs
  if (normExcerpt.length > 45) {
    const coreWindow = normExcerpt.substring(0, 40);
    if (normSource.includes(coreWindow)) {
      return true;
    }
  }

  return false;
}

/**
 * Strict numeric token boundary matcher.
 * Ensures numbers like 500 never match inside 5000, 15000, or 50000.
 */
export function matchesNumericToken(text: string, num: number): boolean {
  if (typeof num !== 'number' || isNaN(num)) return false;

  // Normalize comma-separated digits in text (e.g. "5,000" -> "5000", "42,00,000" -> "4200000")
  const normText = text.replace(/(\d),(\d)/g, '$1$2').toLowerCase();

  // Handle integers vs decimals
  const numStr = String(num);
  const escapedNum = numStr.replace(/\./g, '\\.');

  // Boundary regex: not preceded or followed by digits or decimal point
  const pattern = new RegExp(`(?<![\\d.])${escapedNum}(?:\\.00?)?(?![\\d.])`, 'i');
  return pattern.test(normText);
}

/**
 * Deterministically checks whether a cited source excerpt genuinely supports the extracted value
 * and whether the excerpt is substantiated by actual source text.
 *
 * Evidence Hierarchy:
 * 1. source_verified: Value corroborated by excerpt AND excerpt verified in sourceText (isVerified: true)
 * 2. excerpt_corroborated: Value strictly corroborated by excerpt, but sourceText unverified / unavailable (isVerified: false)
 * 3. ai_extracted: Value/citation returned by AI, but uncorroborated or excerpt missing from sourceText (isVerified: false)
 * 4. unverified: Citation missing, placeholder, or contradictory (isVerified: false)
 */
export function verifySourceSubstantiation(
  value: any,
  rawText?: string | null,
  pageClauseRef?: string | null,
  fieldKey?: keyof ExtractedLoanFields,
  sourceText?: string | null
): SourceVerificationResult {
  // 1. Validate pageClauseRef
  if (!pageClauseRef || typeof pageClauseRef !== 'string') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Page reference not detected in document text',
      details: 'Evidence not verified / Insufficient evidence',
    };
  }
  const cleanRef = pageClauseRef.trim().toLowerCase();
  if (cleanRef.length < 2 || NEGATIVE_REF_PATTERNS.some((p) => cleanRef.includes(p))) {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Page reference not detected in document text',
      details: 'Evidence not verified / Insufficient evidence',
    };
  }

  // 2. Validate rawText presence and substantiveness
  if (!rawText || typeof rawText !== 'string') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Missing source excerpt',
      details: 'Evidence not verified / Insufficient evidence',
    };
  }
  const cleanRaw = rawText.trim();
  const lowerRaw = cleanRaw.toLowerCase();
  if (cleanRaw.length < 4 || PLACEHOLDER_RAW_PATTERNS.some((p) => lowerRaw === p || lowerRaw.startsWith(p))) {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Verbatim excerpt missing or placeholder in document text',
      details: 'Evidence not verified: excerpt does not substantiate value',
    };
  }

  // 3. Value check
  if (value === null || value === undefined || value === '') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'No extracted value to substantiate',
      details: 'Evidence not verified / Insufficient evidence',
    };
  }

  // 4. Value-specific strict substantiation
  let isCorroborated = true;
  let failReason: string | undefined;

  if (fieldKey === 'loanAmount' && typeof value === 'number') {
    const lakhs = value / 100000;
    const crores = value / 10000000;

    const matchesNumber =
      matchesNumericToken(lowerRaw, value) ||
      (lakhs >= 0.01 &&
        new RegExp(`(?<![\\d.])${lakhs}\\s*(?:lakh|lac)s?(?![\\w])`, 'i').test(lowerRaw)) ||
      (crores >= 0.01 &&
        new RegExp(`(?<![\\d.])${crores}\\s*(?:crore|cr)s?(?![\\w])`, 'i').test(lowerRaw));

    if (!matchesNumber) {
      isCorroborated = false;
      failReason = 'Source text does not substantiate extracted loan amount';
    }
  } else if ((fieldKey === 'interestRate' || fieldKey === 'apr') && typeof value === 'number') {
    const matchesRate = matchesNumericToken(lowerRaw, value);
    if (!matchesRate) {
      isCorroborated = false;
      failReason = `Source text does not substantiate extracted ${fieldKey}`;
    }
  } else if (fieldKey === 'tenureMonths' && typeof value === 'number') {
    const years = value / 12;
    const matchesTenure =
      matchesNumericToken(lowerRaw, value) ||
      (value % 12 === 0 &&
        new RegExp(`(?<![\\d.])${years}\\s*(?:years?|yrs?)(?![\\w])`, 'i').test(lowerRaw));
    if (!matchesTenure) {
      isCorroborated = false;
      failReason = 'Source text does not substantiate extracted tenure';
    }
  } else if (fieldKey === 'emi' && typeof value === 'number') {
    const matchesEmi = matchesNumericToken(lowerRaw, value);
    if (!matchesEmi) {
      isCorroborated = false;
      failReason = 'Source text does not substantiate extracted EMI';
    }
  } else if (fieldKey === 'processingFees') {
    if (typeof value === 'number' && value > 0) {
      // Must strictly match the numeric amount or percentage; generic "fee" or "processing" alone is rejected
      const matchesFeeAmount = matchesNumericToken(lowerRaw, value);
      const matchesFeePercent =
        lowerRaw.includes('%') && /\b(?:0?\.\d+|\d+)%/.test(lowerRaw);

      if (!matchesFeeAmount && !matchesFeePercent) {
        isCorroborated = false;
        failReason = 'Source text does not substantiate extracted processing fee amount';
      }
    } else {
      const matchesNil =
        lowerRaw.includes('nil') ||
        lowerRaw.includes('zero') ||
        lowerRaw.includes('waived') ||
        lowerRaw.includes('waiver') ||
        lowerRaw.includes('free') ||
        lowerRaw.includes('0%') ||
        matchesNumericToken(lowerRaw, 0);

      if (!matchesNil) {
        isCorroborated = false;
        failReason = 'Source text does not substantiate processing fee waiver';
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
      isCorroborated = false;
      failReason = 'Source text does not contain insurance terms';
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
      isCorroborated = false;
      failReason = 'Source text does not contain penal charge provisions';
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
      isCorroborated = false;
      failReason = 'Source text does not contain prepayment or foreclosure provisions';
    }
  }

  // If corroboration failed under strict rules
  if (!isCorroborated) {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: failReason || 'Source text does not substantiate extracted value',
      details: 'Evidence not verified: excerpt does not substantiate value',
    };
  }

  // 5. Corroboration passed: evaluate against actual source document text
  if (sourceText && typeof sourceText === 'string' && sourceText.trim().length > 10) {
    const foundInSource = verifyExcerptInSourceText(rawText, sourceText);
    if (foundInSource) {
      return {
        isVerified: true,
        verificationLevel: 'source_verified',
        details: 'Source independently verified in document text',
      };
    } else {
      return {
        isVerified: false,
        verificationLevel: 'ai_extracted',
        reason: 'AI excerpt does not exist in provided document text',
        details: 'AI-extracted — excerpt not found in document text',
      };
    }
  }

  // When sourceText is unavailable (e.g. binary/scanned PDFs processed multimodally)
  return {
    isVerified: false,
    verificationLevel: 'excerpt_corroborated',
    details: 'Excerpt corroborated — source document text not independently verified',
  };
}
