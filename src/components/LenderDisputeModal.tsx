import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Download, Mail, Sparkles, Loader2, Printer } from 'lucide-react';
import { LoanComparisonReport } from '../types/loan';
import { printAuditLetter } from '../utils/auditLetterGenerator';

interface LenderDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: LoanComparisonReport | null;
}

export const LenderDisputeModal: React.FC<LenderDisputeModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (report && isOpen) {
      generateDefaultLetter(report);
    }
  }, [report, isOpen]);

  if (!isOpen || !report) return null;

  function generateDefaultLetter(rep: LoanComparisonReport) {
    const discrepancies = rep.comparisons.filter(
      (c) => c.status === 'mismatch' || (c.status === 'missing' && c.severity === 'critical')
    );

    const questionsList = discrepancies
      .map(
        (c, idx) =>
          `${idx + 1}. Item: ${c.label}\n` +
          `   - Observed Variance: ${c.summary}\n` +
          `   - Agreement Reference: ${c.values.loanAgreement?.pageClauseRef || 'Agreement Draft'}\n` +
          `   - Pre-Contract Reference: ${c.values.kfs?.pageClauseRef || c.values.sanctionLetter?.pageClauseRef || 'KFS / Sanction Letter'}\n` +
          `   - Clarification Requested: ${c.lenderQuestion}\n` +
          (c.circularReference ? `   - Applicable Directive: ${c.circularReference}\n` : '') +
          (c.rbiGuideline ? `   - Regulatory Context: ${c.rbiGuideline}` : '')
      )
      .join('\n\n');

    const defaultSubject = rep.isDemo
      ? `[Sample Demonstration Notice] Request for Clarification on Draft Loan Agreement - ${rep.borrowerName}`
      : `Clarification Request: Review of Draft Loan Agreement vs Key Facts Statement - ${rep.borrowerName}`;

    const defaultBody = `${rep.isDemo ? '*** NOTE: SYNTHETIC SAMPLE LETTER GENERATED IN DEMO MODE ***\n\n' : ''}Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

To,
The Credit Operations / Branch Manager,
${rep.lenderName}

Subject: ${defaultSubject}
Facility: ${rep.loanType}
Borrower Name: ${rep.borrowerName}

Dear Sir / Madam,

I have received the draft Loan Agreement prepared for execution regarding the aforementioned credit facility. Upon conducting a clause-by-clause cross-examination against the Key Facts Statement (KFS) and Sanction Letter previously issued by your institution, I noted specific variances between the pre-contract disclosures and the proposed agreement schedule.

Before executing the binding agreement, I request your written clarification on the following items:

${questionsList || 'All primary terms appear aligned. Please confirm the final disbursement and EMI schedule.'}

Under relevant Reserve Bank of India (RBI) notifications—including Circular DOR.MCS.REC.17/01.01.001/2024-25 on Key Facts Statements and Circular DoR.MCS.REC.28/01.01.001/2023-24 on Fair Lending Practices—pre-contract disclosures must accurately represent the contracted terms.

Kindly review these points and provide updated execution schedules reflecting the agreed terms so that we may proceed to signing.

Thank you for your assistance.

Yours sincerely,

${rep.borrowerName}
Contact: [Insert Phone / Email]`;

    setSubject(defaultSubject);
    setBody(defaultBody);
  }

  const handleAiRefine = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-lender-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.subject) setSubject(data.subject);
        if (data.letterBody) setBody(data.letterBody);
      }
    } catch (err) {
      console.error('Failed to generate AI letter:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    const element = document.createElement('a');
    const file = new Blob([fullText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Loan_Clarification_Letter_${report.borrowerName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Lender Clarification & Rectification Request</h3>
                {report.isDemo && (
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded uppercase">
                    Sample Letter
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Formal clarification letter grounded in RBI circulars and contract clauses
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

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiRefine}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin" />
                  <span>Refining with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                  <span>Refine Letter with Gemini AI</span>
                </>
              )}
            </button>
            <button
              onClick={() => generateDefaultLetter(report)}
              className="text-slate-600 hover:text-slate-900 text-xs px-2 py-1 transition-colors"
            >
              Reset to Standard Template
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Letter</span>
                </>
              )}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .txt</span>
            </button>
            <button
              onClick={() => printAuditLetter(subject, body)}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-md flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Print clarification letter"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Letter</span>
            </button>
          </div>
        </div>

        {/* Body Editor */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Formal Letter Content</label>
            <textarea
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-300 bg-white font-mono text-[11px] leading-relaxed text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-700"
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
          <span>Submit via official lender correspondence and retain a copy for your records.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-700 hover:text-slate-900 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
