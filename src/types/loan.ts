export type LoanDocumentType = 'kfs' | 'sanction_letter' | 'loan_agreement';

export type SourceVerificationLevel =
  | 'source_verified'
  | 'excerpt_corroborated'
  | 'ai_extracted'
  | 'unverified';

export interface FieldExtraction<T = any> {
  value: T;
  rawText: string;
  pageClauseRef: string;
  notes?: string;
  isVerifiedInSource?: boolean;
  verificationLevel?: SourceVerificationLevel;
  verificationDetails?: string;
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

export type RegulatoryComplianceStatus = 'compliant' | 'non_compliant' | 'not_assessed';
export type ForeclosureExemptionStatus = 'exempt' | 'has_penalty' | 'not_assessed';

export interface PenalChargesField extends FieldExtraction<string> {
  isCompoundedInterest: boolean | null;
  isRbiCompliant: boolean | null;
  assessmentStatus?: RegulatoryComplianceStatus;
}

export interface PrepaymentChargesField extends FieldExtraction<string> {
  hasPenalty: boolean | null;
  isFloatingNilExempt: boolean | null;
  assessmentStatus?: ForeclosureExemptionStatus;
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
  sourceText?: string;
  hasIndependentSourceText?: boolean;
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
  regulatoryAssessment?: 'compliant' | 'non_compliant' | 'not_assessed' | 'exempt' | 'has_penalty';
  isSampleData?: boolean;
  values: {
    kfs?: {
      display: string;
      rawText: string;
      pageClauseRef: string;
      notes?: string;
      isVerifiedInSource?: boolean;
      verificationLevel?: SourceVerificationLevel;
      verificationDetails?: string;
    };
    sanctionLetter?: {
      display: string;
      rawText: string;
      pageClauseRef: string;
      notes?: string;
      isVerifiedInSource?: boolean;
      verificationLevel?: SourceVerificationLevel;
      verificationDetails?: string;
    };
    loanAgreement?: {
      display: string;
      rawText: string;
      pageClauseRef: string;
      notes?: string;
      isVerifiedInSource?: boolean;
      verificationLevel?: SourceVerificationLevel;
      verificationDetails?: string;
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
