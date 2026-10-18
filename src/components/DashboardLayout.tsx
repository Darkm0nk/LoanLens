import React, { useState } from 'react';
import { Sun, Moon, RefreshCw, Sparkles } from 'lucide-react';
import { LoanComparisonReport, ExtractedLoanDocument } from '../types/loan';
import '../styles/darkmode.css';

interface DashboardLayoutProps {
    report: LoanComparisonReport | null;
    kfsDoc: ExtractedLoanDocument | null;
    sanctionDoc: ExtractedLoanDocument | null;
    agreementDoc: ExtractedLoanDocument | null;
    isDemoActive: boolean;
    currentSection: 'dashboard' | 'audit' | 'compare' | 'rbi';
    onNavigate: (section: 'dashboard' | 'audit' | 'compare' | 'rbi') => void;
    onReset: () => void;
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
                                            children,
                                        }: DashboardLayoutProps) {
    const [darkMode, setDarkMode] = useState(false);

    // Apply dark mode class to body
    React.useEffect(() => {

        if (darkMode) {
            document.documentElement.classList.add('dark');
            document.body.style.backgroundColor = '#050811';
            document.body.style.color = '#f1f5f9';
        } else {
            document.documentElement.classList.remove('dark');
            document.body.style.backgroundColor = '#f8fafc';
            document.body.style.color = '#1e293b';
        }
    }, [darkMode]);

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
        <div className={`min-h-screen w-full ${darkMode ? 'dark bg-[#050811] text-white' : 'bg-[#f8fafc] text-slate-800'} flex flex-col overflow-hidden relative transition-colors duration-300`}>

            {/* ================= TOP HEADER ================= */}
            <header className={`px-8 py-5 border-b ${darkMode ? 'border-slate-800 bg-[#0f172a]/80' : 'border-slate-200/80 bg-white/80'} backdrop-blur-md sticky top-0 z-20 flex items-center justify-between shrink-0 shadow-xs`}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-teal-800 flex items-center justify-center text-white font-bold text-sm">LL</div>
                        <div className="flex flex-col leading-none">
                            <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-900'} tracking-tight`}>LoanLens</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Check Before You Sign</span>
                        </div>
                    </div>
                    {isDemoActive ? (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-md">
                            <Sparkles className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                            <span>Sample Data Mode</span>
                        </span>
                    ) : realDocCount >= 2 ? (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700 rounded-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                            <span>Live Audit Active</span>
                        </span>
                    ) : realDocCount === 1 ? (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-md">
                            <span>Waiting for 2nd Document</span>
                        </span>
                    ) : (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold text-teal-900 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-700 rounded-md">
                            <span>Ready for Documents</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    {/* Theme Toggle */}
                    <div className="bg-slate-200 dark:bg-slate-800/90 p-1 rounded-full flex gap-1 border border-slate-300 dark:border-slate-700/50">
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

                    {/* Reset Button */}
                    <button
                        onClick={onReset}
                        className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Reset All Data"
                        aria-label="Reset All Data"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    {/* User Profile */}
                    <div className={`flex items-center gap-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100/80 border-slate-200/60'} p-1.5 pr-4 rounded-2xl border`}>
                        <div className="w-8 h-8 rounded-xl bg-teal-800 flex items-center justify-center text-white font-semibold text-xs tracking-wider">
                            {borrowerInitials}
                        </div>
                        <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-800'} leading-tight max-w-[120px] truncate`} title={borrowerName}>{borrowerName}</span>
                    </div>
                </div>
            </header>

            {/* ================= MAIN CONTENT AREA ================= */}
            <div className={`flex-1 flex flex-col overflow-y-auto ${darkMode ? 'bg-[#0f172a]' : 'bg-[#f8fafc]'}`}
                 style={darkMode ? { color: '#f1f5f9' } : {}}>

                {/* Dynamic Section Container */}
                <div className={`p-8 md:p-10 space-y-8 flex-1 max-w-[1600px] w-full mx-auto ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {/* Breadcrumb Section Indicator */}
                    <div className={`flex items-center justify-between pb-4 border-b ${darkMode ? 'border-slate-700 text-slate-400' : 'border-slate-200/80 text-slate-500'}`}>
                        <div className="flex items-center gap-2 text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                            <span>{loadedCount} of 3 documents active</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <button
                                onClick={() => onNavigate('dashboard')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'dashboard' ? darkMode ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-900 text-white font-semibold' : darkMode ? 'text-slate-400 hover:bg-slate-700/60' : 'text-slate-600 hover:bg-slate-200/60'}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => onNavigate('audit')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'audit' || safeSection === 'compare' ? darkMode ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-900 text-white font-semibold' : darkMode ? 'text-slate-400 hover:bg-slate-700/60' : 'text-slate-600 hover:bg-slate-200/60'}`}
                            >
                                Intake & Comparison
                            </button>
                            <button
                                onClick={() => onNavigate('rbi')}
                                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${safeSection === 'rbi' ? darkMode ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-900 text-white font-semibold' : darkMode ? 'text-slate-400 hover:bg-slate-700/60' : 'text-slate-600 hover:bg-slate-200/60'}`}
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