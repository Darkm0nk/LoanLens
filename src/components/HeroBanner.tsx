import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, ArrowDown, FileSearch, Sparkles, UploadCloud } from 'lucide-react';

interface HeroBannerProps {
  onLoadScenario: (scenarioId: string) => void;
  activeScenarioId: string | null;
  onScrollToUpload: () => void;
  onStartUpload?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  onLoadScenario,
  activeScenarioId,
  onScrollToUpload,
  onStartUpload,
}) => {
  return (
    <section className="relative pt-10 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-b border-slate-200/60">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Core Value Proposition */}
        <div className="lg:col-span-7 flex flex-col items-start space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-800 bg-teal-50/80 border border-teal-200/70 px-3 py-1 rounded-md">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>RBI Fair Lending Compliance & Contract Cross-Audit</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
            Know your loan <br />
            <span className="text-teal-800">before you commit.</span>
          </h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            In Indian retail lending, commercial terms frequently vary between initial pre-contract disclosures
            (KFS / Sanction Letter) and the final loan agreement draft—including benchmark spreads, upfront fee structures,
            bundled credit insurance, and penal clauses.
          </p>

          <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
            Zero Document Storage · Real Gemini Document AI · RBI Circular Grounding
          </p>

          {/* Primary Action Button */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onStartUpload || onScrollToUpload}
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Your Loan Documents</span>
            </button>
            <button
              type="button"
              onClick={onScrollToUpload}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
            >
              <span>View Intake Options</span>
            </button>
          </div>

          {/* Quick Demo Scenario Switcher Strip */}
          <div className="w-full pt-3">
            <div className="text-xs font-semibold text-slate-700 mb-2.5 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              <span>Explore Instant Demo Cases (Pre-Computed Synthetic Data):</span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onLoadScenario('home_loan_discrepancy')}
                className={`text-left px-3.5 py-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                  activeScenarioId === 'home_loan_discrepancy'
                    ? 'border-amber-400 bg-amber-50/80 text-amber-950 ring-1 ring-amber-400 shadow-xs'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">
                    Sample Case A: Variances Noted (Home Loan)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Synthetic profile: ₹78k principal variance + 0.50% rate difference + penal clause
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onLoadScenario('personal_loan_clean')}
                className={`text-left px-3.5 py-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                  activeScenarioId === 'personal_loan_clean'
                    ? 'border-emerald-400 bg-emerald-50/80 text-emerald-950 ring-1 ring-emerald-400 shadow-xs'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900">
                    Sample Case B: Consistent Alignment (Personal Loan)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Synthetic profile: Aligned terms across KFS, Sanction & Agreement with 100% match
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Key Metrics / Regulatory Proof Strip */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
              The Indian Borrower Audit Checklist
            </span>
            <span className="text-xs font-semibold text-teal-800">9 Core Terms</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                1
              </div>
              <div>
                <p className="font-semibold text-slate-900">Key Facts Statement (KFS) vs Agreement</p>
                <p className="text-slate-500">
                  RBI circular DOR.MCS.REC.17/01.01.001/2024-25 mandates KFS disclosure before contract signing.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                2
              </div>
              <div>
                <p className="font-semibold text-slate-900">Ancillary Insurance Disclosures</p>
                <p className="text-slate-500">
                  Detect whether insurance premiums are voluntary or presented as conditions precedent.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                3
              </div>
              <div>
                <p className="font-semibold text-slate-900">Penal Charges vs Compounded Penal Interest</p>
                <p className="text-slate-500">
                  Under RBI circular DoR.MCS.REC.28/01.01.001/2023-24, lenders must charge simple penal charges.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                4
              </div>
              <div>
                <p className="font-semibold text-slate-900">Prepayment & Foreclosure Terms</p>
                <p className="text-slate-500">
                  Circular DBOD.Dir.BC.115/13.03.00/2013-14 prohibits foreclosure penalties on floating-rate individual retail loans.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onScrollToUpload}
              className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <FileSearch className="w-4 h-4" />
              <span>Upload Your Loan Documents Below</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
