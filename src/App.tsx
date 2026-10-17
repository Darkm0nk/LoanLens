/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
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
import { ArrowRight, UploadCloud, Sparkles } from 'lucide-react';

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

  // Modals
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isRbiModalOpen, setIsRbiModalOpen] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<ExtractedLoanDocument | null>(null);

  // Section references for smooth scrolling
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const compareSectionRef = useRef<HTMLDivElement>(null);

  // Initialize with the realistic discrepancy scenario on mount
  useEffect(() => {
    loadScenario('home_loan_discrepancy');
  }, []);

  function loadScenario(scenarioId: string) {
    const scenario =
      scenarioId === 'personal_loan_clean' ? DEMO_SCENARIO_CLEAN : DEMO_SCENARIO_DISCREPANCY;

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

  // Handle file upload and call backend Gemini extraction with separate stages
  async function handleFileUpload(
    docType: LoanDocumentType,
    file: File,
    options?: { isCombined?: boolean; originSection?: string }
  ) {
    setLoadingMap((prev) => ({ ...prev, [docType]: true }));
    setStageMap((prev) => ({ ...prev, [docType]: 'validating' }));
    setErrorMap((prev) => ({ ...prev, [docType]: null }));
    setLastUploadedFile(file);

    // CRITICAL DATA ISOLATION GUARD:
    // If the app was in demo mode, purge all other slots so synthetic records
    // are never silently retained or mixed with real uploaded data!
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
    <div className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#0F172A]">
      {/* Top Bar Navigation */}
      <Navbar
        onReset={handleResetAll}
        onOpenRbiGuide={() => setIsRbiModalOpen(true)}
        onScrollToCompare={() => compareSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
        onScrollToUpload={() => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
        isDemoActive={isDemoActive}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section with Demo Switcher */}
        <HeroBanner
          onLoadScenario={loadScenario}
          activeScenarioId={activeScenarioId}
          onScrollToUpload={() => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          onStartUpload={() => {
            handleResetAll();
            setTimeout(() => {
              uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 60);
          }}
        />

        {/* Upload Areas Section */}
        <section
          ref={uploadSectionRef}
          className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
                  Document Intake Pipeline
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  {docCount} of 3 Documents Loaded
                </span>
                {isDemoActive ? (
                  <span className="text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                    Sample Data Active
                  </span>
                ) : docCount > 0 ? (
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                    Live Audit Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded border border-teal-300">
                    Ready for Files
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                Upload or Paste Your Loan Documents
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Processed via server-side Gemini 3.8 Flash. Terms and page citations are verified directly against source text.
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

              <button
                type="button"
                onClick={() => {
                  compareSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                disabled={docCount < 2}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Review Active Comparison</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Intake Banner */}
          {isDemoActive ? (
            <div className="p-4 bg-amber-50/80 border border-amber-300/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[11px] text-amber-900 block">
                    Demonstration Mode Active (Sample Benchmark Files)
                  </span>
                  <p className="text-amber-900/90 leading-relaxed mt-0.5">
                    Cards below currently display synthetic sample records for <strong>Vikramaditya Sharma</strong>.
                    To audit your own documents, click <strong>"Upload Real Document"</strong> on any card below or click
                    <strong>"Open Empty Dropzones"</strong> to start clean.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white font-medium text-xs rounded-lg transition-colors shrink-0 self-start sm:self-center cursor-pointer shadow-xs whitespace-nowrap"
              >
                Open Empty Dropzones
              </button>
            </div>
          ) : docCount === 0 ? (
            <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl flex items-center gap-3 text-xs text-teal-950">
              <UploadCloud className="w-5 h-5 text-teal-700 shrink-0" />
              <div>
                <span className="font-bold block text-teal-900">Upload Dropzones Ready</span>
                <span className="text-teal-800">
                  Select or drag your PDF/image/text file into at least two cards below (e.g. KFS and Sanction Letter, or KFS and Loan Agreement) to initiate the cross-contract audit.
                </span>
              </div>
            </div>
          ) : null}

          {/* Single Uploaded File Guidance for Combined Multi-Section Documents */}
          {!isDemoActive && realDocCount === 1 && lastUploadedFile && (
            <div className="p-4 bg-teal-50/90 border border-teal-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-teal-950">
              <div className="flex items-start gap-2.5">
                <UploadCloud className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-teal-900 block text-xs">
                    Single Document Uploaded: "{lastUploadedFile.name}" ({kfsDoc ? 'KFS' : sanctionDoc ? 'Sanction Letter' : 'Loan Agreement'} Slot)
                  </span>
                  <p className="text-teal-800 leading-relaxed text-[11px]">
                    To protect audit integrity, real documents are <strong>never</strong> compared against demo data. A cross-document audit requires at least 2 documents.
                    If your file is an <strong>All-in-One Combined PDF</strong> containing other sections (e.g. Sanction Letter or Agreement), you can extract them directly from this same file.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isProcessingCombined}
                  onClick={() => handleProcessAllSectionsFromFile(lastUploadedFile)}
                  className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {isProcessingCombined ? 'Extracting Sections...' : 'Extract Other Sections from this File'}
                </button>
              </div>
            </div>
          )}

          {/* 3 Separate Upload Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1. Key Facts Statement (KFS) */}
            <DocumentUploadCard
              docType="kfs"
              title="Key Facts Statement (KFS)"
              badge="RBI Mandated"
              description="Standardized one-page summary sheet containing all-inclusive APR, interest rate, and itemized fees."
              extractedDoc={kfsDoc}
              isLoading={loadingMap.kfs}
              stage={stageMap.kfs}
              error={errorMap.kfs}
              onFileUpload={(file) => handleFileUpload('kfs', file)}
              onTextSubmit={(text, name) => handleTextSubmit('kfs', text, name)}
              onClear={() => handleClearDoc('kfs')}
              onInspect={() => setInspectDoc(kfsDoc)}
              onLoadSampleDoc={() => handleLoadSingleSample('kfs')}
              sampleButtonLabel="Load Sample KFS"
            />

            {/* 2. Sanction Letter */}
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
              onLoadSampleDoc={() => handleLoadSingleSample('sanction_letter')}
              sampleButtonLabel="Load Sample Sanction"
            />

            {/* 3. Loan Agreement */}
            <DocumentUploadCard
              docType="loan_agreement"
              title="Loan Agreement"
              badge="Execution Draft"
              description="The detailed contract document containing full legal schedules, covenants, and default clauses."
              extractedDoc={agreementDoc}
              isLoading={loadingMap.loan_agreement}
              stage={stageMap.loan_agreement}
              error={errorMap.loan_agreement}
              onFileUpload={(file) => handleFileUpload('loan_agreement', file)}
              onTextSubmit={(text, name) => handleTextSubmit('loan_agreement', text, name)}
              onClear={() => handleClearDoc('loan_agreement')}
              onInspect={() => setInspectDoc(agreementDoc)}
              onLoadSampleDoc={() => handleLoadSingleSample('loan_agreement')}
              sampleButtonLabel="Load Sample Agreement"
            />
          </div>
        </section>

        {/* Comparison Dashboard Section */}
        <section
          ref={compareSectionRef}
          className="py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200/80"
        >
          <ComparisonDashboard
            report={report}
            onOpenDisputeLetter={() => setIsDisputeModalOpen(true)}
            onScrollToUpload={() => uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            isDemoMode={isDemoActive}
            loadedDocCount={realDocCount}
          />
        </section>
      </main>

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

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">LoanLens</span>
            <span>·</span>
            <span>Check Before You Sign</span>
            <span>·</span>
            <span>Indian Retail Lending Contract Cross-Examination</span>
          </div>
          <div className="flex items-center gap-4 text-slate-600">
            <button
              onClick={() => setIsRbiModalOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              Verified RBI Regulatory Citations
            </button>
            <span className="text-slate-300">|</span>
            <span>Ephemeral In-Memory Processing (No Documents Stored)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
