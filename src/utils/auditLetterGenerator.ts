import { LoanComparisonReport } from '../types/loan';

export interface DraftAuditLetter {
  subject: string;
  body: string;
}

/**
 * Generates the formal draft audit clarification letter from the comparison report
 */
export function generateDraftAuditLetter(report: LoanComparisonReport): DraftAuditLetter {
  const discrepancies = report.comparisons.filter(
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

  const subject = report.isDemo
    ? `[Sample Demonstration Notice] Request for Clarification on Draft Loan Agreement - ${report.borrowerName}`
    : `Clarification Request: Review of Draft Loan Agreement vs Key Facts Statement - ${report.borrowerName}`;

  const body = `${report.isDemo ? '*** NOTE: SYNTHETIC SAMPLE LETTER GENERATED IN DEMO MODE ***\n\n' : ''}Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}

To,
The Credit Operations / Branch Manager,
${report.lenderName}

Subject: ${subject}
Facility: ${report.loanType}
Borrower Name: ${report.borrowerName}

Dear Sir / Madam,

I have received the draft Loan Agreement prepared for execution regarding the aforementioned credit facility. Upon conducting a clause-by-clause cross-examination against the Key Facts Statement (KFS) and Sanction Letter previously issued by your institution, I noted specific variances between the pre-contract disclosures and the proposed agreement schedule.

Before executing the binding agreement, I request your written clarification on the following items:

${questionsList || 'All primary terms appear aligned. Please confirm the final disbursement and EMI schedule.'}

Under relevant Reserve Bank of India (RBI) notifications—including Circular DOR.MCS.REC.17/01.01.001/2024-25 on Key Facts Statements and Circular DoR.MCS.REC.28/01.01.001/2023-24 on Fair Lending Practices—pre-contract disclosures must accurately represent the contracted terms.

Kindly review these points and provide updated execution schedules reflecting the agreed terms so that we may proceed to signing.

Thank you for your assistance.

Yours sincerely,

${report.borrowerName}
Contact: [Insert Phone / Email]`;

  return { subject, body };
}

/**
 * Opens print dialog with the audit letter formatted for printing
 */
export function printAuditLetter(subject: string, body: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const letterContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Loan Clarification Letter</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.5cm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 20px;
      font-size: 11pt;
    }
    .header {
      border-bottom: 2px solid #1e293b;
      padding-bottom: 15px;
      margin-bottom: 25px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 14pt;
      color: #1e293b;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0 0 0;
      font-size: 10pt;
      color: #64748b;
    }
    .subject-line {
      font-weight: bold;
      margin-bottom: 20px;
      word-wrap: break-word;
    }
    .body-text {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 11pt;
      line-height: 1.8;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>LoanLens - Lender Clarification & Rectification Request</h1>
    <p>Formal clarification letter grounded in RBI circulars and contract analysis</p>
  </div>
  <div class="subject-line">Subject: ${subject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  <div class="body-text">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</body>
</html>`;

  doc.open();
  doc.write(letterContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 100);
}

