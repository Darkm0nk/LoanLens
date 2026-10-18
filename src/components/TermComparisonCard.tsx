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
    details?: string,
    isLocationVerified?: boolean,
    locationStatus?: string,
    locationDetails?: string
  ) => {
    if (!ref || ref === 'Not cited' || ref === 'Not specified' || ref.includes('not detected')) {
      return (
        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
          Page reference not detected in document text
        </span>
      );
    }
    if (comparison.isSampleData) {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={`${ref} (Sample Benchmark Citation)`}>
            {ref}
          </span>
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0"
            title="Sample Benchmark Citation: synthetic evaluation scenario (not verified against an uploaded document)"
          >
            Sample Benchmark Citation
          </span>
        </span>
      );
    }
    if (
      verificationLevel === 'unverified' ||
      (isVerifiedInSource === false && (!verificationLevel || verificationLevel === 'unverified')) ||
      ref.includes('not verified') ||
      ref.includes('Evidence not verified')
    ) {
      return (
        <span
          className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded text-[11px] font-medium border border-amber-200 dark:border-amber-800"
          title={details || ref}
        >
          Evidence not verified: excerpt does not substantiate value
        </span>
      );
    }
    if (verificationLevel === 'source_verified' && isVerifiedInSource !== false) {
      const locationTooltip = locationDetails || (isLocationVerified ? 'Location verified' : 'Location AI-reported');
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={`${ref} (${locationTooltip})`}>{ref}</span>
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0"
            title={details || `Excerpt verified in document text. ${locationTooltip}`}
          >
            Source Verified
          </span>
        </span>
      );
    }
    if (verificationLevel === 'excerpt_corroborated') {
      return (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={`${ref} (Source unverified)`}>{ref}</span>
          <span
            className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0"
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
        <span className="text-slate-700 dark:text-slate-300 font-medium truncate" title={`${ref} (Uncorroborated)`}>{ref}</span>
        <span
          className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shrink-0"
          title={details || 'AI-extracted — source not independently verified'}
        >
          AI-Extracted (Source Not Verified)
        </span>
      </span>
    );
  };

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-900 shadow-xs p-5 transition-all ${
        isMismatch
          ? 'border-rose-200/90 dark:border-rose-900/60 ring-1 ring-rose-100 dark:ring-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800'
          : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{comparison.label}</h4>
          {comparison.isSampleData && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-1.5 py-0.2 rounded">
              <Sparkles className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
              <span>Synthetic Sample</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {regulatoryBadge()}
          {comparison.status === 'match' ? statusBadge() : (classificationBadge() || statusBadge())}
          {onInspectEvidence && (
            <button
              type="button"
              onClick={() => onInspectEvidence(comparison)}
              className="text-xs bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200/90 dark:border-teal-800 font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              title="Inspect side-by-side contract excerpts and evidence citations"
            >
              <FileText className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>Inspect Evidence</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 mb-3 leading-relaxed">{comparison.summary}</p>

      {/* 3-Column Comparative Data Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-3">
        {/* Column 1: KFS */}
        <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="text-[11px] font-semibold text-teal-800 dark:text-teal-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Key Facts Statement (KFS)</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Pre-Contract</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
            {comparison.values.kfs?.display || 'Not submitted'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.kfs?.pageClauseRef,
              comparison.values.kfs?.isVerifiedInSource,
              comparison.values.kfs?.verificationLevel,
              comparison.values.kfs?.verificationDetails,
              comparison.values.kfs?.isLocationVerified,
              comparison.values.kfs?.locationStatus,
              comparison.values.kfs?.locationDetails
            )}
          </div>
        </div>

        {/* Column 2: Sanction Letter */}
        <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Sanction Letter</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Offer</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
            {comparison.values.sanctionLetter?.display || 'Not submitted'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.sanctionLetter?.pageClauseRef,
              comparison.values.sanctionLetter?.isVerifiedInSource,
              comparison.values.sanctionLetter?.verificationLevel,
              comparison.values.sanctionLetter?.verificationDetails,
              comparison.values.sanctionLetter?.isLocationVerified,
              comparison.values.sanctionLetter?.locationStatus,
              comparison.values.sanctionLetter?.locationDetails
            )}
          </div>
        </div>

        {/* Column 3: Loan Agreement */}
        <div
          className={`p-3 rounded-lg border ${
            isMismatch
              ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/30'
              : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Loan Agreement</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Execution Draft</span>
          </div>
          <div
            className={`text-sm font-bold font-mono ${
              isMismatch ? 'text-rose-950 dark:text-rose-200 font-extrabold' : 'text-slate-900 dark:text-white'
            }`}
          >
            {comparison.values.loanAgreement?.display || 'Not submitted'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-start gap-1">
            <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">Source:</span>
            {renderSourceRef(
              comparison.values.loanAgreement?.pageClauseRef,
              comparison.values.loanAgreement?.isVerifiedInSource,
              comparison.values.loanAgreement?.verificationLevel,
              comparison.values.loanAgreement?.verificationDetails,
              comparison.values.loanAgreement?.isLocationVerified,
              comparison.values.loanAgreement?.locationStatus,
              comparison.values.loanAgreement?.locationDetails
            )}
          </div>
        </div>
      </div>

      {/* Financial Impact Banner with Deterministic Math Assumptions */}
      {comparison.financialImpact && (
        <div className="mb-3 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              Financial Variance:{' '}
              <span className="font-bold font-mono">{comparison.financialImpact}</span>
            </span>
            {comparison.calculationAssumptions && comparison.calculationAssumptions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAssumptions(!showAssumptions)}
                className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 underline transition-colors"
              >
                {showAssumptions ? 'Hide Assumptions' : 'View Assumptions'}
              </button>
            )}
          </div>

          {showAssumptions && comparison.calculationAssumptions && (
            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 space-y-1 font-mono">
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
        <div className="mt-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-400">
              Clarification Question for Loan Officer
            </span>
            <button
              type="button"
              onClick={handleCopyQuestion}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
              title="Copy question text to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Copy Question</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed italic bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200/60 dark:border-slate-700/60">
            "{comparison.lenderQuestion}"
          </p>

          {/* RBI Regulatory Grounding with Verified Circular and URL */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-1.5">
              <Scale className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Regulatory Framework: </span>
                <span>{comparison.rbiGuideline}</span>
              </div>
            </div>

            {comparison.circularReference && (
              <div className="flex items-center gap-2 pl-5 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-mono bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 px-1.5 py-0.2 rounded">
                  Circular: {comparison.circularReference}
                </span>
                {comparison.sourceUrl && (
                  <a
                    href={comparison.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-800 dark:text-teal-400 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <span>View Official Notification</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}

            {comparison.verificationNotice && (
              <div className="flex items-start gap-1 pl-5 pt-1 text-[10px] text-amber-800 dark:text-amber-300">
                <Info className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.2" />
                <span>{comparison.verificationNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verbatim Excerpts Accordion */}
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowRawExcerpts(!showRawExcerpts)}
          className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors cursor-pointer"
        >
          <span>{showRawExcerpts ? 'Hide Quick Excerpts' : 'Quick Excerpts'}</span>
          {showRawExcerpts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showRawExcerpts && (
        <div className="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-[11px] font-mono space-y-2 border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-teal-700 dark:text-teal-400 font-semibold block">Key Facts Statement:</span>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comparison.values.kfs?.rawText || 'Not specified in document'}</p>
          </div>
          <div>
            <span className="text-teal-700 dark:text-teal-400 font-semibold block">Sanction Letter:</span>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comparison.values.sanctionLetter?.rawText || 'Not specified in document'}</p>
          </div>
          <div>
            <span className="text-teal-700 dark:text-teal-400 font-semibold block">Loan Agreement:</span>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{comparison.values.loanAgreement?.rawText || 'Not specified in document'}</p>
          </div>
        </div>
      )}
    </div>
  );
};
