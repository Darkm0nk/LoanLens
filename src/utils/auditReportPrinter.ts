/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LoanComparisonReport, FieldComparison, SourceVerificationLevel } from '../types/loan';

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves user-facing verification badge according to strict evidence hierarchy.
 *
 * Rules:
 * 1. source_verified: Requires BOTH level === 'source_verified' AND isVerified !== false.
 *    If isVerified is explicitly false, it is a contradictory/failed state and must not receive verified badge.
 * 2. excerpt_corroborated: Excerpt substantiates value, but document text was not independently verified.
 *    Never upgraded to source_verified even if a boolean flag is true.
 * 3. ai_extracted: Returned by AI model without independent corroboration.
 *    Never upgraded to source_verified.
 * 4. unverified / undefined / contradictory: Labeled as unverified.
 */
export function formatVerificationBadge(
  level?: SourceVerificationLevel,
  isVerified?: boolean,
  isDemo?: boolean
): string {
  if (isDemo) {
    return '<span class="badge badge-corroborated">Sample Benchmark Citation</span>';
  }
  if (level === 'source_verified' && isVerified !== false) {
    return '<span class="badge badge-verified">✓ Source Verified</span>';
  }
  if (level === 'excerpt_corroborated') {
    return '<span class="badge badge-corroborated">Excerpt Corroborated</span>';
  }
  if (level === 'ai_extracted') {
    return '<span class="badge badge-unverified">AI Extracted (Unverified)</span>';
  }
  return '<span class="badge badge-unverified">Unverified Citation</span>';
}

function formatStatusBadge(status: 'match' | 'mismatch' | 'missing', classification?: string): string {
  if (status === 'match') {
    return '<span class="badge badge-match">ALIGNED (MATCH)</span>';
  }
  if (status === 'mismatch') {
    const label = classification ? escapeHtml(classification.toUpperCase()) : 'VARIANCE (MISMATCH)';
    return `<span class="badge badge-mismatch">${label}</span>`;
  }
  return '<span class="badge badge-missing">MISSING DISCLOSURE</span>';
}

/**
 * Generates a complete, self-contained, print-ready HTML audit report.
 * Pure function suitable for deterministic offline unit testing.
 */
export function generateAuditReportHtml(report: LoanComparisonReport): string {
  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const demoNotice = report.isDemo
    ? `
    <div class="demo-banner">
      <div class="demo-title">⚠️ SYNTHETIC DEMONSTRATION AUDIT · SAMPLE DATA MODE</div>
      <div class="demo-desc">This report was generated using synthetic demonstration loan profiles for software evaluation purposes. It does not evaluate real borrower documents or active financial agreements.</div>
    </div>`
    : `
    <div class="confidential-badge">
      <span>CONFIDENTIAL · BORROWER AUDIT REPORT</span>
    </div>`;

  const singleSourceBanner = report.isCombinedPackage
    ? `
    <div class="single-source-banner">
      <strong>Single-Source Multi-Section Notice:</strong> Key Facts Statement, Sanction Letter, and Agreement clauses were extracted from a single bound PDF package (${escapeHtml(report.combinedFileName || 'Combined Document')}).
    </div>`
    : '';

  const comparisonsHtml = report.comparisons
    .map((comp: FieldComparison, index: number) => {
      const kfsVal = comp.values.kfs;
      const sanctionVal = comp.values.sanctionLetter;
      const agreementVal = comp.values.loanAgreement;

      const impactHtml = comp.financialImpact
        ? `
        <div class="financial-impact">
          <strong>Calculated Financial Impact:</strong> ${escapeHtml(comp.financialImpact)}
          ${
            comp.calculationAssumptions && comp.calculationAssumptions.length > 0
              ? `<div class="assumptions">Assumptions: ${escapeHtml(comp.calculationAssumptions.join('; '))}</div>`
              : ''
          }
        </div>`
        : '';

      const regulatoryHtml = comp.rbiGuideline || comp.circularReference
        ? `
        <div class="regulatory-box">
          ${comp.circularReference ? `<div><strong>Directive Ref:</strong> ${escapeHtml(comp.circularReference)}</div>` : ''}
          ${comp.rbiGuideline ? `<div><strong>Regulatory Mandate:</strong> ${escapeHtml(comp.rbiGuideline)}</div>` : ''}
        </div>`
        : '';

      const questionHtml = comp.lenderQuestion
        ? `
        <div class="question-box">
          <strong>Recommended Clarification Request:</strong> ${escapeHtml(comp.lenderQuestion)}
        </div>`
        : '';

      return `
      <div class="term-card">
        <div class="term-header">
          <div class="term-title">
            <span class="term-num">${index + 1}.</span> ${escapeHtml(comp.label)}
          </div>
          <div>
            ${formatStatusBadge(comp.status, comp.classification)}
          </div>
        </div>

        <div class="term-summary">
          <strong>Finding:</strong> ${escapeHtml(comp.summary)}
        </div>

        <table class="values-table">
          <thead>
            <tr>
              <th style="width: 25%;">Document Source</th>
              <th style="width: 30%;">Disclosed Value</th>
              <th style="width: 25%;">Clause / Page Citation</th>
              <th style="width: 20%;">Evidence Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Key Facts Statement</strong></td>
              <td>${escapeHtml(kfsVal?.display || 'Not extracted')}</td>
              <td class="citation">${escapeHtml(kfsVal?.pageClauseRef || '—')}</td>
              <td>${kfsVal ? formatVerificationBadge(kfsVal.verificationLevel, kfsVal.isVerifiedInSource, report.isDemo || comp.isSampleData) : '—'}</td>
            </tr>
            <tr>
              <td><strong>Sanction Letter</strong></td>
              <td>${escapeHtml(sanctionVal?.display || 'Not extracted')}</td>
              <td class="citation">${escapeHtml(sanctionVal?.pageClauseRef || '—')}</td>
              <td>${sanctionVal ? formatVerificationBadge(sanctionVal.verificationLevel, sanctionVal.isVerifiedInSource, report.isDemo || comp.isSampleData) : '—'}</td>
            </tr>
            <tr>
              <td><strong>Loan Agreement</strong></td>
              <td>${escapeHtml(agreementVal?.display || 'Not extracted')}</td>
              <td class="citation">${escapeHtml(agreementVal?.pageClauseRef || '—')}</td>
              <td>${agreementVal ? formatVerificationBadge(agreementVal.verificationLevel, agreementVal.isVerifiedInSource, report.isDemo || comp.isSampleData) : '—'}</td>
            </tr>
          </tbody>
        </table>

        ${impactHtml}
        ${regulatoryHtml}
        ${questionHtml}
      </div>`;
    })
    .join('\n');

  const warningsListHtml =
    report.keyWarnings && report.keyWarnings.length > 0
      ? `
      <div class="warnings-box">
        <div class="warnings-title">Identified Risk & Variance Summary:</div>
        <ul class="warnings-list">
          ${report.keyWarnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}
        </ul>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LoanLens Contract Audit Report - ${escapeHtml(report.borrowerName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.45;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5pt;
    }

    /* Header */
    .report-header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .brand-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: -0.5px;
      margin: 0;
    }

    .brand-subtitle {
      font-size: 8.5pt;
      color: #475569;
      margin: 2px 0 0 0;
    }

    .report-meta {
      text-align: right;
      font-size: 8pt;
      color: #475569;
    }

    .report-meta strong {
      color: #0f172a;
    }

    /* Banners */
    .demo-banner {
      background: #fffbeb;
      border: 1.5px dashed #f59e0b;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }

    .demo-title {
      font-size: 9pt;
      font-weight: 700;
      color: #92400e;
    }

    .demo-desc {
      font-size: 8pt;
      color: #b45309;
      margin-top: 2px;
    }

    .confidential-badge {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #475569;
      margin-bottom: 8px;
    }

    .single-source-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 8pt;
      color: #334155;
      margin-bottom: 10px;
    }

    /* Facility Context Grid */
    .context-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }

    .context-item {
      font-size: 8.5pt;
      color: #475569;
    }

    .context-item strong {
      color: #0f172a;
    }

    /* Executive Verdict */
    .verdict-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 14px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .verdict-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .verdict-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
    }

    .rating-badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
    }

    .rating-consistent { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .rating-minor { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .rating-variances { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

    .verdict-note {
      font-size: 8.5pt;
      color: #334155;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    /* Stats Strip */
    .stats-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    .stat-cell {
      text-align: center;
      background: #f8fafc;
      border-radius: 4px;
      padding: 6px 4px;
    }

    .stat-value {
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
    }

    .stat-label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Warnings */
    .warnings-box {
      margin-top: 8px;
      padding: 8px 10px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 4px;
    }

    .warnings-title {
      font-size: 8pt;
      font-weight: 700;
      color: #9f1239;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .warnings-list {
      margin: 4px 0 0 16px;
      padding: 0;
      font-size: 8pt;
      color: #881337;
    }

    .warnings-list li {
      margin-bottom: 3px;
    }

    /* Section Header */
    .section-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin: 14px 0 10px 0;
    }

    /* Term Cards */
    .term-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .term-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .term-title {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
    }

    .term-num {
      color: #0f766e;
      margin-right: 2px;
    }

    .term-summary {
      font-size: 8.5pt;
      color: #334155;
      margin-bottom: 8px;
      line-height: 1.35;
    }

    /* Tables */
    .values-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin-bottom: 6px;
    }

    .values-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-align: left;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }

    .values-table td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: middle;
    }

    .citation {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 7.5pt;
      color: #475569;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }

    .badge-match { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .badge-mismatch { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .badge-missing { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .badge-verified { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .badge-corroborated { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-unverified { background: #f8fafc; color: #64748b; border: 1px solid #cbd5e1; }

    /* Highlights & Notes */
    .financial-impact {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 5px 8px;
      font-size: 8pt;
      color: #92400e;
      margin-top: 6px;
    }

    .financial-impact .assumptions {
      font-size: 7.5pt;
      color: #b45309;
      margin-top: 2px;
    }

    .regulatory-box {
      background: #f0fdf4;
      border-left: 3px solid #16a34a;
      padding: 5px 8px;
      font-size: 7.5pt;
      color: #166534;
      margin-top: 6px;
      line-height: 1.35;
    }

    .question-box {
      background: #f8fafc;
      border-left: 3px solid #475569;
      padding: 5px 8px;
      font-size: 7.5pt;
      color: #1e293b;
      margin-top: 6px;
      line-height: 1.35;
    }

    /* Footer Disclaimers */
    .disclaimer-box {
      border-top: 1.5px solid #cbd5e1;
      padding-top: 10px;
      margin-top: 16px;
      font-size: 7pt;
      color: #64748b;
      line-height: 1.4;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .disclaimer-box strong {
      color: #334155;
    }

    @media print {
      body {
        padding: 0;
      }
      .term-card {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="report-header">
    <div>
      <h1 class="brand-title">LoanLens</h1>
      <p class="brand-subtitle">Loan Contract Audit & Pre-Signing Due Diligence Report</p>
    </div>
    <div class="report-meta">
      <div><strong>Report Generated:</strong> ${generatedAt}</div>
      <div><strong>Terms Evaluated:</strong> ${report.totalTermsEvaluated} Core Clauses</div>
      <div><strong>Standard:</strong> RBI KFS & Fair Practices Directives</div>
    </div>
  </header>

  ${demoNotice}
  ${singleSourceBanner}

  <!-- Borrower & Facility Context -->
  <section class="context-grid">
    <div class="context-item"><strong>Borrower Name:</strong> ${escapeHtml(report.borrowerName)}</div>
    <div class="context-item"><strong>Lending Institution:</strong> ${escapeHtml(report.lenderName)}</div>
    <div class="context-item"><strong>Facility / Loan Type:</strong> ${escapeHtml(report.loanType)}</div>
    <div class="context-item">
      <strong>Documents Evaluated:</strong> 
      ${report.documentsPresent.kfs ? 'KFS ✓' : 'KFS ✗'} · 
      ${report.documentsPresent.sanctionLetter ? 'Sanction Letter ✓' : 'Sanction Letter ✗'} · 
      ${report.documentsPresent.loanAgreement ? 'Loan Agreement ✓' : 'Loan Agreement ✗'}
    </div>
  </section>

  <!-- Executive Verdict -->
  <section class="verdict-card">
    <div class="verdict-header">
      <div class="verdict-title">Executive Audit Recommendation: ${escapeHtml(report.recommendation)}</div>
      <span class="rating-badge ${
        report.riskRating === 'Consistent'
          ? 'rating-consistent'
          : report.riskRating === 'Minor Variances'
          ? 'rating-minor'
          : 'rating-variances'
      }">Risk Rating: ${escapeHtml(report.riskRating)}</span>
    </div>

    <div class="verdict-note">
      ${escapeHtml(report.recommendationNote)}
    </div>

    <div class="stats-strip">
      <div class="stat-cell">
        <div class="stat-value">${report.totalTermsEvaluated}</div>
        <div class="stat-label">Evaluated Terms</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color: #166534;">${report.matchCount}</div>
        <div class="stat-label">Aligned Terms</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color: #991b1b;">${report.mismatchCount}</div>
        <div class="stat-label">Variances Noted</div>
      </div>
      <div class="stat-cell">
        <div class="stat-value" style="color: #854d0e;">${report.missingCount}</div>
        <div class="stat-label">Missing Items</div>
      </div>
    </div>

    ${warningsListHtml}
  </section>

  <!-- Clause Comparison Findings -->
  <section>
    <div class="section-title">Detailed Clause-by-Clause Audit Matrix</div>
    ${comparisonsHtml}
  </section>

  <!-- Disclaimers -->
  <footer class="disclaimer-box">
    <p><strong>Regulatory Due Diligence Notice:</strong> This audit report is generated by LoanLens to assist Indian retail borrowers in conducting rigorous pre-contract due diligence under Reserve Bank of India (RBI) consumer protection directives, including the Master Direction on Key Facts Statements (Circular DOR.MCS.REC.17/01.01.001/2024-25), Fair Practices Code, and Circular on Penal Charges in Loan Accounts (DoR.MCS.REC.28/01.01.001/2023-24). This report does not constitute binding legal counsel. Variances between initial pre-sanction offers and final execution drafts may arise from underwriting criteria or benchmark reset dates. Borrowers are strongly advised to obtain formal written clarifications from their lending institution before executing binding loan contracts.</p>
    <p><strong>Privacy & Data Protection:</strong> All document analyses and comparisons are performed transiently in memory without persistent disk storage or unauthorized data retention.</p>
  </footer>
</body>
</html>`;
}

/**
 * Triggers browser print dialog for the complete audit report using an isolated iframe.
 * Never silently calls window.print() if iframe setup fails.
 * Guarantees cleanup of temporary DOM elements even if errors occur during report write or rendering.
 */
export function printAuditReport(report: LoanComparisonReport): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  let iframe: HTMLIFrameElement | null = null;
  const cleanupIframe = () => {
    try {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    } catch {
      // Safe cleanup suppression
    }
  };

  try {
    iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'LoanLens Audit Print Document');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      console.error('LoanLens Print Audit: Unable to access iframe document. Print aborted.');
      cleanupIframe();
      return false;
    }

    const reportHtml = generateAuditReportHtml(report);

    doc.open();
    doc.write(reportHtml);
    doc.close();

    win.focus();

    // Trigger print after rendering
    setTimeout(() => {
      try {
        win.print();
      } catch (printErr) {
        console.error('LoanLens Print Audit: Error during iframe print:', printErr);
      } finally {
        setTimeout(cleanupIframe, 1500);
      }
    }, 150);

    return true;
  } catch (err) {
    console.error('LoanLens Print Audit: Failed to initialize printable document:', err);
    cleanupIframe();
    return false;
  }
}
