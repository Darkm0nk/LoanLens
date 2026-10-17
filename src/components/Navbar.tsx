import React from 'react';
import { ShieldCheck, FileText, HelpCircle, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onReset: () => void;
  onOpenRbiGuide: () => void;
  onScrollToCompare: () => void;
  onScrollToUpload: () => void;
  isDemoActive: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onReset,
  onOpenRbiGuide,
  onScrollToCompare,
  onScrollToUpload,
  isDemoActive,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FBFBFA]/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single element, clean display face) */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/"
            className="flex items-center gap-2.5 text-slate-900 font-bold text-lg tracking-tight hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-800 text-amber-200 flex items-center justify-center font-bold text-sm shadow-xs">
              <span>LL</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold text-slate-900">LoanLens</span>
              <span className="text-[10px] text-slate-500 font-normal">Check Before You Sign</span>
            </div>
          </a>
          {isDemoActive ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950 bg-amber-100 border border-amber-300 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
              <span>Sample Data (Demo Mode)</span>
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              <span>Document Audit · AI availability depends on quota</span>
            </span>
          )}
        </div>

        {/* Zone 2: Navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            onClick={onScrollToUpload}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Upload Documents
          </button>
          <button
            onClick={onScrollToCompare}
            className="hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            Comparison Matrix
          </button>
          <button
            onClick={onOpenRbiGuide}
            className="hover:text-slate-900 transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>RBI Borrower Rights</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onReset}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Reset and clear all document state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset All</span>
          </button>
          <button
            onClick={onScrollToUpload}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            Audit My Loan
          </button>
        </div>
      </div>
    </header>
  );
};
