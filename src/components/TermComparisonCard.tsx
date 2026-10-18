import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  Check,
  Scale,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Info,
  Sparkles,
} from 'lucide-react';
import { FieldComparison, FindingClassification } from '../types/loan';

interface TermComparisonCardProps {
  comparison: FieldComparison;
  onInspectEvidence?: (comparison: FieldComparison) => void;
}

export const TermComparisonCard: React.FC<TermComparisonCardProps> = ({
  comparison,
  onInspectEvidence,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawExcerpts, setShowRawExcerpts] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const handleCopyQuestion = () => {
    navigator.clipboard.writeText(comparison.lenderQuestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derive classification
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

  const classificationBadge = () => {
    if (!classification || comparison.status === 'match') return null;
    switch (classification) {
      case 'Confirmed discrepancy':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
            Confirmed Discrepancy
          </span>
        );
      case 'Missing information':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-300">
            Missing Information
          </span>
        );
      case 'Possible regulatory concern':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300">
            Possible Regulatory Concern
          </span>
        );
      case 'Needs manual verification':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Needs Manual Verification
          </span>
        );
    }
  };

  const statusBadge = () => {
    switch (comparison.status) {
      case 'match':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Match</span>
          </span>
        );
      case 'mismatch':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Variance Noted</span>
          </span>
        );
      case 'missing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Missing / Incomplete</span>
          </span>
        );
    }
  };

  const regulatoryBadge = () => {
    if (!comparison.regulatoryAssessment) return null;
    switch (comparison.regulatoryAssessment) {
      case 'compliant':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
            Confirmed RBI Compliant
          </span>
        );
      case 'exempt':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
            Nil Foreclosure Aligned
          </span>
        );
      case 'non_compliant':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
            Regulatory Variance Noted
          </span>
        );
      case 'has_penalty':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300">
            Foreclosure Fee Noted
          </span>
        );
      case 'not_assessed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">
            Compliance Not Assessed
          </span>
        );
    }
  };

  const isMismatch = comparison.status === 'mismatch';

  const renderSourceRef = (
    ref?: string,
    isVerifiedInSource?: boolean,
    verificationLevel?: string,
    details?: string
  ) => {
    if (!ref || ref === 'Not cited' || ref === 'Not specified' || ref.includes('not detected')) {
      return (
        <span className="text-slate-400 italic text-[11px]">
          Page reference not detected in document text
        </span>
      );
    }
    if (
      verificationLevel === 'unverified' ||
      isVerifiedInSource === false && (!verificationLevel || verificationLevel === 'unverified') ||
      ref.includes('not verified') ||
      ref.includes('Evidence not verified')
    ) {
      return (
        <span
          className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[11px] font-medium border border-amber-200"
          title={details || ref}
        >
          Evidence not verified: excerpt does not substantiate value
        </span>
      );
    }
    if (verificationLevel === 'source_verified' || isVerifiedInSource === true) {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 font-medium truncate" title={ref}>{ref}</span>
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0"
            title={details || 'Excerpt verified in actual document text'}
          >
            Source Verified
          </span>
        </span>
      );
    }
    if (verificationLevel === 'excerpt_corroborated') {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 font-medium truncate" title={ref}>{ref}</span>
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 shrink-0"
            title={details || 'Excerpt corroborated — source document text not independently verified'}
          >
            Excerpt Corroborated (Source Unverified)
          </span>
        </span>
      );
    }
    // ai_extracted
    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-700 font-medium truncate" title={ref}>{ref}</span>
        <span
          className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0"
          title={details || 'AI-extracted — source not independently verified'}
        >
          AI-Extracted (Source Not Verified)
        </span>
      </span>
    );
  };

  return (
    <div
      className={`rounded-xl border bg-white shadow-xs p-5 transition-all ${
        isMismatch
          ? 'border-rose-200/90 ring-1 ring-rose-100 hover:border-rose-300'
          : 'border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-base font-bold text-slate-900 tracking-tight">{comparison.label}</h4>
          {comparison.isSampleData && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100/80 border border-amber-300 px-1.5 py-0.2 rounded">
              <Sparkles className="w-2.5 h-2.5 text-amber-700" />
              <span>Synthetic Sample</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {regulatoryBadge()}
          {classificationBadge()}
          {statusBadge()}
          {onInspectEvidence && (
            <button
              type="button"
              onClick={() => onInspectEvidence(comparison)}
              className="text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/90 font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Inspect side-by-side contract excerpts and evidence citations"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              <span>Inspect Evidence</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600 mt-2 mb-3 leading-relaxed">{comparison.summary}</p>

      {/* 3-Column Comparative Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
        {/* Column 1: KFS */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/70">
          <div className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Key Facts Statement (KFS)</span>
            <span className="text-[10px] text-slate-400 font-normal">Pre-Contract</span>
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono flex items-center justify-between flex-wrap gap-1">
            <span>{comparison.values.kfs?.display || 'Not submitted'}</span>
            {comparison.isSampleData && comparison.values.kfs && (
              <span className="text-[10px] font-normal text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded font-sans">
                Sample
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.kfs?.pageClauseRef,
              comparison.values.kfs?.isVerifiedInSource,
              comparison.values.kfs?.verificationLevel,
              comparison.values.kfs?.verificationDetails
            )}
          </div>
        </div>

        {/* Column 2: Sanction Letter */}
        <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/70">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Sanction Letter</span>
            <span className="text-[10px] text-slate-400 font-normal">Offer</span>
          </div>
          <div className="text-sm font-bold text-slate-900 font-mono flex items-center justify-between flex-wrap gap-1">
            <span>{comparison.values.sanctionLetter?.display || 'Not submitted'}</span>
            {comparison.isSampleData && comparison.values.sanctionLetter && (
              <span className="text-[10px] font-normal text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded font-sans">
                Sample
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.sanctionLetter?.pageClauseRef,
              comparison.values.sanctionLetter?.isVerifiedInSource,
              comparison.values.sanctionLetter?.verificationLevel,
              comparison.values.sanctionLetter?.verificationDetails
            )}
          </div>
        </div>

        {/* Column 3: Loan Agreement */}
        <div
          className={`p-3 rounded-lg border ${
            isMismatch
              ? 'border-rose-200 bg-rose-50/30'
              : 'border-slate-100 bg-slate-50/70'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Loan Agreement</span>
            <span className="text-[10px] text-slate-400 font-normal">Execution Draft</span>
          </div>
          <div
            className={`text-sm font-bold font-mono flex items-center justify-between flex-wrap gap-1 ${
              isMismatch ? 'text-rose-950 font-extrabold' : 'text-slate-900'
            }`}
          >
            <span>{comparison.values.loanAgreement?.display || 'Not submitted'}</span>
            {comparison.isSampleData && comparison.values.loanAgreement && (
              <span className="text-[10px] font-normal text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded font-sans">
                Sample
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.loanAgreement?.pageClauseRef,
              comparison.values.loanAgreement?.isVerifiedInSource,
              comparison.values.loanAgreement?.verificationLevel,
              comparison.values.loanAgreement?.verificationDetails
            )}
          </div>
        </div>
      </div>

      {/* Financial Impact Banner with Deterministic Math Assumptions */}
      {comparison.financialImpact && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              Financial Variance:{' '}
              <span className="font-bold font-mono">{comparison.financialImpact}</span>
            </span>
            {comparison.calculationAssumptions && comparison.calculationAssumptions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAssumptions(!showAssumptions)}
                className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 underline transition-colors"
              >
                {showAssumptions ? 'Hide Assumptions' : 'View Assumptions'}
              </button>
            )}
          </div>

          {showAssumptions && comparison.calculationAssumptions && (
            <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-900 space-y-1 font-mono">
              <span className="font-bold block">Calculation Parameters & Assumptions:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {comparison.calculationAssumptions.map((asm, i) => (
                  <li key={i}>{asm}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Practical Question to Ask Lender (Discrepancy Action) */}
      {comparison.lenderQuestion && (
        <div className="mt-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5 flex-wrap">
              <span>Clarification Question for Loan Officer</span>
              {comparison.isSampleData && (
                <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded normal-case font-sans">
                  Sample Case Template
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleCopyQuestion}
              className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-200/70"
              title="Copy question text to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Question</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-800 font-medium leading-relaxed italic bg-white p-2.5 rounded border border-slate-200/60">
            "{comparison.lenderQuestion}"
          </p>

          {/* RBI Regulatory Grounding with Verified Circular and URL */}
          <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px] text-slate-600">
            <div className="flex items-start gap-1.5">
              <Scale className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-slate-800">Regulatory Framework: </span>
                <span>{comparison.rbiGuideline}</span>
              </div>
            </div>

            {comparison.circularReference && (
              <div className="flex items-center gap-2 pl-5 text-[10px] text-slate-500 flex-wrap">
                <span className="font-mono bg-slate-200/70 px-1.5 py-0.2 rounded">
                  Circular: {comparison.circularReference}
                </span>
                {comparison.sourceUrl && (
                  <a
                    href={comparison.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>View Official Notification</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}

            {comparison.verificationNotice && (
              <div className="flex items-start gap-1 pl-5 pt-1 text-[10px] text-amber-800">
                <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.2" />
                <span>{comparison.verificationNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verbatim Excerpts Accordion & Side-by-Side Inspect */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
        {onInspectEvidence ? (
          <button
            type="button"
            onClick={() => onInspectEvidence(comparison)}
            className="text-[11px] text-teal-800 hover:text-teal-950 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer group"
          >
            <FileText className="w-3.5 h-3.5 text-teal-700 group-hover:scale-110 transition-transform" />
            <span className="underline decoration-teal-400 underline-offset-2">Inspect Side-by-Side Contract Evidence</span>
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={() => setShowRawExcerpts(!showRawExcerpts)}
          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors"
        >
          <FileText className="w-3 h-3 text-slate-400" />
          <span>{showRawExcerpts ? 'Hide Quick Excerpts' : 'Quick Excerpts'}</span>
          {showRawExcerpts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showRawExcerpts && (
        <div className="mt-3 p-3 rounded-lg bg-slate-900 text-slate-100 text-[11px] font-mono space-y-2 border border-slate-800">
          <div>
            <span className="text-teal-400 font-semibold block">// Key Facts Statement Excerpt:</span>
            <p className="text-slate-300 whitespace-pre-wrap">{comparison.values.kfs?.rawText || 'Not specified in document'}</p>
          </div>
          <div>
            <span className="text-teal-400 font-semibold block">// Sanction Letter Excerpt:</span>
            <p className="text-slate-300 whitespace-pre-wrap">{comparison.values.sanctionLetter?.rawText || 'Not specified in document'}</p>
          </div>
          <div>
            <span className="text-teal-400 font-semibold block">// Loan Agreement Excerpt:</span>
            <p className="text-slate-300 whitespace-pre-wrap">{comparison.values.loanAgreement?.rawText || 'Not specified in document'}</p>
          </div>
        </div>
      )}

      {comparison.isSampleData && (
        <div className="mt-3 p-2 rounded bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            <strong>Synthetic Benchmark Note:</strong> Values shown are part of a pre-computed sample profile ({comparison.label}). Gemini has not analyzed private documents in this view.
          </span>
        </div>
      )}
    </div>
  );
};
