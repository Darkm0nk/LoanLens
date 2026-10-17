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
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">RBI Borrower Safeguards & Regulatory Citations</h3>
              <p className="text-xs text-slate-500">
                Official notifications, circular references, and applicability conditions governing Indian retail loans
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
          {/* Directive 1: KFS */}
          <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-teal-800 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900">
                  1. Standardized Key Facts Statement (KFS) Requirement
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.kfs_harmonization.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-800 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-500 bg-white/80 p-1.5 rounded border border-teal-100/70">
              Ref: {REGULATORY_RULES.kfs_harmonization.circularId} · Issued: {REGULATORY_RULES.kfs_harmonization.issueDate} (Effective {REGULATORY_RULES.kfs_harmonization.effectiveDate})
            </p>
            <p>{REGULATORY_RULES.kfs_harmonization.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 block text-[11px]">Applicability & Scope:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                {REGULATORY_RULES.kfs_harmonization.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Directive 2: Penal Charges */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-700 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900">
                  2. Penal Charges vs. Compounded Penal Interest
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.penal_charges.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-800 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200">
              Ref: {REGULATORY_RULES.penal_charges.circularId} · Effective: {REGULATORY_RULES.penal_charges.effectiveDate}
            </p>
            <p>{REGULATORY_RULES.penal_charges.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 block text-[11px]">Applicability & Scope:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                {REGULATORY_RULES.penal_charges.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Directive 3: Foreclosure */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900">
                  3. Prepayment & Foreclosure Charges on Floating-Rate Loans
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.foreclosure_floating.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-800 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>View Circular</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200">
              Ref: {REGULATORY_RULES.foreclosure_floating.circularId} · Issued: {REGULATORY_RULES.foreclosure_floating.issueDate}
            </p>
            <p>{REGULATORY_RULES.foreclosure_floating.summary}</p>
            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Verification Notice:</strong> This exemption applies specifically to individual retail borrowers under floating rate schemes. Prepayment fees may legally apply to fixed-rate facilities or non-individual co-borrowers (companies/firms).
              </span>
            </div>
          </div>

          {/* Directive 4: Insurance */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700 shrink-0" />
                <h4 className="font-bold text-sm text-slate-900">
                  4. Freedom of Choice in Loan-Linked Insurance
                </h4>
              </div>
              <a
                href={REGULATORY_RULES.insurance_bundling.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-800 font-semibold hover:underline flex items-center gap-0.5"
              >
                <span>IRDAI Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="font-mono text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200">
              Ref: {REGULATORY_RULES.insurance_bundling.circularId}
            </p>
            <p>{REGULATORY_RULES.insurance_bundling.summary}</p>
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 block text-[11px]">Key Safeguards:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600 text-[11px]">
                {REGULATORY_RULES.insurance_bundling.applicabilityConditions.map((cond, i) => (
                  <li key={i}>{cond}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Official Source: Reserve Bank of India (rbi.org.in)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
