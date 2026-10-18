import React from 'react';
import { X, ShieldCheck, Scale, CheckCircle2, AlertOctagon, BookOpen, ExternalLink, Info } from 'lucide-react';
import { REGULATORY_RULES } from '../utils/regulatoryRules';

interface RbiRightsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RbiRightsModal: React.FC<RbiRightsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">RBI Borrower Safeguards & Regulatory Citations</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official notifications, circular references, and applicability conditions governing Indian retail loans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          {/* Directive 1: KFS */}
          <div className="p-4 rounded-xl border border-teal-100 dark:border-teal-900/40 bg-teal-50/30 dark:bg-teal-950/20 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-teal-800 dark:text-teal-400 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Standardized Key Facts Statement (KFS) Requirement
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.kfs_harmonization.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-800/80 p-1.5 rounded border border-teal-100/70 dark:border-teal-900/50">
              Ref: {REGULATORY_RULES.kfs_harmonization.circularId} · Issued: {REGULATORY_RULES.kfs_harmonization.issueDate} (Effective {REGULATORY_RULES.kfs_harmonization.effectiveDate})
            </p>
            <p>{REGULATORY_RULES.kfs_harmonization.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white block text-[11px]">Applicability & Scope:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                {REGULATORY_RULES.kfs_harmonization.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Directive 2: Penal Charges */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Penal Charges vs. Compounded Penal Interest
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.penal_charges.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-700">
              Ref: {REGULATORY_RULES.penal_charges.circularId} · Effective: {REGULATORY_RULES.penal_charges.effectiveDate}
            </p>
            <p>{REGULATORY_RULES.penal_charges.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white block text-[11px]">Applicability & Scope:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                {REGULATORY_RULES.penal_charges.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Directive 3: Foreclosure */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Prepayment & Foreclosure Charges on Floating-Rate Loans
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.foreclosure_floating.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {REGULATORY_RULES.foreclosure_floating.circularTitle}
            </div>
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-700">
              Ref: {REGULATORY_RULES.foreclosure_floating.circularId} · Effective: {REGULATORY_RULES.foreclosure_floating.effectiveDate}
            </p>
            <p>{REGULATORY_RULES.foreclosure_floating.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white block text-[11px]">Applicability & Scope:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                {REGULATORY_RULES.foreclosure_floating.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 text-[11px] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Notice:</strong> {REGULATORY_RULES.foreclosure_floating.verificationNotice}
              </span>
            </div>
          </div>

          {/* Directive 4: Insurance */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  4. Freedom of Choice in Loan-Linked Insurance
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.insurance_bundling.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-700 dark:text-teal-300 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>IRDAI Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded border border-slate-200 dark:border-slate-700">
              Ref: {REGULATORY_RULES.insurance_bundling.circularId}
            </p>
            <p>{REGULATORY_RULES.insurance_bundling.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 dark:text-white block text-[11px]">Key Safeguards:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 text-[11px]">
                {REGULATORY_RULES.insurance_bundling.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Official Source: Reserve Bank of India (rbi.org.in)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-md font-medium transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
