export type LoanDocumentType = 'kfs' | 'sanction_letter' | 'loan_agreement';

export interface FieldExtraction<T = any> {
  value: T;
  rawText: string;
  pageClauseRef: string;
  notes?: string;
  isVerifiedInSource?: boolean;
}

export interface InterestRateField extends FieldExtraction<number | null> {
  rateType: 'floating' | 'fixed' | 'hybrid' | 'unknown';
  benchmark?: string;
}

export interface ProcessingFeeField extends FieldExtraction<number | null> {
  gstDetails?: string;
  percentage?: number | null;
}

export interface InsuranceField extends FieldExtraction<number | null> {
  isMandatory: boolean | null;
  policyName?: string;
}

export interface PenalChargesField extends FieldExtraction<string> {
  isCompoundedInterest: boolean;
  isRbiCompliant: boolean;
}

export interface PrepaymentChargesField extends FieldExtraction<string> {
  hasPenalty: boolean;
  isFloatingNilExempt: boolean;
}

export interface ExtractedLoanFields {
  loanAmount: FieldExtraction<number | null>;
  interestRate: InterestRateField;
  apr: FieldExtraction<number | null>;
  tenureMonths: FieldExtraction<number | null>;
  emi: FieldExtraction<number | null>;
  processingFees: ProcessingFeeField;
  insurance: InsuranceField;
  penalCharges: PenalChargesField;
  prepaymentCharges: PrepaymentChargesField;
}

export interface ExtractedLoanDocument {
  id: string;
  documentType: LoanDocumentType;
  documentName: string;
  uploadDate: string;
  isDemo?: boolean;
  isCombinedPackage?: boolean;
  originFileName?: string;
  originSection?: string;
  lenderName: string;
  borrowerName: string;
  loanType: string;
  fileSize?: string;
  fields: ExtractedLoanFields;
  rawSummary?: string;
}

export type DiscrepancyStatus = 'match' | 'mismatch' | 'missing';
export type DiscrepancySeverity = 'clean' | 'info' | 'warning' | 'critical';

export type FindingClassification =
  | 'Confirmed discrepancy'
  | 'Missing information'
  | 'Possible regulatory concern'
  | 'Needs manual verification';

export interface FieldComparison {
  fieldKey: keyof ExtractedLoanFields;
  label: string;
  status: DiscrepancyStatus;
  severity: DiscrepancySeverity;
  classification?: FindingClassification;
  isSampleData?: boolean;
  values: {
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
  };
  summary: string;
  lenderQuestion: string;
  rbiGuideline: string;
  circularReference?: string;
  sourceUrl?: string;
  verificationNotice?: string;
  financialImpact?: string;
  calculationAssumptions?: string[];
}

export type ReviewRecommendation =
  | 'Terms Aligned Across Documents'
  | 'Clarifications Recommended'
  | 'Review Variances with Lender';

export interface LoanComparisonReport {
  comparedAt: string;
  isDemo: boolean;
  isCombinedPackage?: boolean;
  combinedFileName?: string;
  singleSourceNotice?: string;
  documentsPresent: {
    kfs: boolean;
    sanctionLetter: boolean;
    loanAgreement: boolean;
  };
  lenderName: string;
  borrowerName: string;
  loanType: string;
  totalTermsEvaluated: number;
  matchCount: number;
  mismatchCount: number;
  missingCount: number;
  riskRating: 'Consistent' | 'Minor Variances' | 'Variances Noted';
  keyWarnings: string[];
  recommendation: ReviewRecommendation;
  recommendationNote: string;
  comparisons: FieldComparison[];
}

export type UploadProcessingStage = 'idle' | 'validating' | 'uploading' | 'extracting' | 'completed' | 'failed';

export interface DocumentUploadState {
  file: File | null;
  textInput: string;
  inputMode: 'file' | 'text';
  extractedData: ExtractedLoanDocument | null;
  stage: UploadProcessingStage;
  error: string | null;
}
