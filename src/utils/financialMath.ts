/**
 * Deterministic financial calculations for Indian retail loan evaluation.
 * Uses standard standard monthly-rest compounding (reducing balance method).
 */

export interface EmiCalculationResult {
  monthlyEmi: number;
  totalPayment: number;
  totalInterest: number;
  isExact: boolean;
  assumptions: string[];
}

export interface LifetimeImpactComparison {
  canCalculate: boolean;
  reason?: string;
  emiDifferenceMonthly: number;
  principalDifference: number;
  lifetimeCostDifference: number;
  lifetimeInterestDifference: number;
  assumptions: string[];
}

/**
 * Calculates monthly EMI using the standard formula:
 * E = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 * @param principal Principal loan amount in INR
 * @param annualRatePercent Annual interest rate (e.g. 8.75 for 8.75% p.a.)
 * @param tenureMonths Total tenure in months (e.g. 240 for 20 years)
 */
export function calculateEmi(
  principal: number | null | undefined,
  annualRatePercent: number | null | undefined,
  tenureMonths: number | null | undefined
): EmiCalculationResult | null {
  if (
    principal === null ||
    principal === undefined ||
    isNaN(principal) ||
    principal <= 0 ||
    annualRatePercent === null ||
    annualRatePercent === undefined ||
    isNaN(annualRatePercent) ||
    annualRatePercent < 0 ||
    tenureMonths === null ||
    tenureMonths === undefined ||
    isNaN(tenureMonths) ||
    tenureMonths <= 0
  ) {
    return null;
  }

  // Handle 0% interest edge case
  if (annualRatePercent === 0) {
    const monthlyEmi = Math.round(principal / tenureMonths);
    return {
      monthlyEmi,
      totalPayment: principal,
      totalInterest: 0,
      isExact: true,
      assumptions: [
        'Zero percent promotional interest rate applied.',
        'Equal principal amortization over tenure.',
      ],
    };
  }

  const monthlyRate = annualRatePercent / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emiUnrounded = (principal * monthlyRate * factor) / (factor - 1);
  const monthlyEmi = Math.round(emiUnrounded);

  const totalPayment = monthlyEmi * tenureMonths;
  const totalInterest = totalPayment - principal;

  return {
    monthlyEmi,
    totalPayment,
    totalInterest,
    isExact: true,
    assumptions: [
      'Standard reducing balance monthly amortization schedule.',
      'Assumes a constant interest rate throughout the entire tenure with no prepayments or benchmark revisions.',
      'Actual repayments on floating-rate loans will adjust with external benchmark resets.',
    ],
  };
}

/**
 * Compares two loan scenarios deterministically to compute the exact lifetime cost variance.
 * Never guesses or uses arbitrary multipliers.
 */
export function compareLifetimeImpact(
  baseLoan: { principal?: number | null; ratePercent?: number | null; tenureMonths?: number | null },
  comparisonLoan: { principal?: number | null; ratePercent?: number | null; tenureMonths?: number | null }
): LifetimeImpactComparison {
  const missingFields: string[] = [];
  if (!baseLoan.principal || baseLoan.principal <= 0) missingFields.push('base principal');
  if (baseLoan.ratePercent === null || baseLoan.ratePercent === undefined || baseLoan.ratePercent < 0) missingFields.push('base interest rate');
  if (!baseLoan.tenureMonths || baseLoan.tenureMonths <= 0) missingFields.push('base tenure');

  if (!comparisonLoan.principal || comparisonLoan.principal <= 0) missingFields.push('comparison principal');
  if (comparisonLoan.ratePercent === null || comparisonLoan.ratePercent === undefined || comparisonLoan.ratePercent < 0) missingFields.push('comparison interest rate');
  if (!comparisonLoan.tenureMonths || comparisonLoan.tenureMonths <= 0) missingFields.push('comparison tenure');

  if (missingFields.length > 0) {
    return {
      canCalculate: false,
      reason: 'Insufficient information to estimate',
      emiDifferenceMonthly: 0,
      principalDifference: 0,
      lifetimeCostDifference: 0,
      lifetimeInterestDifference: 0,
      assumptions: [
        `Insufficient information to estimate: Required loan parameters are missing (${missingFields.join(', ')}). Requires verified principal, interest rate, and tenure across compared documents.`,
      ],
    };
  }

  const baseResult = calculateEmi(baseLoan.principal, baseLoan.ratePercent, baseLoan.tenureMonths);
  const compResult = calculateEmi(comparisonLoan.principal, comparisonLoan.ratePercent, comparisonLoan.tenureMonths);

  if (!baseResult || !compResult) {
    return {
      canCalculate: false,
      reason: 'Insufficient information to estimate',
      emiDifferenceMonthly: 0,
      principalDifference: 0,
      lifetimeCostDifference: 0,
      lifetimeInterestDifference: 0,
      assumptions: [
        'Insufficient information to estimate: Failed to compute monthly amortization schedule for supplied parameters.',
      ],
    };
  }

  const emiDifferenceMonthly = compResult.monthlyEmi - baseResult.monthlyEmi;
  const principalDifference = (comparisonLoan.principal || 0) - (baseLoan.principal || 0);
  const lifetimeCostDifference = compResult.totalPayment - baseResult.totalPayment;
  const lifetimeInterestDifference = compResult.totalInterest - baseResult.totalInterest;

  return {
    canCalculate: true,
    emiDifferenceMonthly,
    principalDifference,
    lifetimeCostDifference,
    lifetimeInterestDifference,
    assumptions: [
      `Assumed Principal: Base ₹${(baseLoan.principal || 0).toLocaleString('en-IN')} vs Comparison ₹${(comparisonLoan.principal || 0).toLocaleString('en-IN')}`,
      `Assumed Interest Rate: Base ${(baseLoan.ratePercent || 0).toFixed(2)}% p.a. vs Comparison ${(comparisonLoan.ratePercent || 0).toFixed(2)}% p.a.`,
      `Assumed Tenure: ${baseLoan.tenureMonths} months (${((baseLoan.tenureMonths || 0) / 12).toFixed(1)} yrs)`,
      `Repayment Method: Equated Monthly Installment (standard monthly-rest reducing balance amortization)`,
      `Monthly Outflow: ₹${baseResult.monthlyEmi.toLocaleString('en-IN')}/month (Base) vs ₹${compResult.monthlyEmi.toLocaleString('en-IN')}/month (Comparison) [Difference: ₹${Math.abs(emiDifferenceMonthly).toLocaleString('en-IN')}/month]`,
      `Lifetime Cost: ₹${baseResult.totalPayment.toLocaleString('en-IN')} (Base) vs ₹${compResult.totalPayment.toLocaleString('en-IN')} (Comparison) [Variance: ~₹${Math.abs(lifetimeCostDifference).toLocaleString('en-IN')}]`,
      'Constant benchmark spread assumed throughout full tenure with zero prepayments. Floating-rate facilities adjust with external benchmark resets.',
    ],
  };
}
