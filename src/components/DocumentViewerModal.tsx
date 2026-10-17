import React from 'react';
import { X, FileText, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { ExtractedLoanDocument } from '../types/loan';
import { formatINR, formatPercent } from '../utils/comparator';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ExtractedLoanDocument | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document,
}) => {
  if (!isOpen || !document) return null;

  const docTypeLabel =
    document.documentType === 'kfs'
      ? 'Key Facts Statement (KFS)'
      : document.documentType === 'sanction_letter'
      ? 'Sanction Letter'
      : 'Loan Agreement';

  const rows = [
    {
      label: 'Loan Principal Amount',
      val: formatINR(document.fields.loanAmount.value),
      raw: document.fields.loanAmount.rawText,
      ref: document.fields.loanAmount.pageClauseRef,
      isVerified: document.fields.loanAmount.isVerifiedInSource,
      notes: document.fields.loanAmount.notes,
    },
    {
      label: 'Annual Interest Rate (% p.a.)',
      val: `${formatPercent(document.fields.interestRate.value)} (${document.fields.interestRate.rateType})`,
      raw: document.fields.interestRate.rawText,
      ref: document.fields.interestRate.pageClauseRef,
      isVerified: document.fields.interestRate.isVerifiedInSource,
      notes: document.fields.interestRate.benchmark || document.fields.interestRate.notes,
    },
    {
      label: 'Annual Percentage Rate (APR)',
      val: document.fields.apr.value ? `${document.fields.apr.value.toFixed(2)}% APR` : 'Not specified',
      raw: document.fields.apr.rawText,
      ref: document.fields.apr.pageClauseRef,
      isVerified: document.fields.apr.isVerifiedInSource,
      notes: document.fields.apr.notes,
    },
    {
      label: 'Repayment Tenure',
      val: document.fields.tenureMonths.value ? `${document.fields.tenureMonths.value} Months (${(document.fields.tenureMonths.value / 12).toFixed(1)} Yrs)` : 'Not specified',
      raw: document.fields.tenureMonths.rawText,
      ref: document.fields.tenureMonths.pageClauseRef,
      isVerified: document.fields.tenureMonths.isVerifiedInSource,
      notes: document.fields.tenureMonths.notes,
    },
    {
      label: 'Monthly EMI',
      val: formatINR(document.fields.emi.value),
      raw: document.fields.emi.rawText,
      ref: document.fields.emi.pageClauseRef,
      isVerified: document.fields.emi.isVerifiedInSource,
      notes: document.fields.emi.notes,
    },
    {
      label: 'Processing Fees & Taxes',
      val: formatINR(document.fields.processingFees.value),
      raw: document.fields.processingFees.rawText,
      ref: document.fields.processingFees.pageClauseRef,
      isVerified: document.fields.processingFees.isVerifiedInSource,
      notes: document.fields.processingFees.gstDetails,
    },
    {
      label: 'Insurance & Protection Cover',
      val: document.fields.insurance.value === 0 ? '₹0 / Optional' : `${formatINR(document.fields.insurance.value)} (${document.fields.insurance.isMandatory ? 'Mandatory' : 'Optional'})`,
      raw: document.fields.insurance.rawText,
      ref: document.fields.insurance.pageClauseRef,
      isVerified: document.fields.insurance.isVerifiedInSource,
      notes: document.fields.insurance.policyName,
    },
    {
      label: 'Penal Charges / Default Terms',
      val: document.fields.penalCharges.value,
      raw: document.fields.penalCharges.rawText,
      ref: document.fields.penalCharges.pageClauseRef,
      isVerified: document.fields.penalCharges.isVerifiedInSource,
      notes: document.fields.penalCharges.isCompoundedInterest ? 'Clause specifies compounded penal interest' : 'Flat penal charge structure',
    },
    {
      label: 'Prepayment & Foreclosure Charges',
      val: document.fields.prepaymentCharges.value,
      raw: document.fields.prepaymentCharges.rawText,
      ref: document.fields.prepaymentCharges.pageClauseRef,
      isVerified: document.fields.prepaymentCharges.isVerifiedInSource,
      notes: document.fields.prepaymentCharges.hasPenalty ? 'Foreclosure fee referenced in schedule' : 'Zero foreclosure fee',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">
                  {docTypeLabel}
                </span>
                {document.isDemo && (
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded uppercase">
                    Synthetic Sample
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 truncate max-w-md">{document.documentName}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Notice Banner */}
        {document.isDemo ? (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Sample Record Note:</strong> This document displays synthetic sample values for testing. No personal files were uploaded or analyzed for this entry.
            </span>
          </div>
        ) : (
          <div className="px-6 py-2.5 bg-teal-50 border-b border-teal-200 text-teal-950 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              <strong>Live Extraction:</strong> Extracted directly from uploaded document using Gemini 3.8 Flash structured output.
            </span>
          </div>
        )}

        {/* Document Metadata Bar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <span className="text-slate-500 block text-[11px]">Lender</span>
            <span className="font-semibold text-slate-900">{document.lenderName}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Borrower Profile</span>
            <span className="font-semibold text-slate-900">{document.borrowerName}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Loan Type</span>
            <span className="font-semibold text-slate-900">{document.loanType}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Record Date</span>
            <span className="font-semibold text-slate-900">{document.uploadDate}</span>
          </div>
        </div>

        {/* Terms Breakdown Table */}
        <div className="p-6 overflow-y-auto space-y-4">
          {document.rawSummary && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800">
              <span className="font-semibold block mb-0.5 text-slate-900">Document Summary:</span>
              <span className="leading-relaxed">{document.rawSummary}</span>
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Loan Term</th>
                  <th className="py-2.5 px-3">Extracted Value</th>
                  <th className="py-2.5 px-3">Source Citation Status</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{row.label}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-900">{row.val}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                      {row.ref && !row.ref.includes('not detected') ? (
                        <span className="font-mono">{row.ref}</span>
                      ) : (
                        <span className="text-slate-400 italic">Page reference not detected in document text</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] hidden sm:table-cell">
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>{document.isDemo ? 'Synthetic Demo Record' : 'Processed via Gemini 3.8 Flash'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
