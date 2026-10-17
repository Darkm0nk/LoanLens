import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  FileCheck,
  Sparkles,
  ArrowUpCircle,
} from 'lucide-react';
import { LoanDocumentType, ExtractedLoanDocument, UploadProcessingStage } from '../types/loan';
import { formatINR, formatPercent } from '../utils/comparator';

interface DocumentUploadCardProps {
  docType: LoanDocumentType;
  title: string;
  badge: string;
  description: string;
  extractedDoc: ExtractedLoanDocument | null;
  isLoading: boolean;
  stage?: UploadProcessingStage;
  error: string | null;
  onFileUpload: (file: File) => void;
  onTextSubmit: (text: string, docName: string) => void;
  onClear: () => void;
  onInspect: () => void;
  onLoadSampleDoc: () => void;
  sampleButtonLabel: string;
}

export const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  docType,
  title,
  badge,
  description,
  extractedDoc,
  isLoading,
  stage = 'idle',
  error,
  onFileUpload,
  onTextSubmit,
  onClear,
  onInspect,
  onLoadSampleDoc,
  sampleButtonLabel,
}) => {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [docName, setDocName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setLocalError('File size exceeds 25MB limit. Please upload a smaller file.');
        return;
      }
      setLocalError(null);
      onFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setLocalError('File size exceeds 25MB limit. Please upload a smaller file.');
        return;
      }
      setLocalError(null);
      onFileUpload(file);
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pastedText.trim()) {
      setLocalError(null);
      onTextSubmit(pastedText.trim(), docName.trim() || `${title}.txt`);
    }
  };

  const isDemo = Boolean(extractedDoc?.isDemo);
  const activeError = error || localError;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`rounded-xl border shadow-xs p-5 flex flex-col justify-between transition-all relative ${
        isDragOver
          ? 'ring-2 ring-teal-500 border-teal-500 bg-teal-50/50'
          : isDemo
          ? 'bg-[#FCFCFA] border-amber-200/90'
          : 'bg-white border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Hidden file input always mounted and ready */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        onClick={(e) => {
          // Clear target value so selecting the same file triggers change
          (e.target as HTMLInputElement).value = '';
        }}
        accept=".pdf,.png,.jpg,.jpeg,.txt"
        className="hidden"
      />

      {/* Header Info */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
            {badge}
          </span>
          {extractedDoc && (
            isDemo ? (
              <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-700" />
                <span>Synthetic Sample</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Live Upload Extracted</span>
              </span>
            )
          )}
        </div>

        <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{description}</p>
      </div>

      {/* Main Body State: Loading, Extracted, or Input Form */}
      <div className="my-4 flex-1 flex flex-col justify-center">
        {/* Error notification if any */}
        {activeError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 shadow-2xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Extraction / Upload Issue</span>
              <span className="text-[11px] leading-relaxed block">{activeError}</span>
            </div>
            <button
              type="button"
              onClick={() => setLocalError(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="py-8 px-4 rounded-lg border border-dashed border-teal-300 bg-teal-50/40 flex flex-col items-center justify-center text-center space-y-2">
            <Loader2 className="w-7 h-7 text-teal-700 animate-spin" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                {stage === 'validating'
                  ? 'Validating File Format...'
                  : stage === 'uploading'
                  ? 'Uploading Document to Server...'
                  : 'Analyzing Document with Gemini 3.8 Flash...'}
              </p>
              <p className="text-[11px] text-slate-500">
                Extracting loan amount, interest rate spread, APR, EMI, insurance & penal clauses with citations
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-teal-800 font-mono bg-teal-100/60 px-2 py-0.5 rounded">
              <span>Integration: Server-Side @google/genai</span>
            </div>
          </div>
        ) : extractedDoc ? (
          /* Extracted Summary Card with direct upload / replace action */
          <div
            className={`p-3.5 rounded-lg border space-y-2.5 transition-all ${
              isDemo ? 'bg-amber-50/40 border-amber-200/80' : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileCheck className={`w-4 h-4 shrink-0 ${isDemo ? 'text-amber-700' : 'text-teal-700'}`} />
                <span className="text-xs font-semibold text-slate-900 truncate" title={extractedDoc.documentName}>
                  {extractedDoc.documentName}
                </span>
              </div>
              {isDemo ? (
                <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Sample Data
                </span>
              ) : (
                <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                  Live Upload
                </span>
              )}
            </div>

            {isDemo && (
              <div className="text-[10px] text-amber-800 bg-amber-100/60 border border-amber-200/70 p-2 rounded leading-tight">
                <strong>Sample Document Note:</strong> This card currently displays synthetic data for demonstration. Click the button below to upload your real file.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/70">
              <div>
                <span className="text-[11px] text-slate-500 block">Lender</span>
                <span className="font-semibold text-slate-800 truncate block">
                  {extractedDoc.lenderName || 'Not identified'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Principal</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {extractedDoc.fields.loanAmount?.value && extractedDoc.fields.loanAmount.value > 0
                    ? formatINR(extractedDoc.fields.loanAmount.value, false)
                    : 'Not extracted'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Interest Rate</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {extractedDoc.fields.interestRate?.value && extractedDoc.fields.interestRate.value > 0
                    ? formatPercent(extractedDoc.fields.interestRate.value)
                    : 'Not extracted'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Monthly EMI</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {extractedDoc.fields.emi?.value && extractedDoc.fields.emi.value > 0
                    ? formatINR(extractedDoc.fields.emi.value, false)
                    : 'Not extracted'}
                </span>
              </div>
            </div>
            {extractedDoc.originSection && (
              <div className="text-[10px] text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-1 rounded">
                <strong>Source Section:</strong> {extractedDoc.originSection}
              </div>
            )}

            {/* Direct Upload / Replace Action */}
            <div className="pt-2 border-t border-slate-200/70 space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Select a real PDF, image, or TXT file to analyze"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isDemo ? `Upload Real ${title}` : `Upload / Replace Document`}</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={onInspect}
                  className="text-xs text-teal-800 hover:text-teal-950 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Extracted Terms</span>
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Input Form with prominent dropzone */
          <div className="space-y-3">
            {/* Mode Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  mode === 'upload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload File (PDF/Scan)
              </button>
              <button
                type="button"
                onClick={() => setMode('paste')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  mode === 'paste' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paste Text / Clauses
              </button>
            </div>

            {mode === 'upload' ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-teal-500 bg-teal-50/70'
                    : 'border-slate-300 hover:border-teal-600 bg-slate-50/50 hover:bg-teal-50/20'
                }`}
              >
                <UploadCloud className="w-10 h-10 text-teal-700 mx-auto mb-2.5" />
                <p className="text-xs font-bold text-slate-900">
                  Click to browse or drop your {title}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports PDF, scanned images (PNG/JPG), or TXT (Max 25MB)
                </p>
                <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-semibold text-teal-800 shadow-2xs">
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>Select File from Computer</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasteSubmit} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Document label (e.g. Sanction Letter v1)"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700"
                />
                <textarea
                  rows={4}
                  placeholder={`Paste ${title} text, rate schedules, or clause excerpts here...`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-teal-700 font-mono text-[11px]"
                  required
                />
                <button
                  type="submit"
                  disabled={!pastedText.trim()}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Analyze Pasted Text with Gemini
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer helper action */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">Want to test without files?</span>
        <button
          type="button"
          onClick={onLoadSampleDoc}
          className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-teal-700" />
          <span>{sampleButtonLabel}</span>
        </button>
      </div>
    </div>
  );
};
