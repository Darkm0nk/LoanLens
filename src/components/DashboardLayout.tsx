import React, { useState } from 'react';
import {
    Sun, Moon, LayoutGrid, FileSearch, Mail, ShieldCheck,
    RefreshCw, Sparkles
} from 'lucide-react';
import { LoanComparisonReport, ExtractedLoanDocument } from '../types/loan';

interface DashboardLayoutProps {
    report: LoanComparisonReport | null;
    kfsDoc: ExtractedLoanDocument | null;
    sanctionDoc: ExtractedLoanDocument | null;
    agreementDoc: ExtractedLoanDocument | null;
    isDemoActive: boolean;
    currentSection: 'dashboard' | 'audit' | 'compare' | 'rbi';
    onNavigate: (section: 'dashboard' | 'audit' | 'compare' | 'rbi') => void;
    onReset: () => void;
    onOpenDisputeLetter: () => void;
    onOpenRbiGuide: () => void;
    children: React.ReactNode;
}

export default function DashboardLayout({
                                            report,
                                            kfsDoc,
                                            sanctionDoc,
                                            agreementDoc,
                                            isDemoActive,
                                            currentSection,
                                            onNavigate,
                                            onReset,
                                            onOpenDisputeLetter,
                                            onOpenRbiGuide,
                                            children,
                                        }: DashboardLayoutProps) {
    const [darkMode, setDarkMode] = useState(false);

    const loadedCount = [kfsDoc, sanctionDoc, agreementDoc].filter(Boolean).length;
    const realDocCount = [kfsDoc, sanctionDoc, agreementDoc].filter((d) => Boolean(d && !d.isDemo)).length;
    const safeSection = currentSection || 'dashboard';

    const borrowerName =
        report?.borrowerName ||
        kfsDoc?.borrowerName ||
        sanctionDoc?.borrowerName ||
        agreementDoc?.borrowerName ||
        'Borrower';
    const borrowerInitials =
        borrowerName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join('') || 'BR';

    return (
        <div className={`min-h-screen w-full ${darkMode ? 'bg-[#050811] text-slate-100' : 'bg-[#f8fafc] text-slate-800'} flex overflow-hidden relative transition-colors duration-300`}>

            {/* ================= LEFT SIDEBAR (Full Height) ================= */}
            <aside className="w-20 bg-[#1e293b] flex flex-col items-center py-6 justify-between shrink-0 select-none h-screen sticky top-0 border-r border-slate-800">
                <div className="flex flex-col items-center gap-8">
                    {/* Logo Mark */}
                    <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/30 font-bold text-xl">
                        LL
                    </div>

                    {/* Theme Toggle Pill */}
                    <div className="bg-slate-800/90 p-1 rounded-full flex flex-col gap-1 border border-slate-700/50">
                        <button
                            onClick={() => setDarkMode(false)}
                            className={`p-2 rounded-full transition-all cursor-pointer ${!darkMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            title="Light Mode"
                        >
                            <Sun className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setDarkMode(true)}
                            className={`p-2 rounded-full transition-all cursor-pointer ${darkMode ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            title="Dark Mode"
                        >
                            <Moon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Sidebar Navigation */}
                    <nav className="flex flex-col gap-3">
                        {[
                            { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard Overview' },
                            { id: 'audit', icon: FileSearch, label: 'Document Intake & Comparison' },
                            { id: 'rbi', icon: ShieldCheck, label: 'RBI Rights & Guide' },
                        ].map((item) => {
                            const Icon = item.icon;
                            const isActive = safeSection === item.id || (item.id === 'audit' && safeSection === 'compare');
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onNavigate(item.id as any)}
                                    className={`p-3 rounded-2xl transition-all relative group cursor-pointer ${
                                        isActive
                                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                    title={item.label}
                                >
                                    <Icon className="w-5 h-5" />
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={onReset}
                        className="p-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl transition-colors cursor-pointer"
                        title="Reset All Data"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </aside>

            {/* ================= MAIN CONTENT AREA (Full Width & Height) ================= */}
            <div className={`flex-1 flex flex-col h-screen overflow-y-auto ${darkMode ? 'bg-[#0f172a]' : 'bg-[#f8fafc]'}`}>

                {/* Top Header */}
                <header className={`px-8 py-5 border-b ${darkMode ? 'border-slate-800 bg-[#0f172a]/80' : 'border-slate-200/80 bg-white/80'} backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shrink-0 shadow-xs`}>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-teal-800 flex items-center justify-center text-white font-bold text-sm">LL</div>
                            <div className="flex flex-col leading-none">
                                <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>LoanLens</span>
                                <span className="text-[10px] text-slate-400 font-medium">Check Before You Sign</span>
                            </div>
                        </div>
                        {isDemoActive ? (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-md">
                                <Sparkles className="w-3 h-3 text-amber-700" />
                                <span>Sample Data Mode</span>
                            </span>
                        ) : realDocCount >= 2 ? (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>Live Audit Active · Gemini 3.8 Flash</span>
                            </span>
                        ) : realDocCount === 1 ? (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded-md">
                                <span>Intake in Progress (1 of 2 Needed)</span>
                            </span>
                        ) : (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-md">
                                <span>Ready for Documents</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onOpenDisputeLetter}
                            className="flex items-center gap-2 bg-linear-to-r from-teal-700 to-emerald-700 text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-md shadow-teal-700/20 hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            <Mail className="w-3.5 h-3.5 text-amber-300" />
                            <span>Draft Clarification Notice</span>
                        </button>

                        <div className={`flex items-center gap-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100/80 border-slate-200/60'} p-1.5 pr-4 rounded-2xl border`}>
                            <div className="w-8 h-8 rounded-xl bg-teal-800 flex items-center justify-center text-white font-semibold text-xs tracking-wider">
                                {borrowerInitials}
                            </div>
                            <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'} leading-tight max-w-[120px] truncate`} title={borrowerName}>{borrowerName}</span>
                        </div>
                    </div>
                </header>

                {/* Dynamic Section Container */}
                <div className="p-8 md:p-10 space-y-8 flex-1 max-w-[1600px] w-full mx-auto">
                    {/* Breadcrumb Section Indicator */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
                        <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg">
                Current Section: {safeSection.toUpperCase()}
              </span>
                            <span className="text-xs text-slate-500">
                {loadedCount} of 3 documents active
              </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                onClick={() => onNavigate('dashboard')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'dashboard' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-200/60'}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => onNavigate('audit')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'audit' || safeSection === 'compare' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-200/60'}`}
                            >
                                Intake & Comparison
                            </button>
                            <button
                                onClick={() => {
                                    onNavigate('rbi');
                                    onOpenRbiGuide();
                                }}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'rbi' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-200/60'}`}
                            >
                                RBI Guide
                            </button>
                        </div>
                    </div>

                    {children}
                </div>

            </div>

        </div>
    );
}