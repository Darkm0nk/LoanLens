/**
 * Unit conversion and reconciliation for Indian lending documents.
 * Handles common unit discrepancies between documents:
 * - Tenure in Years vs. Months (e.g. "20 years" vs. "240 months")
 * - Interest Rate in % per Month vs. % per Annum (e.g. "1% p.m." vs. "12% p.a.")
 * - Currency in Lakhs/Crores vs. INR (e.g. "42 Lakhs" vs. "42,00,000")
 */

export interface NormalizedTenure {
  months: number | null;
  originalValue: number | null;
  wasConvertedFromYears: boolean;
  unit: 'months' | 'years' | 'unknown';
}

export interface NormalizedInterestRate {
  ratePAnnum: number | null;
  originalValue: number | null;
  wasConvertedFromMonthly: boolean;
  unit: 'annual' | 'monthly' | 'unknown';
}

export interface NormalizedPrincipal {
  amountInr: number | null;
  originalValue: number | null;
  wasConvertedFromLakhsOrCrores: boolean;
  unit: 'inr' | 'lakhs' | 'crores' | 'unknown';
}

export interface UnitConflictReport {
  hasConflict: boolean;
  conflictType?: 'tenure_unit' | 'interest_rate_unit' | 'currency_unit';
  details?: string;
  isEquivalentAfterConversion: boolean;
}

/**
 * Normalizes tenure into total number of months.
 * In Indian retail lending, a tenure of <= 40 when accompanied by words like
 * "year", "yr", "annum" or when <= 5 represents years, which must be converted to months.
 */
export function normalizeTenure(
  val: number | null | undefined,
  rawText?: string
): NormalizedTenure {
  if (val === null || val === undefined || isNaN(val) || val <= 0) {
    return { months: null, originalValue: null, wasConvertedFromYears: false, unit: 'unknown' };
  }

  const textLower = (rawText || '').toLowerCase();
  const hasMonthKeyword =
    textLower.includes('month') ||
    textLower.includes('installment') ||
    textLower.includes('emi');
  const hasYearKeyword =
    textLower.includes('year') ||
    textLower.includes('yr') ||
    textLower.includes('annum') ||
    textLower.includes('saal');

  // If text mentions months, treat as months
  if (hasMonthKeyword) {
    return {
      months: Math.round(val),
      originalValue: val,
      wasConvertedFromYears: false,
      unit: 'months',
    };
  }

  // If text strictly mentions years and not months (e.g. "20 Years", "3 Yrs")
  if (hasYearKeyword && val <= 35) {
    return {
      months: Math.round(val * 12),
      originalValue: val,
      wasConvertedFromYears: true,
      unit: 'years',
    };
  }

  // If val <= 5 and not marked as months (e.g. 3 or 5 years)
  if (val <= 5 && !hasMonthKeyword) {
    return {
      months: Math.round(val * 12),
      originalValue: val,
      wasConvertedFromYears: true,
      unit: 'years',
    };
  }

  return {
    months: Math.round(val),
    originalValue: val,
    wasConvertedFromYears: false,
    unit: 'months',
  };
}

/**
 * Normalizes interest rates into Annual Percentage (% p.a.).
 * Some NBFCs, micro-finance, or personal loan agreements quote monthly interest rate (e.g. 1.25% p.m.).
 */
export function normalizeInterestRate(
  val: number | null | undefined,
  rawText?: string
): NormalizedInterestRate {
  if (val === null || val === undefined || isNaN(val) || val < 0) {
    return { ratePAnnum: null, originalValue: null, wasConvertedFromMonthly: false, unit: 'unknown' };
  }

  const textLower = (rawText || '').toLowerCase();
  const hasMonthlyKeyword =
    textLower.includes('per month') ||
    textLower.includes('p.m.') ||
    textLower.includes('pm') ||
    textLower.includes('monthly');

  // If explicitly monthly and val <= 3.5%, convert to annual by multiplying by 12
  if (hasMonthlyKeyword && val > 0 && val <= 3.5) {
    return {
      ratePAnnum: +(val * 12).toFixed(2),
      originalValue: val,
      wasConvertedFromMonthly: true,
      unit: 'monthly',
    };
  }

  return {
    ratePAnnum: +(val).toFixed(2),
    originalValue: val,
    wasConvertedFromMonthly: false,
    unit: 'annual',
  };
}

/**
 * Normalizes principal amounts to full INR.
 * Detects if a document extracted 42 instead of 42,00,000 for "42 Lakhs".
 */
export function normalizePrincipal(
  val: number | null | undefined,
  rawText?: string
): NormalizedPrincipal {
  if (val === null || val === undefined || isNaN(val) || val <= 0) {
    return { amountInr: null, originalValue: null, wasConvertedFromLakhsOrCrores: false, unit: 'unknown' };
  }

  const textLower = (rawText || '').toLowerCase();

  // If val < 1000 and text mentions "lakh" or "lac", convert
  if (val < 1000 && (textLower.includes('lakh') || textLower.includes('lac'))) {
    return {
      amountInr: Math.round(val * 100000),
      originalValue: val,
      wasConvertedFromLakhsOrCrores: true,
      unit: 'lakhs',
    };
  }

  // If val < 100 and text mentions "crore" or "cr", convert
  if (val < 100 && (textLower.includes('crore') || textLower.includes('cr'))) {
    return {
      amountInr: Math.round(val * 10000000),
      originalValue: val,
      wasConvertedFromLakhsOrCrores: true,
      unit: 'crores',
    };
  }

  return {
    amountInr: Math.round(val),
    originalValue: val,
    wasConvertedFromLakhsOrCrores: false,
    unit: 'inr',
  };
}

/**
 * Evaluates whether conflicting units are used between documents for tenure.
 */
export function detectTenureUnitConflict(
  docs: Array<{ docType: string; rawValue: number | null; rawText?: string }>
): UnitConflictReport {
  const valid = docs.filter((d) => typeof d.rawValue === 'number' && !isNaN(d.rawValue));
  if (valid.length < 2) {
    return { hasConflict: false, isEquivalentAfterConversion: true };
  }

  const normalized = valid.map((d) => ({
    ...d,
    norm: normalizeTenure(d.rawValue, d.rawText),
  }));

  const hasYears = normalized.some((d) => d.norm.unit === 'years');
  const hasMonths = normalized.some((d) => d.norm.unit === 'months');

  if (hasYears && hasMonths) {
    const allEquivalent = normalized.every(
      (d) => d.norm.months !== null && d.norm.months === normalized[0].norm.months
    );

    return {
      hasConflict: true,
      conflictType: 'tenure_unit',
      isEquivalentAfterConversion: allEquivalent,
      details: allEquivalent
        ? `Conflicting Units Resolved: Documents quote tenure in different units (Years vs Months), but both represent an identical repayment period of ${normalized[0].norm.months} months.`
        : `Conflicting Units & Duration Variance: Documents quote tenure in conflicting units (Years vs Months) and the converted months also differ.`,
    };
  }

  return { hasConflict: false, isEquivalentAfterConversion: true };
}
