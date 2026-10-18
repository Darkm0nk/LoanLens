import React, { useEffect } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  FileSearch,
} from 'lucide-react';
import { FieldComparison, FindingClassification } from '../types/loan';

interface SideBySideEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: FieldComparison | null;
  allComparisons?: FieldComparison[];
  onSelectComparison?: (comp: FieldComparison) => void;
  onOpenDisputeLetter?: () => void;
}

export const SideBySideEvidenceModal: React.FC<SideBySideEvidenceModalProps> = ({
  isOpen,
  onClose,
  comparison,
  allComparisons = [],
  onSelectComparison,
  onOpenDisputeLetter,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !comparison) return null;

  // Derive classification if not explicitly set
  const classification: FindingClassification | undefined =
    comparison.classification ||
    (comparison.status === 'match'
      ? undefined
      : comparison.status === 'missing'
      ? 'Missing information'
      : comparison.fieldKey === 'penalCharges' ||
        comparison.fieldKey === 'prepaymentCharges' ||
        comparison.fieldKey === 'insurance'
      ? 'Possible regulatory concern'
      : comparison.values.loanAgreement?.isVerifiedInSource === false ||
        comparison.values.sanctionLetter?.isVerifiedInSource === false ||
        comparison.values.kfs?.isVerifiedInSource === false
      ? 'Needs manual verification'
      : 'Confirmed discrepancy');

  const classificationConfig: Record<
    FindingClassification,
    { label: string; badge: string; bg: string; icon: React.ReactNode; desc: string }
  > = {
    'Confirmed discrepancy': {
      label: 'Confirmed Discrepancy',
      badge: 'bg-rose-100 text-rose-900 border-rose-300',
      bg: 'bg-rose-50/70 border-rose-200',
      icon: <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />,
      desc: 'Extracted values directly conflict between the submitted contract documents.',
    },
    'Missing information': {
      label: 'Missing Information',
      badge: 'bg-sky-100 text-sky-900 border-sky-300',
      bg: 'bg-sky-50/70 border-sky-200',
      icon: <Info className="w-4 h-4 text-sky-700 shrink-0" />,
      desc: 'This term is omitted or not disclosed across all submitted document copies.',
    },
    'Possible regulatory concern': {
      label: 'Possible Regulatory Concern',
      badge: 'bg-amber-100 text-amber-950 border-amber-300',
      bg: 'bg-amber-50/70 border-amber-200',
      icon: <Scale className="w-4 h-4 text-amber-800 shrink-0" />,
      desc: 'Contract clause provisions may diverge from RBI retail lending circular mandates.',
    },
    'Needs manual verification': {
      label: 'Needs Manual Verification',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      bg: 'bg-amber-50/70 border-amber-200',
      icon: <FileSearch className="w-4 h-4 text-amber-700 shrink-0" />,
      desc: 'Clause citation or benchmark wording requires physical inspection of original execution papers.',
    },
  };

  const matchConfig = {
    label: 'Terms Aligned (Match)',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    bg: 'bg-emerald-50/70 border-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />,
    desc: 'Extracted terms and source references align consistently across all submitted contract documents.',
  };

  const currentClass =
    comparison.status === 'match'
      ? matchConfig
      : classification
      ? classificationConfig[classification]
      : classificationConfig['Needs manual verification'];

  // Discrepancy navigation
  const currentIndex = allComparisons.findIndex((c) => c.fieldKey === comparison.fieldKey);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allComparisons.length - 1;

  function handleCopyQuestion() {
    if (!comparison?.lenderQuestion) return;
    navigator.clipboard.writeText(comparison.lenderQuestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Highlight key numbers / percentages / terms in contract excerpt
  function renderHighlightedExcerpt(rawText: string | undefined, isPlaceholder: boolean) {
    if (!rawText || isPlaceholder || rawText === 'Not specified in document') {
      return (
        <div className="p-3 bg-slate-100/80 rounded border border-dashed border-slate-300 text-xs text-slate-500 italic">
          No verbatim excerpt could be recovered from this document. Manual verification against the physical contract is required.
        </div>
      );
    }

    // Highlight money amounts, percentages, months, years, or key terms
    const parts = rawText.split(
      /(\b(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:lakhs?|cr|crores?|months?|years?|bps|p\.a\.)|₹\s*[\d,]+(?:\.\d+)?|compound(?:ing|ed)?|floating|fixed|mandatory|penal interest)\b)/gi
    );

    return (
      <div className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono leading-relaxed border border-slate-800 whitespace-pre-wrap select-text">
        {parts.map((part, i) => {
          const isHighlight =
            /\b(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:lakhs?|cr|crores?|months?|years?|bps|p\.a\.)|₹\s*[\d,]+|compound|floating|fixed|mandatory|penal interest)/i.test(
              part
            );
          return isHighlight ? (
            <mark
              key={i}
              className="bg-teal-500/30 text-teal-200 font-bold px-1 py-0.5 rounded border border-teal-400/40"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </div>
    );
  }

  function renderEvidenceReference(val?: {
    pageClauseRef: string;
    isVerifiedInSource?: boolean;
    verificationLevel?: string;
    verificationDetails?: string;
  }) {
    if (!val?.pageClauseRef || val.pageClauseRef === 'Not cited' || val.pageClauseRef.includes('not detected')) {
      return (
        <div className="flex items-center gap-1 text-slate-400 text-[11px] mt-0.5 italic">
          <span>Page reference not detected in document text</span>
        </div>
      );
    }
    if (
      val.verificationLevel === 'unverified' ||
      (val.isVerifiedInSource === false && (!val.verificationLevel || val.verificationLevel === 'unverified')) ||
      val.pageClauseRef.includes('not verified')
    ) {
      return (
        <div className="mt-0.5 space-y-1">
          <div className="flex items-center gap-1 text-amber-800 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{val.pageClauseRef}</span>
          </div>
          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Evidence Not Verified
          </span>
        </div>
      );
    }
    if (val.verificationLevel === 'source_verified' || val.isVerifiedInSource === true) {
      return (
        <div className="mt-0.5 space-y-1">
          <div className="flex items-center gap-1 text-emerald-800 font-medium text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{val.pageClauseRef}</span>
          </div>
          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
            Source Text Verified
          </span>
        </div>
      );
    }
    if (val.verificationLevel === 'excerpt_corroborated') {
      return (
        <div className="mt-0.5 space-y-1">
          <div className="flex items-center gap-1 text-slate-800 font-medium text-xs">
            <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>{val.pageClauseRef}</span>
          </div>
          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-100 text-sky-900 border border-sky-300">
            Excerpt Corroborated (Source Unverified)
          </span>
        </div>
      );
    }
    return (
      <div className="mt-0.5 space-y-1">
        <div className="flex items-center gap-1 text-slate-700 font-medium text-xs">
          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{val.pageClauseRef}</span>
        </div>
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
          AI-Extracted (Source Not Verified)
        </span>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="side-by-side-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                Interactive Side-by-Side Audit
              </span>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex items-center gap-1 ${currentClass.badge}`}
              >
                {currentClass.icon}
                <span>{currentClass.label}</span>
              </span>
              {comparison.regulatoryAssessment === 'compliant' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-100 text-emerald-900 border-emerald-300">
                  Confirmed RBI Compliant
                </span>
              )}
              {comparison.regulatoryAssessment === 'exempt' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-emerald-100 text-emerald-900 border-emerald-300">
                  Nil Foreclosure Aligned
                </span>
              )}
              {comparison.regulatoryAssessment === 'non_compliant' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-rose-100 text-rose-900 border-rose-300">
                  Regulatory Variance Noted
                </span>
              )}
              {comparison.regulatoryAssessment === 'has_penalty' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-amber-100 text-amber-950 border-amber-300">
                  Foreclosure Fee Noted
                </span>
              )}
              {comparison.regulatoryAssessment === 'not_assessed' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-300">
                  Compliance Not Assessed
                </span>
              )}
              {comparison.isSampleData && (
                <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  <span>Synthetic Sample Benchmark</span>
                </span>
              )}
            </div>

            <h2 id="side-by-side-title" className="text-xl font-bold text-slate-900">
              {comparison.label}
            </h2>
            <p className="text-xs text-slate-600">{currentClass.desc}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Pagination across findings */}
            {allComparisons.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectComparison?.(allComparisons[currentIndex - 1])}
                  className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Previous term"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1 font-semibold text-slate-700">
                  {currentIndex + 1} / {allComparisons.length}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectComparison?.(allComparisons[currentIndex + 1])}
                  className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Next term"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Finding Summary Banner */}
          <div className={`p-4 rounded-xl border ${currentClass.bg} space-y-2`}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5">{currentClass.icon}</div>
              <div className="flex-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Variance Assessment
                </h3>
                <p className="text-sm text-slate-800 leading-relaxed font-medium mt-0.5">
                  {comparison.summary}
                </p>
              </div>
            </div>

            {/* Financial Impact if present */}
            {comparison.financialImpact && (
              <div className="mt-3 p-3 bg-white/90 rounded-lg border border-slate-200/90 text-xs">
                <span className="font-semibold text-rose-900 block mb-0.5">
                  Calculated Deterministic Financial Impact:
                </span>
                <p className="text-slate-800 leading-snug">{comparison.financialImpact}</p>
                {comparison.calculationAssumptions && comparison.calculationAssumptions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Stated Assumptions: </span>
                    <span>{comparison.calculationAssumptions.join(' • ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3-Way Side-by-Side Document Contract Excerpt Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-teal-700" />
                <span>Side-by-Side Contract Evidence & Clause Excerpts</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Key figures and differing terms highlighted in teal
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. KFS Column */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                    1. Key Facts Statement
                  </span>
                  <span className="text-[10px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    RBI Mandatory
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Extracted Value
                  </span>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {comparison.values.kfs?.display || 'Not Provided / Missing'}
                  </div>
                </div>

                {/* Page / Clause Citation */}
                <div className="text-xs">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block mb-0.5">
                    Source Reference
                  </span>
                  {renderEvidenceReference(comparison.values.kfs)}
                </div>

                {/* Verbatim Excerpt */}
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                    Verbatim Document Excerpt
                  </span>
                  {renderHighlightedExcerpt(
                    comparison.values.kfs?.rawText,
                    !comparison.values.kfs || comparison.values.kfs.rawText === 'Not specified in document'
                  )}
                </div>
              </div>

              {/* 2. Sanction Letter Column */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                    2. Sanction Letter
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                    Lender Approval
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Extracted Value
                  </span>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {comparison.values.sanctionLetter?.display || 'Not Provided / Missing'}
                  </div>
                </div>

                {/* Page / Clause Citation */}
                <div className="text-xs">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block mb-0.5">
                    Source Reference
                  </span>
                  {renderEvidenceReference(comparison.values.sanctionLetter)}
                </div>

                {/* Verbatim Excerpt */}
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                    Verbatim Document Excerpt
                  </span>
                  {renderHighlightedExcerpt(
                    comparison.values.sanctionLetter?.rawText,
                    !comparison.values.sanctionLetter ||
                      comparison.values.sanctionLetter.rawText === 'Not specified in document'
                  )}
                </div>
              </div>

              {/* 3. Loan Agreement Column */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                    3. Loan Agreement
                  </span>
                  <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                    Binding Contract
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    Extracted Value
                  </span>
                  <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {comparison.values.loanAgreement?.display || 'Not Provided / Missing'}
                  </div>
                </div>

                {/* Page / Clause Citation */}
                <div className="text-xs">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block mb-0.5">
                    Source Reference
                  </span>
                  {renderEvidenceReference(comparison.values.loanAgreement)}
                </div>

                {/* Verbatim Excerpt */}
                <div className="flex-1 space-y-1">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                    Verbatim Document Excerpt
                  </span>
                  {renderHighlightedExcerpt(
                    comparison.values.loanAgreement?.rawText,
                    !comparison.values.loanAgreement ||
                      comparison.values.loanAgreement.rawText === 'Not specified in document'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Clarification Question */}
          {comparison.lenderQuestion && (
            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-teal-700" />
                  <span>Clarification Question for Loan Officer</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyQuestion}
                  className="px-2.5 py-1 rounded bg-white hover:bg-teal-100 text-teal-900 text-xs font-semibold border border-teal-300 flex items-center gap-1 shadow-2xs transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied to Clipboard</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-teal-700" />
                      <span>Copy Question</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-800 font-medium bg-white p-3 rounded-lg border border-teal-200 leading-relaxed italic">
                "{comparison.lenderQuestion}"
              </p>
            </div>
          )}

          {/* Official RBI Regulatory Authority Framework */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Scale className="w-4 h-4 text-teal-800 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                  Applicable Regulatory Requirement & Official Authority
                </span>
                <p className="text-slate-700 leading-relaxed">{comparison.rbiGuideline}</p>

                {comparison.circularReference && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="font-semibold text-slate-800">Circular Reference:</span>
                    <span className="font-mono text-[11px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800">
                      {comparison.circularReference}
                    </span>
                    {comparison.sourceUrl && (
                      <a
                        href={comparison.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1 font-semibold ml-2"
                      >
                        <span>Official RBI Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-[11px]">
            <strong>Responsible Audit Notice:</strong> Evidence extracted directly from provided documents. No legal conclusions are implied.
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenDisputeLetter && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDisputeLetter();
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Include in Clarification Notice
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
