import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Mail,
  Printer,
  ShieldAlert,
  Sparkles,
  Info,
  Scale,
} from 'lucide-react';
import { LoanComparisonReport, DiscrepancyStatus, FieldComparison } from '../types/loan';
import { TermComparisonCard } from './TermComparisonCard';
import { SideBySideEvidenceModal } from './SideBySideEvidenceModal';

interface ComparisonDashboardProps {
  report: LoanComparisonReport | null;
  onOpenDisputeLetter: () => void;
  onScrollToUpload: () => void;
  isDemoMode: boolean;
  loadedDocCount?: number;
}

export const ComparisonDashboard: React.FC<ComparisonDashboardProps> = ({
                                                                          report,
                                                                          onOpenDisputeLetter,
                                                                          onScrollToUpload,
                                                                          isDemoMode,
                                                                          loadedDocCount = 0,
                                                                        }) => {
  const [filter, setFilter] = useState<'all' | DiscrepancyStatus>('all');
  const [selectedEvidenceComparison, setSelectedEvidenceComparison] = useState<FieldComparison | null>(null);

  if (!report) {
    const isSingleDoc = loadedDocCount === 1;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
            <FileText className="w-7 h-7" />
          </div>

          <div>
            {isSingleDoc ? (
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 rounded-full mb-2">
              1 of 3 Documents Loaded · Waiting for Second Document
            </span>
            ) : (
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full mb-2">
              Ready for Document Intake
            </span>
            )}

            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              {isSingleDoc
                  ? 'Waiting for at least 2 real documents to compare'
                  : 'No Active Comparison Report'}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
              {isSingleDoc
                  ? 'Upload at least two loan documents above (KFS, Sanction Letter, or Loan Agreement) to initiate the cross-contract discrepancy audit. Real user files are never compared against demo data.'
                  : 'Upload at least two loan documents above (KFS, Sanction Letter, or Loan Agreement) or load a sample benchmark case to inspect discrepancies.'}
            </p>
          </div>

          {isSingleDoc && (
              <div className="max-w-md mx-auto p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950 text-left">
                <span className="font-bold block mb-1">Combined Document Notice:</span>
                <span className="text-[11px] text-amber-900 leading-relaxed block">
                  If your file is an all-in-one loan package containing multiple schedules, upload the same file into the other document cards above to verify all sections.
                </span>
              </div>
          )}

          <div className="pt-2">
            <button
                type="button"
                onClick={onScrollToUpload}
                className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs rounded-lg transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <span>{isSingleDoc ? 'Upload Second Document Above' : 'Select Documents Above'}</span>
            </button>
          </div>
        </div>
    );
  }

  const filteredComparisons = report.comparisons.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const getVerdictStyle = () => {
    switch (report.recommendation) {
      case 'Review Variances with Lender':
        return {
          bg: 'bg-amber-50/90 border-amber-300 text-amber-950',
          badge: 'bg-amber-700 text-white',
          icon: <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0" />,
        };
      case 'Clarifications Recommended':
        return {
          bg: 'bg-blue-50/90 border-blue-200 text-blue-950',
          badge: 'bg-blue-700 text-white',
          icon: <HelpCircle className="w-6 h-6 text-blue-700 shrink-0" />,
        };
      case 'Terms Aligned Across Documents':
        return {
          bg: 'bg-emerald-50/90 border-emerald-200 text-emerald-950',
          badge: 'bg-emerald-700 text-white',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />,
        };
    }
  };

  const verdict = getVerdictStyle();

  return (
      <div className="space-y-6">
        {/* Explicit Demo Mode Banner */}
        {isDemoMode ? (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold uppercase tracking-wider text-[11px] text-amber-900">
                    Synthetic Demonstration Mode Active
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    Displaying pre-computed sample benchmark for <strong>{report.borrowerName}</strong> ({report.loanType}).
                    Gemini AI has not analyzed private documents in this view. Upload your documents above to start a real audit.
                  </p>
                </div>
              </div>
              <button
                  onClick={onScrollToUpload}
                  className="px-3.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white font-medium rounded-lg text-xs shrink-0 self-start sm:self-center transition-colors shadow-xs cursor-pointer"
              >
                Upload Real Documents
              </button>
            </div>
        ) : (
            <div className="p-3 bg-teal-50/90 border border-teal-200 rounded-lg flex items-center gap-2 text-xs text-teal-950">
              <Info className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
            <strong>User Documents Audit:</strong> Results extracted directly from your uploaded files via server-side
            Gemini AI integration. No documents are stored on server disks.
          </span>
            </div>
        )}

        {/* Combined Document Notice if extracted from single multi-section file */}
        {report.singleSourceNotice && (
            <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-xl flex items-start gap-2.5 text-xs text-indigo-950">
              <FileText className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
            <span className="font-bold block text-indigo-950 text-[11px] uppercase tracking-wider">
              Single-Source Multi-Section Verification
            </span>
                <span className="text-indigo-900 leading-relaxed block">
              {report.singleSourceNotice}
            </span>
              </div>
            </div>
        )}

        {/* Executive Review Recommendation Card */}
        <div className={`p-6 rounded-xl border ${verdict.bg} shadow-xs space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {verdict.icon}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${verdict.badge}`}>
                  Review Recommendation
                </span>
                  <span className="text-xs text-slate-700">
                  {report.lenderName} · {report.loanType}
                </span>
                  {isDemoMode && (
                      <span className="text-[10px] font-semibold text-amber-900 bg-amber-200/80 px-1.5 py-0.5 rounded">
                    Sample Data
                  </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{report.recommendation}</h3>
                <p className="text-xs text-slate-700 mt-1 max-w-2xl leading-relaxed">
                  {report.recommendationNote}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Evaluated profile: <span className="font-semibold">{report.borrowerName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                  onClick={onOpenDisputeLetter}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>Draft Clarification Notice</span>
              </button>
              <button
                  onClick={() => window.print()}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Audit</span>
              </button>
            </div>
          </div>

          {/* Warning Highlights List */}
          {report.keyWarnings.length > 0 && (
              <div className="pt-3 border-t border-slate-200/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-2">
              Specific Variances Identified:
            </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {report.keyWarnings.map((warning, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-white/90 border border-slate-200/80 flex items-start gap-2 shadow-2xs">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <span className="text-slate-800 leading-snug">{warning}</span>
                      </div>
                  ))}
                </div>
              </div>
          )}

          {/* Cautious Disclaimer Strip */}
          <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-200/50 flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
            <strong>Responsible Analysis Notice:</strong> A document discrepancy alone does not constitute proof of error or wrongdoing.
            Terms may adjust during underwriting due to benchmark reset schedules or administrative parameters. Clarify all points with your lender.
          </span>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">Terms Evaluated</span>
            <span className="text-2xl font-bold text-slate-900 font-mono block mt-1">
            {report.totalTermsEvaluated}
          </span>
            <span className="text-[11px] text-slate-400">Core Terms Checked</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs text-amber-700 font-semibold block">Variances Noted</span>
            <span className="text-2xl font-bold text-amber-700 font-mono block mt-1">
            {report.mismatchCount}
          </span>
            <span className="text-[11px] text-slate-400">Requires Confirmation</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs text-emerald-700 font-semibold block">Consistent Terms</span>
            <span className="text-2xl font-bold text-emerald-700 font-mono block mt-1">
            {report.matchCount}
          </span>
            <span className="text-[11px] text-slate-400">Aligned Across Documents</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-xs text-blue-700 font-semibold block">Missing Disclosures</span>
            <span className="text-2xl font-bold text-blue-700 font-mono block mt-1">
            {report.missingCount}
          </span>
            <span className="text-[11px] text-slate-400">Omitted in Documents</span>
          </div>
        </div>

        {/* Section Filter Controls & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Contract Term Comparison Matrix</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredComparisons.length} of {report.comparisons.length} terms · Click "Inspect Evidence" to view contract clauses
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {report.mismatchCount > 0 && (
                <button
                    type="button"
                    onClick={() => {
                      const firstMismatch = report.comparisons.find((c) => c.status === 'mismatch') || report.comparisons[0];
                      setSelectedEvidenceComparison(firstMismatch);
                    }}
                    className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    title="Open side-by-side contract comparison viewer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Side-by-Side Review ({report.mismatchCount} Variances)</span>
                </button>
            )}

            {/* Filter Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All ({report.comparisons.length})
              </button>
              <button
                  onClick={() => setFilter('mismatch')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex items-center gap-1 ${
                      filter === 'mismatch' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>Variances</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-mono font-bold">
                {report.mismatchCount}
              </span>
              </button>
              <button
                  onClick={() => setFilter('match')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      filter === 'match' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Matches ({report.matchCount})
              </button>
              <button
                  onClick={() => setFilter('missing')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      filter === 'missing' ? 'bg-white text-blue-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Missing ({report.missingCount})
              </button>
            </div>
          </div>
        </div>

        {/* Comparisons List */}
        <div className="space-y-3.5">
          {filteredComparisons.map((comp) => (
              <TermComparisonCard
                  key={comp.fieldKey}
                  comparison={comp}
                  onInspectEvidence={(item) => setSelectedEvidenceComparison(item)}
              />
          ))}
        </div>

        {/* Signature Interaction: Side-by-Side Contract Comparison Modal */}
        <SideBySideEvidenceModal
            isOpen={Boolean(selectedEvidenceComparison)}
            onClose={() => setSelectedEvidenceComparison(null)}
            comparison={selectedEvidenceComparison}
            allComparisons={report.comparisons}
            onSelectComparison={(comp) => setSelectedEvidenceComparison(comp)}
            onOpenDisputeLetter={onOpenDisputeLetter}
        />
      </div>
  );
};
