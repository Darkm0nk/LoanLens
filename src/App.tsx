/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from './components/DashboardLayout';
import { HeroBanner } from './components/HeroBanner';
import { DocumentUploadCard } from './components/DocumentUploadCard';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { LenderDisputeModal } from './components/LenderDisputeModal';
import { RbiRightsModal } from './components/RbiRightsModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import {
  ExtractedLoanDocument,
  LoanComparisonReport,
  LoanDocumentType,
  UploadProcessingStage,
} from './types/loan';
import { compareLoanDocuments } from './utils/comparator';
import { DEMO_SCENARIO_DISCREPANCY, DEMO_SCENARIO_CLEAN } from './data/demoData';
import { ArrowRight, UploadCloud, Sparkles, FileText, Scale, ShieldCheck, Mail } from 'lucide-react';

export default function App() {
  // Document states
  const [kfsDoc, setKfsDoc] = useState<ExtractedLoanDocument | null>(null);
  const [sanctionDoc, setSanctionDoc] = useState<ExtractedLoanDocument | null>(null);
  const [agreementDoc, setAgreementDoc] = useState<ExtractedLoanDocument | null>(null);

  // Loading, stage, and error states per card
  const [loadingMap, setLoadingMap] = useState<Record<LoanDocumentType, boolean>>({
    kfs: false,
    sanction_letter: false,
    loan_agreement: false,
  });
  const [stageMap, setStageMap] = useState<Record<LoanDocumentType, UploadProcessingStage>>({
    kfs: 'idle',
    sanction_letter: 'idle',
    loan_agreement: 'idle',
  });
  const [errorMap, setErrorMap] = useState<Record<LoanDocumentType, string | null>>({
    kfs: null,
    sanction_letter: null,
    loan_agreement: null,
  });

  // Active Demo Scenario
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>('home_loan_discrepancy');
  const [currentSection, setCurrentSection] = useState<'dashboard' | 'audit' | 'compare' | 'rbi'>('audit');

  // Modals
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isRbiModalOpen, setIsRbiModalOpen] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<ExtractedLoanDocument | null>(null);

  useEffect(() => {
    loadScenario('home_loan_discrepancy');
  }, []);

  function loadScenario(scenarioId: string) {
    const scenario = scenarioId === 'personal_loan_clean' ? DEMO_SCENARIO_CLEAN : DEMO_SCENARIO_DISCREPANCY;
    setActiveScenarioId(scenarioId);
    setKfsDoc(scenario.kfsDoc);
    setSanctionDoc(scenario.sanctionDoc);
    setAgreementDoc(scenario.agreementDoc);
    setErrorMap({ kfs: null, sanction_letter: null, loan_agreement: null });
    setStageMap({ kfs: 'completed', sanction_letter: 'completed', loan_agreement: 'completed' });
  }

  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [isProcessingCombined, setIsProcessingCombined] = useState(false);

  function handleResetAll() {
    setKfsDoc(null);
    setSanctionDoc(null);
    setAgreementDoc(null);
    setActiveScenarioId(null);
    setLastUploadedFile(null);
    setIsProcessingCombined(false);
    setErrorMap({ kfs: null, sanction_letter: null, loan_agreement: null });
    setStageMap({ kfs: 'idle', sanction_letter: 'idle', loan_agreement: 'idle' });
  }

  async function handleFileUpload(
      docType: LoanDocumentType,
      file: File,
      options?: { isCombined?: boolean; originSection?: string }
  ) {
    setLoadingMap((prev) => ({ ...prev, [docType]: true }));
    setStageMap((prev) => ({ ...prev, [docType]: 'validating' }));
    setErrorMap((prev) => ({ ...prev, [docType]: null }));
    setLastUploadedFile(file);

    if (activeScenarioId !== null || kfsDoc?.isDemo || sanctionDoc?.isDemo || agreementDoc?.isDemo) {
      setActiveScenarioId(null);
      if (docType === 'kfs') {
        setSanctionDoc(null);
        setAgreementDoc(null);
      } else if (docType === 'sanction_letter') {
        setKfsDoc(null);
        setAgreementDoc(null);
      } else if (docType === 'loan_agreement') {
        setKfsDoc(null);
        setSanctionDoc(null);
      }
    }

    try {
      // 1. Validation Stage
      const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.txt'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(fileExt)) {
        throw new Error(`Unsupported file type (${fileExt}). Please upload a PDF, image (PNG/JPG), or TXT file.`);
      }

      if (file.size < 50) {
        throw new Error('The selected file is empty (0 bytes). Please select a valid document.');
      }

      // 2. Uploading Stage
      setStageMap((prev) => ({ ...prev, [docType]: 'uploading' }));

      let resolvedMime = file.type;
      if (!resolvedMime || resolvedMime === 'application/octet-stream') {
        if (fileExt === '.pdf') resolvedMime = 'application/pdf';
        else if (fileExt === '.png') resolvedMime = 'image/png';
        else if (fileExt === '.jpg' || fileExt === '.jpeg') resolvedMime = 'image/jpeg';
        else if (fileExt === '.txt') resolvedMime = 'text/plain';
        else resolvedMime = 'application/pdf';
      }

      let payload: any;
      if (fileExt === '.txt' || resolvedMime === 'text/plain') {
        const textData = await file.text();
        payload = {
          documentType: docType,
          documentName: file.name,
          textContent: textData,
          isCombinedPackage: options?.isCombined,
          originFileName: file.name,
          originSection: options?.originSection,
        };
      } else {
        const base64Data = await readFileAsBase64(file);
        payload = {
          documentType: docType,
          documentName: file.name,
          fileBase64: base64Data,
          mimeType: resolvedMime,
          isCombinedPackage: options?.isCombined,
          originFileName: file.name,
          originSection: options?.originSection,
        };
      }

      // 3. Extracting Stage (Gemini Model API)
      setStageMap((prev) => ({ ...prev, [docType]: 'extracting' }));
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const extracted: ExtractedLoanDocument = await res.json();
      // Ensure real uploads are never marked as demo
      extracted.isDemo = false;
      if (options?.isCombined) {
        extracted.isCombinedPackage = true;
        extracted.originFileName = file.name;
        extracted.originSection = options.originSection;
      }
      setDocumentByType(docType, extracted);
      setStageMap((prev) => ({ ...prev, [docType]: 'completed' }));
    } catch (err: any) {
      console.error('Document extraction error:', err);
      setStageMap((prev) => ({ ...prev, [docType]: 'failed' }));
      setErrorMap((prev) => ({
        ...prev,
        [docType]: err.message || 'Failed to extract loan terms. Please check your file or try pasting text.',
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [docType]: false }));
    }
  }

  // Handle all-in-one multi-section extraction from a single combined PDF
  async function handleProcessAllSectionsFromFile(file: File) {
    setIsProcessingCombined(true);
    try {
      await Promise.all([
        handleFileUpload('sanction_letter', file, {
          isCombined: true,
          originSection: 'Section 2: Sanction Letter',
        }),
        handleFileUpload('loan_agreement', file, {
          isCombined: true,
          originSection: 'Section 3: Loan Agreement',
        }),
      ]);
      setKfsDoc((prev) =>
        prev
          ? {
              ...prev,
              isCombinedPackage: true,
              originFileName: file.name,
              originSection: prev.originSection || 'Section 1: Key Facts Statement',
            }
          : null
      );
    } finally {
      setIsProcessingCombined(false);
    }
  }

  // Handle text input and call backend Gemini extraction
  async function handleTextSubmit(docType: LoanDocumentType, text: string, docName: string) {
    setLoadingMap((prev) => ({ ...prev, [docType]: true }));
    setStageMap((prev) => ({ ...prev, [docType]: 'extracting' }));
    setErrorMap((prev) => ({ ...prev, [docType]: null }));

    // CRITICAL DATA ISOLATION GUARD:
    if (activeScenarioId !== null || kfsDoc?.isDemo || sanctionDoc?.isDemo || agreementDoc?.isDemo) {
      setActiveScenarioId(null);
      if (docType === 'kfs') {
        setSanctionDoc(null);
        setAgreementDoc(null);
      } else if (docType === 'sanction_letter') {
        setKfsDoc(null);
        setAgreementDoc(null);
      } else if (docType === 'loan_agreement') {
        setKfsDoc(null);
        setSanctionDoc(null);
      }
    }

    try {
      if (text.trim().length < 30) {
        throw new Error('Pasted text is too brief to contain standard loan terms. Please paste complete loan clauses or schedules.');
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: docType,
          documentName: docName,
          textContent: text,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const extracted: ExtractedLoanDocument = await res.json();
      extracted.isDemo = false;
      setDocumentByType(docType, extracted);
      setStageMap((prev) => ({ ...prev, [docType]: 'completed' }));
    } catch (err: any) {
      console.error('Text extraction error:', err);
      setStageMap((prev) => ({ ...prev, [docType]: 'failed' }));
      setErrorMap((prev) => ({
        ...prev,
        [docType]: err.message || 'Failed to extract loan terms from text.',
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [docType]: false }));
    }
  }

  function setDocumentByType(docType: LoanDocumentType, doc: ExtractedLoanDocument | null) {
    if (docType === 'kfs') setKfsDoc(doc);
    else if (docType === 'sanction_letter') setSanctionDoc(doc);
    else if (docType === 'loan_agreement') setAgreementDoc(doc);
  }

  function handleClearDoc(docType: LoanDocumentType) {
    setDocumentByType(docType, null);
    setErrorMap((prev) => ({ ...prev, [docType]: null }));
    setStageMap((prev) => ({ ...prev, [docType]: 'idle' }));
    if (activeScenarioId !== null) {
      setActiveScenarioId(null);
    }
  }

  function handleLoadSingleSample(docType: LoanDocumentType) {
    const scenario = DEMO_SCENARIO_DISCREPANCY;
    if (docType === 'kfs') setKfsDoc(scenario.kfsDoc);
    else if (docType === 'sanction_letter') setSanctionDoc(scenario.sanctionDoc);
    else if (docType === 'loan_agreement') setAgreementDoc(scenario.agreementDoc);
    setErrorMap((prev) => ({ ...prev, [docType]: null }));
    setStageMap((prev) => ({ ...prev, [docType]: 'completed' }));
  }

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Real vs Demo document separation
  const realDocs = [kfsDoc, sanctionDoc, agreementDoc].filter(
    (d): d is ExtractedLoanDocument => Boolean(d && !d.isDemo)
  );
  const demoDocs = [kfsDoc, sanctionDoc, agreementDoc].filter(
    (d): d is ExtractedLoanDocument => Boolean(d && d.isDemo)
  );

  const isDemoActive = Boolean(activeScenarioId || (demoDocs.length > 0 && realDocs.length === 0));
  const realDocCount = realDocs.length;
  const docCount = isDemoActive ? demoDocs.length : realDocCount;

  // Run deterministic comparison with strict data-isolation enforcement
  const report: LoanComparisonReport | null = useMemo(() => {
    try {
      // Demo mode: evaluate demo records only when no real docs exist
      if (isDemoActive && demoDocs.length >= 2 && realDocs.length === 0) {
        return compareLoanDocuments(kfsDoc, sanctionDoc, agreementDoc);
      }

      // Real mode: require AT LEAST TWO real documents to generate an authentic audit
      if (!isDemoActive && realDocCount >= 2) {
        return compareLoanDocuments(
          kfsDoc && !kfsDoc.isDemo ? kfsDoc : null,
          sanctionDoc && !sanctionDoc.isDemo ? sanctionDoc : null,
          agreementDoc && !agreementDoc.isDemo ? agreementDoc : null
        );
      }

      // Fewer than 2 real documents: do NOT generate audit! Waiting for documents.
      return null;
    } catch (err) {
      console.error('Audit comparison evaluation guard:', err);
      return null;
    }
  }, [kfsDoc, sanctionDoc, agreementDoc, isDemoActive, realDocCount, demoDocs.length]);

  return (
      <DashboardLayout
          report={report}
          kfsDoc={kfsDoc}
          sanctionDoc={sanctionDoc}
          agreementDoc={agreementDoc}
          isDemoActive={isDemoActive}
          currentSection={currentSection}
          onNavigate={(sec) => setCurrentSection(sec)}
          onReset={handleResetAll}
          onOpenDisputeLetter={() => setIsDisputeModalOpen(true)}
          onOpenRbiGuide={() => setIsRbiModalOpen(true)}
      >
        {/* ================= SECTION 1: DASHBOARD OVERVIEW ================= */}
        {currentSection === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <HeroBanner
                  onLoadScenario={loadScenario}
                  activeScenarioId={activeScenarioId}
                  onScrollToUpload={() => setCurrentSection('audit')}
                  onStartUpload={() => {
                    handleResetAll();
                    setCurrentSection('audit');
                  }}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                    onClick={() => setCurrentSection('audit')}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-500 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {docCount} / 3 Loaded
                </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    Combined Intake & Audit Workspace
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Upload your Key Facts Statement, Sanction Letter, or Loan Agreement and instantly view side-by-side comparison matrices.
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-800">
                    <span>Open Combined Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                    onClick={() => setCurrentSection('compare')}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-500 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
                      <Scale className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                  {report ? `${report.mismatchCount} Variances` : 'Pending'}
                </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    Comparison Matrix Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Inspect 9 core loan terms, deterministic financial impact calculations, and clause evidence.
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-800">
                    <span>View Comparison Report</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div
                    onClick={() => {
                      setCurrentSection('rbi');
                      setIsRbiModalOpen(true);
                    }}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-500 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      RBI Grounded
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    Regulatory Safeguards
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Review official RBI circulars on KFS disclosures, simple penal charges, and foreclosure rules.
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-800">
                    <span>Explore RBI Rights</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* ================= SECTIONS 2 & 3 COMBINED: INTAKE & COMPARISON WORKSPACE ================= */}
        {(currentSection === 'audit' || currentSection === 'compare') && (
            <div className="space-y-10 animate-in fade-in duration-200">

              {/* Header & Sample Loaders */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                      Combined Intake & Comparison Workspace
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500">
                      {docCount} of 3 Documents Loaded
                    </span>
                    {isDemoActive ? (
                      <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                        Sample Data Active
                      </span>
                    ) : realDocCount >= 2 ? (
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                        Live Audit Active
                      </span>
                    ) : realDocCount === 1 ? (
                      <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                        Intake in Progress (1 of 2 Needed)
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded border border-teal-300">
                        Ready for Files
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                    Upload Documents & Review Comparison Matrix
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload your files below. The side-by-side contract discrepancy report and financial calculations update automatically in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {isDemoActive ? (
                      <button
                          type="button"
                          onClick={handleResetAll}
                          className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Upload Real Documents</span>
                      </button>
                  ) : (
                      <button
                          type="button"
                          onClick={() => loadScenario('home_loan_discrepancy')}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Load Sample Case</span>
                      </button>
                  )}
                </div>
              </div>

              {/* Single Uploaded File Guidance */}
              {!isDemoActive && realDocCount === 1 && lastUploadedFile && (
                  <div className="p-4 bg-teal-50/90 border border-teal-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-teal-950">
                    <div className="flex items-start gap-2.5">
                      <UploadCloud className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                  <span className="font-bold text-teal-900 block text-xs">
                    Single Document Uploaded: "{lastUploadedFile.name}"
                  </span>
                        <p className="text-teal-800 leading-relaxed text-[11px]">
                          To protect audit integrity, real documents are never compared against demo data. If your file is an <strong>All-in-One Combined PDF</strong>, extract other sections here:
                        </p>
                      </div>
                    </div>
                    <button
                        type="button"
                        disabled={isProcessingCombined}
                        onClick={() => handleProcessAllSectionsFromFile(lastUploadedFile)}
                        className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      {isProcessingCombined ? 'Extracting Sections...' : 'Extract Other Sections from this File'}
                    </button>
                  </div>
              )}

              {/* 3 Upload Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <DocumentUploadCard
                    docType="kfs"
                    title="Key Facts Statement (KFS)"
                    badge="RBI Mandated"
                    description="Standardized summary sheet containing all-inclusive APR, interest rate, and itemized fees."
                    extractedDoc={kfsDoc}
                    isLoading={loadingMap.kfs}
                    stage={stageMap.kfs}
                    error={errorMap.kfs}
                    onFileUpload={(file) => handleFileUpload('kfs', file)}
                    onTextSubmit={(text, name) => handleTextSubmit('kfs', text, name)}
                    onClear={() => handleClearDoc('kfs')}
                    onInspect={() => setInspectDoc(kfsDoc)}
                    onDismissError={() => setErrorMap((prev) => ({ ...prev, kfs: null }))}
                    onLoadSampleDoc={() => handleLoadSingleSample('kfs')}
                    sampleButtonLabel="Load Sample KFS"
                />
                <DocumentUploadCard
                    docType="sanction_letter"
                    title="Sanction Letter"
                    badge="Lender Offer"
                    description="Formal approval letter communicating approved loan limit, applicable interest rate, and special conditions."
                    extractedDoc={sanctionDoc}
                    isLoading={loadingMap.sanction_letter}
                    stage={stageMap.sanction_letter}
                    error={errorMap.sanction_letter}
                    onFileUpload={(file) => handleFileUpload('sanction_letter', file)}
                    onTextSubmit={(text, name) => handleTextSubmit('sanction_letter', text, name)}
                    onClear={() => handleClearDoc('sanction_letter')}
                    onInspect={() => setInspectDoc(sanctionDoc)}
                    onDismissError={() => setErrorMap((prev) => ({ ...prev, sanction_letter: null }))}
                    onLoadSampleDoc={() => handleLoadSingleSample('sanction_letter')}
                    sampleButtonLabel="Load Sample Sanction"
                />
                <DocumentUploadCard
                    docType="loan_agreement"
                    title="Loan Agreement"
                    badge="Execution Draft"
                    description="Detailed contract document containing full legal schedules, covenants, and default clauses."
                    extractedDoc={agreementDoc}
                    isLoading={loadingMap.loan_agreement}
                    stage={stageMap.loan_agreement}
                    error={errorMap.loan_agreement}
                    onFileUpload={(file) => handleFileUpload('loan_agreement', file)}
                    onTextSubmit={(text, name) => handleTextSubmit('loan_agreement', text, name)}
                    onClear={() => handleClearDoc('loan_agreement')}
                    onInspect={() => setInspectDoc(agreementDoc)}
                    onDismissError={() => setErrorMap((prev) => ({ ...prev, loan_agreement: null }))}
                    onLoadSampleDoc={() => handleLoadSingleSample('loan_agreement')}
                    sampleButtonLabel="Load Sample Agreement"
                />
              </div>

              {/* Divider between upload cards and comparison report */}
              <div className="border-t border-slate-200/80 pt-6">
                <div className="mb-4">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    Live Comparison Matrix & Financial Impact
                  </h3>
                  <p className="text-xs text-slate-500">
                    Displays side-by-side term variances and potential financial discrepancies between your uploaded documents.
                  </p>
                </div>
                <ComparisonDashboard
                    report={report}
                    onOpenDisputeLetter={() => setIsDisputeModalOpen(true)}
                    onScrollToUpload={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    isDemoMode={isDemoActive}
                    loadedDocCount={realDocCount}
                />
              </div>

            </div>
        )}

        {/* ================= SECTION 4: RBI RIGHTS & GUIDE ================= */}
        {currentSection === 'rbi' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                Section 4: Borrower Protection Framework
              </span>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                    RBI Regulatory Circulars & Rights
                  </h2>
                </div>
                <button
                    type="button"
                    onClick={() => setIsRbiModalOpen(true)}
                    className="px-4 py-2 bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs hover:bg-teal-900 transition-colors cursor-pointer"
                >
                  Open Full Regulatory Modal
                </button>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Summary of Key Borrower Protections</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Under Reserve Bank of India guidelines, retail borrowers are entitled to full pre-contract disclosure through standardized Key Facts Statements (KFS), freedom of choice in credit insurance providers, simple penal charges without interest compounding, and zero prepayment penalties on individual floating-rate loans.
                </p>
                <div className="pt-2">
                  <button
                      type="button"
                      onClick={() => setIsDisputeModalOpen(true)}
                      className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-amber-300" />
                    <span>Draft Lender Clarification Notice</span>
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* Modals */}
        <LenderDisputeModal
            isOpen={isDisputeModalOpen}
            onClose={() => setIsDisputeModalOpen(false)}
            report={report}
        />
        <RbiRightsModal
            isOpen={isRbiModalOpen}
            onClose={() => setIsRbiModalOpen(false)}
        />
        <DocumentViewerModal
            isOpen={Boolean(inspectDoc)}
            onClose={() => setInspectDoc(null)}
            document={inspectDoc}
        />
      </DashboardLayout>
  );
}