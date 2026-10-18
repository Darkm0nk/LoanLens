import {
  ExtractedLoanFields,
  SourceVerificationLevel,
  LocationVerificationStatus,
} from '../types/loan';

export interface SourceVerificationResult {
  isVerified: boolean;
  verificationLevel: SourceVerificationLevel;
  reason?: string;
  details?: string;
  isLocationVerified?: boolean;
  locationStatus?: LocationVerificationStatus;
  locationDetails?: string;
}

export interface FieldSubstantiationMetadata {
  percentage?: number | null;
  isMandatory?: boolean | null;
  isCompoundedInterest?: boolean | null;
  isRbiCompliant?: boolean | null;
  hasPenalty?: boolean | null;
  isFloatingNilExempt?: boolean | null;
  rateType?: string | null;
}

export interface LocationVerificationResult {
  isLocationVerified: boolean;
  locationStatus: LocationVerificationStatus;
  details: string;
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

const GENERIC_EXCERPT_PATTERNS = [
  'interest rate',
  'rate of interest',
  'processing fee',
  'processing fees',
  'processing charges',
  'loan amount',
  'sanctioned amount',
  'repayment tenure',
  'loan agreement',
  'sanction letter',
  'key facts statement',
  'bank policy',
  'schedule a',
  'schedule b',
  'terms and conditions',
  'penal charges',
  'prepayment charges',
  'foreclosure charges',
];

/**
 * Normalizes text for reliable substring matching across whitespace and formatting variations.
 */
export function normalizeTextForMatching(text: string): string {
  return text
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[“”"']/g, '"')
    .replace(/[’‘‚‛]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether an excerpt exists in the actual document source text.
 * Requires full normalized substring match or strictly corroborated ellipsis segments.
 * Unconditional prefix windows (such as matching only the first 40 characters) are disallowed.
 */
export function verifyExcerptInSourceText(
  excerpt?: string | null,
  sourceText?: string | null
): boolean {
  if (!excerpt || typeof excerpt !== 'string' || !sourceText || typeof sourceText !== 'string') {
    return false;
  }
  const cleanExcerpt = excerpt.replace(/^["'“”‘«]+|["'“”’»]+$/g, '').trim();
  // Minimum length check: at least 10 characters required for distinctive excerpt evidence
  if (cleanExcerpt.length < 10) return false;

  const normExcerpt = normalizeTextForMatching(cleanExcerpt);
  const normSource = normalizeTextForMatching(sourceText);

  if (!normSource || normSource.length < 10) return false;

  // Generic phrase rejection: generic boilerplate without distinctive terms cannot independently verify a source match
  const strippedExcerpt = normExcerpt.replace(/[:.-]+$/, '').trim();
  if (GENERIC_EXCERPT_PATTERNS.includes(strippedExcerpt)) {
    return false;
  }

  // 1. Direct full normalized substring match
  if (normSource.includes(normExcerpt)) {
    return true;
  }

  // 2. Truncation / Ellipsis support:
  // An excerpt is only treated as truncated if it explicitly contains an ellipsis ('...' or '…')
  const hasEllipsis = /\.{3,}|…/.test(cleanExcerpt);
  if (hasEllipsis) {
    const rawSegments = normExcerpt.split(/\s*(?:\.{3,}|…)\s*/);
    // Filter segments that have substantive distinctive length (>= 6 chars)
    const segments = rawSegments.map((s) => s.trim()).filter((s) => s.length >= 6);

    if (segments.length === 0) return false;

    // Total length of all valid segments must be at least 12 characters to provide distinctive evidence
    const totalDistinctiveChars = segments.reduce((acc, s) => acc + s.length, 0);
    if (totalDistinctiveChars < 12) return false;

    // Check that ALL segments occur in normSource in strict sequential order
    let lastIdx = 0;
    for (const seg of segments) {
      const idx = normSource.indexOf(seg, lastIdx);
      if (idx === -1) {
        return false; // Segment missing or out of order (fabricated continuation / omitted text not present)
      }
      lastIdx = idx + seg.length;
    }
    return true;
  }

  // No partial match without explicit ellipsis. Fabricated continuations strictly fail!
  return false;
}

/**
 * Validates cited page and clause provenance against actual source evidence.
 */
export function verifyCitationLocation(
  pageClauseRef?: string | null,
  sourceText?: string | null
): LocationVerificationResult {
  if (!pageClauseRef || typeof pageClauseRef !== 'string') {
    return {
      isLocationVerified: false,
      locationStatus: 'not_cited',
      details: 'Page reference not detected in document text',
    };
  }

  const cleanRef = pageClauseRef.trim();
  const lowerRef = cleanRef.toLowerCase();

  if (cleanRef.length < 2 || NEGATIVE_REF_PATTERNS.some((p) => lowerRef.includes(p))) {
    return {
      isLocationVerified: false,
      locationStatus: 'not_cited',
      details: 'Page reference not detected in document text',
    };
  }

  // When sourceText is unavailable (e.g. binary/scanned PDFs or unextracted files)
  if (!sourceText || typeof sourceText !== 'string' || sourceText.trim().length < 10) {
    return {
      isLocationVerified: false,
      locationStatus: 'ai_reported',
      details: 'Citation location is AI-reported; physical document text was not locally available for location verification',
    };
  }

  const normSource = normalizeTextForMatching(sourceText);

  // Check for clause / schedule / section / item reference in citation
  // e.g. "Clause 4.1", "Clause 2", "Section 3", "Schedule A", "Item 8", "Article 5"
  const clauseMatch = cleanRef.match(/\b(?:clause|section|schedule|item|article)\s+([a-z0-9]+(?:\.[a-z0-9]+)*)/i);
  let clauseFoundInSource = false;
  let clauseCited = false;

  if (clauseMatch) {
    clauseCited = true;
    const clauseKeyword = clauseMatch[0].toLowerCase(); // e.g. "clause 4.1"
    clauseFoundInSource = normSource.includes(clauseKeyword);
    if (!clauseFoundInSource) {
      return {
        isLocationVerified: false,
        locationStatus: 'unverified',
        details: `Cited ${clauseMatch[0]} was not found in source text`,
      };
    }
  }

  // Check for page reference in citation (e.g. "Page 4", "p. 4", "Page 12")
  const pageMatch = cleanRef.match(/\b(?:page|p\.)\s*(\d+)\b/i);
  if (pageMatch) {
    const citedPageNum = pageMatch[1];
    // Check if source text contains explicit page markers
    const hasPageMarkers = /(?:\bpage|\bp\.)\s*\d+\b|---\s*page\s*\d+\s*---|\[page\s*\d+\]|\f/i.test(sourceText);

    if (hasPageMarkers) {
      // Find all page numbers present in source text
      const pageRegex = /(?:\bpage|\bp\.)\s*(\d+)\b/gi;
      const pagesInSource = new Set<string>();
      let pMatch;
      while ((pMatch = pageRegex.exec(sourceText)) !== null) {
        pagesInSource.add(pMatch[1]);
      }

      if (!pagesInSource.has(citedPageNum)) {
        return {
          isLocationVerified: false,
          locationStatus: 'unverified',
          details: `Cited Page ${citedPageNum} does not exist in source text (detected pages: ${Array.from(pagesInSource).join(', ') || 'none'})`,
        };
      }

      return {
        isLocationVerified: true,
        locationStatus: 'verified',
        details: `Page ${citedPageNum}${clauseCited ? ` and ${clauseMatch![0]}` : ''} verified in source text`,
      };
    } else {
      // Source text is unpaginated plain text
      if (clauseCited && clauseFoundInSource) {
        return {
          isLocationVerified: true,
          locationStatus: 'verified',
          details: `${clauseMatch![0]} verified in source text; document text is unpaginated`,
        };
      }
      return {
        isLocationVerified: false,
        locationStatus: 'unpaginated_source',
        details: 'Document text is unpaginated; exact page number is AI-reported and cannot be independently confirmed',
      };
    }
  }

  // If no page cited, but clause cited and confirmed
  if (clauseCited && clauseFoundInSource) {
    return {
      isLocationVerified: true,
      locationStatus: 'verified',
      details: `${clauseMatch![0]} verified in source text`,
    };
  }

  // If the citation text itself is directly found in source text (e.g. "Schedule B Table 2")
  const normRef = normalizeTextForMatching(cleanRef);
  if (normSource.includes(normRef)) {
    return {
      isLocationVerified: true,
      locationStatus: 'verified',
      details: 'Citation marker verified in source text',
    };
  }

  return {
    isLocationVerified: false,
    locationStatus: 'unverified',
    details: 'Citation location could not be confirmed in source text',
  };
}

/**
 * Strict numeric token boundary matcher.
 * Ensures numbers like 500 never match inside 5000, 15000, or 50000.
 */
export function matchesNumericToken(text: string, num: number): boolean {
  if (typeof num !== 'number' || isNaN(num)) return false;

  // Normalize comma-separated digits in text (e.g. "5,000" -> "5000", "42,00,000" -> "4200000")
  const normText = text.replace(/(\d),(\d)/g, '$1$2').toLowerCase();

  const numStr = String(num);

  let patternStr: string;
  if (numStr.includes('.')) {
    const [intPart, decPart] = numStr.split('.');
    // Allow trailing zeros on decimal representations in text (e.g. 0.5 matching 0.50 or 0.50%)
    patternStr = `(?<![\\d.])${intPart}\\.${decPart}0*(?![\\d.])`;
  } else {
    // Integer allows optional .0 or .00
    patternStr = `(?<![\\d.])${numStr}(?:\\.0+)?(?![\\d.])`;
  }

  const pattern = new RegExp(patternStr, 'i');
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
  sourceText?: string | null,
  metadata?: FieldSubstantiationMetadata
): SourceVerificationResult {
  // 1. Validate pageClauseRef
  if (!pageClauseRef || typeof pageClauseRef !== 'string') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Page reference not detected in document text',
      details: 'Evidence not verified / Insufficient evidence',
      isLocationVerified: false,
      locationStatus: 'not_cited',
      locationDetails: 'Page reference not detected in document text',
    };
  }
  const cleanRef = pageClauseRef.trim().toLowerCase();
  if (cleanRef.length < 2 || NEGATIVE_REF_PATTERNS.some((p) => cleanRef.includes(p))) {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Page reference not detected in document text',
      details: 'Evidence not verified / Insufficient evidence',
      isLocationVerified: false,
      locationStatus: 'not_cited',
      locationDetails: 'Page reference not detected in document text',
    };
  }

  // 2. Validate rawText presence and substantiveness
  if (!rawText || typeof rawText !== 'string') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'Missing source excerpt',
      details: 'Evidence not verified / Insufficient evidence',
      isLocationVerified: false,
      locationStatus: 'unverified',
      locationDetails: 'Location unverified due to missing excerpt',
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
      isLocationVerified: false,
      locationStatus: 'unverified',
      locationDetails: 'Location unverified due to placeholder excerpt',
    };
  }

  // 3. Value check
  if (value === null || value === undefined || value === '') {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: 'No extracted value to substantiate',
      details: 'Evidence not verified / Insufficient evidence',
      isLocationVerified: false,
      locationStatus: 'unverified',
      locationDetails: 'No value extracted to substantiate',
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
    const hasFeeContext =
      lowerRaw.includes('fee') ||
      lowerRaw.includes('processing') ||
      lowerRaw.includes('charge') ||
      lowerRaw.includes('administrative') ||
      lowerRaw.includes('upfront') ||
      lowerRaw.includes('login') ||
      lowerRaw.includes('origination');

    if (!hasFeeContext) {
      isCorroborated = false;
      failReason = 'Source excerpt does not contain fee-related context';
    } else if (typeof value === 'number' && value > 0) {
      // Must strictly match the numeric amount or contextual fee percentage
      const matchesFeeAmount = matchesNumericToken(lowerRaw, value);

      // Fee percentage matching:
      // Percentage must be explicitly tied to processing fee context, NOT interest rate, APR, tax/GST, or prepayment penalty
      const feePctRegex = /(?:processing|administrative|upfront|login|origination)\s*(?:fee|charges?|cost)?\s*(?:of|at|@|:)?\s*(\d+(?:\.\d+)?)\s*%/i;
      const pctFeeRegex = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s*(?:the\s*)?(?:loan|sanctioned)\s*amount)?\s*(?:as|towards)?\s*(?:processing|administrative|upfront|login)\s*(?:fee|charges?)/i;

      let matchesFeePercent = false;
      if (typeof metadata?.percentage === 'number' && !isNaN(metadata.percentage) && metadata.percentage > 0) {
        const pctMatches = matchesNumericToken(lowerRaw, metadata.percentage);
        const pctInFeeContext = feePctRegex.test(lowerRaw) || pctFeeRegex.test(lowerRaw);
        matchesFeePercent = pctMatches && pctInFeeContext;
      } else {
        matchesFeePercent = feePctRegex.test(lowerRaw) || pctFeeRegex.test(lowerRaw);
      }

      if (!matchesFeeAmount && !matchesFeePercent) {
        isCorroborated = false;
        failReason = 'Source text does not substantiate extracted processing fee amount or percentage';
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
      lowerRaw.includes('cover');

    if (!hasInsuranceKeyword && !lowerRaw.includes('nil') && !lowerRaw.includes('optional')) {
      isCorroborated = false;
      failReason = 'Source text does not contain insurance terms';
    } else {
      // 1. If numeric premium is extracted (> 0)
      if (typeof value === 'number' && value > 0) {
        const lakhs = value / 100000;
        const matchesPremium =
          matchesNumericToken(lowerRaw, value) ||
          (lakhs >= 0.01 && new RegExp(`(?<![\\d.])${lakhs}\\s*(?:lakh|lac)s?(?![\\w])`, 'i').test(lowerRaw));
        if (!matchesPremium) {
          isCorroborated = false;
          failReason = 'Source text mentions insurance but does not substantiate the extracted premium amount';
        }
      } else if (value === 0) {
        const matchesZero =
          lowerRaw.includes('nil') ||
          lowerRaw.includes('zero') ||
          lowerRaw.includes('optional') ||
          lowerRaw.includes('waived') ||
          lowerRaw.includes('not opted') ||
          matchesNumericToken(lowerRaw, 0);
        if (!matchesZero) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate insurance waiver or ₹0 premium';
        }
      }

      // 2. Mandatory status assertion verification
      if (isCorroborated && metadata?.isMandatory === true) {
        const matchesMandatory =
          lowerRaw.includes('mandatory') ||
          lowerRaw.includes('compulsory') ||
          lowerRaw.includes('condition precedent') ||
          lowerRaw.includes('obligatory') ||
          lowerRaw.includes('required as condition');
        if (!matchesMandatory) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate claim that insurance is mandatory';
        }
      } else if (isCorroborated && metadata?.isMandatory === false) {
        const matchesOptional =
          lowerRaw.includes('optional') ||
          lowerRaw.includes('voluntary') ||
          lowerRaw.includes('borrower') ||
          lowerRaw.includes('not mandatory') ||
          lowerRaw.includes('at discretion');
        if (!matchesOptional) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate claim that insurance is voluntary or optional';
        }
      }
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
    } else {
      // Check numeric amount or rate if string value contains numbers
      const numMatch = String(value).match(/\b\d+(?:,\d+)*(?:\.\d+)?\b/);
      if (numMatch) {
        const parsedNum = parseFloat(numMatch[0].replace(/,/g, ''));
        if (!isNaN(parsedNum) && parsedNum > 0) {
          if (!matchesNumericToken(lowerRaw, parsedNum)) {
            isCorroborated = false;
            failReason = 'Source text does not substantiate the specific penal charge amount/rate';
          }
        }
      }

      // Compounded interest assertion check
      if (isCorroborated && metadata?.isCompoundedInterest === true) {
        const hasCompound =
          lowerRaw.includes('compound') ||
          lowerRaw.includes('compounded') ||
          lowerRaw.includes('compounding') ||
          lowerRaw.includes('penal interest on overdue') ||
          lowerRaw.includes('capitalized');
        if (!hasCompound) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate compounded penal interest assertion';
        }
      }

      // Regulatory compliance assertion check
      if (isCorroborated && metadata?.isRbiCompliant === true) {
        const hasComplianceEvidence =
          lowerRaw.includes('flat') ||
          lowerRaw.includes('no penal interest') ||
          lowerRaw.includes('no compounding') ||
          lowerRaw.includes('not compounded') ||
          lowerRaw.includes('not capitalized') ||
          lowerRaw.includes('rbi compliant') ||
          lowerRaw.includes('reasonable flat charge') ||
          lowerRaw.includes('simple penal charge');
        if (!hasComplianceEvidence) {
          isCorroborated = false;
          failReason = 'Source text does not provide evidence of RBI-compliant simple penal charge structure';
        }
      }
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
    } else {
      // Penalty assertion check
      if (metadata?.hasPenalty === true) {
        const hasPenaltyTerms =
          lowerRaw.includes('penalty') ||
          lowerRaw.includes('charge') ||
          lowerRaw.includes('fee') ||
          lowerRaw.includes('levied') ||
          lowerRaw.includes('applicable') ||
          lowerRaw.includes('lock-in') ||
          lowerRaw.includes('%');
        const isOnlyWaiver =
          (lowerRaw.includes('nil') || lowerRaw.includes('zero') || lowerRaw.includes('no prepayment')) &&
          !lowerRaw.includes('except') && !lowerRaw.includes('unless');

        if (!hasPenaltyTerms || isOnlyWaiver) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate prepayment penalty assertion';
        }
      } else if (metadata?.hasPenalty === false || metadata?.isFloatingNilExempt === true) {
        const hasWaiverTerms =
          lowerRaw.includes('nil') ||
          lowerRaw.includes('zero') ||
          lowerRaw.includes('no prepayment') ||
          lowerRaw.includes('no foreclosure') ||
          lowerRaw.includes('0%') ||
          lowerRaw.includes('free') ||
          lowerRaw.includes('waived') ||
          lowerRaw.includes('waiver');

        if (!hasWaiverTerms) {
          isCorroborated = false;
          failReason = 'Source text does not substantiate prepayment fee waiver or nil penalty';
        }
      }
    }
  }

  // Location provenance check
  const locRes = verifyCitationLocation(pageClauseRef, sourceText);

  // If corroboration failed under strict rules
  if (!isCorroborated) {
    return {
      isVerified: false,
      verificationLevel: 'unverified',
      reason: failReason || 'Source text does not substantiate extracted value',
      details: 'Evidence not verified: excerpt does not substantiate value',
      isLocationVerified: false,
      locationStatus: 'unverified',
      locationDetails: 'Location unverified due to unsubstantiated excerpt',
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
        isLocationVerified: locRes.isLocationVerified,
        locationStatus: locRes.locationStatus,
        locationDetails: locRes.details,
      };
    } else {
      return {
        isVerified: false,
        verificationLevel: 'ai_extracted',
        reason: 'AI excerpt does not exist in provided document text',
        details: 'AI-extracted — excerpt not found in document text',
        isLocationVerified: false,
        locationStatus: locRes.locationStatus,
        locationDetails: locRes.details,
      };
    }
  }

  // When sourceText is unavailable (e.g. binary/scanned PDFs processed multimodally)
  return {
    isVerified: false,
    verificationLevel: 'excerpt_corroborated',
    details: 'Excerpt corroborated — source document text not independently verified',
    isLocationVerified: false,
    locationStatus: 'ai_reported',
    locationDetails: locRes.details,
  };
}
