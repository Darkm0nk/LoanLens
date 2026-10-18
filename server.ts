import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  validateDocumentFile,
  validateTextContent,
  validateAiParsedData,
} from './src/utils/documentValidator';
import { verifySourceSubstantiation } from './src/utils/sourceVerifier';
import { ExtractedLoanFields } from './src/types/loan';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Shared server-side Gemini client
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  res.json({
    status: 'ok',
    geminiConfigured: hasKey,
    timestamp: new Date().toISOString(),
  });
});

// JSON Schema for loan document extraction
const extractionSchema = {
  type: Type.OBJECT,
  properties: {
    lenderName: {
      type: Type.STRING,
      description: 'The bank or NBFC issuing the document (e.g., HDFC Bank, SBI, Apex Housing Finance, Bajaj Finserv).',
    },
    borrowerName: {
      type: Type.STRING,
      description: 'The primary borrower name as stated in the document.',
    },
    loanType: {
      type: Type.STRING,
      description: 'Type of loan (e.g. Home Loan, Personal Loan, Loan Against Property, Vehicle Loan).',
    },
    documentDate: {
      type: Type.STRING,
      description: 'Date on the document in YYYY-MM-DD or as text.',
    },
    rawSummary: {
      type: Type.STRING,
      description: '2-sentence factual summary of the document and key terms.',
    },
    fields: {
      type: Type.OBJECT,
      properties: {
        loanAmount: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Numeric sanctioned amount in INR (e.g. 4200000). Null if not found.' },
            rawText: { type: Type.STRING, description: 'Exact verbatim text showing amount, e.g. "Rs 42,00,000/-"' },
            pageClauseRef: { type: Type.STRING, description: 'Exact page number and clause/table reference, e.g. "Page 1, Clause 2"' },
            notes: { type: Type.STRING, description: 'Any relevant notes, e.g. includes insurance or charges' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        interestRate: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Annual interest rate as percentage number (e.g. 8.75). Null if not found.' },
            rateType: { type: Type.STRING, description: 'Must be one of: "floating", "fixed", "hybrid", "unknown"' },
            benchmark: { type: Type.STRING, description: 'EBLR, Repo Rate, MCLR or internal prime rate with spread' },
            rawText: { type: Type.STRING, description: 'Exact verbatim text showing interest rate' },
            pageClauseRef: { type: Type.STRING, description: 'Exact page and clause' },
            notes: { type: Type.STRING, description: 'Spread breakdown or revision clauses' },
          },
          required: ['rawText', 'pageClauseRef', 'rateType'],
        },
        apr: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Annual Percentage Rate (APR) numeric percentage (e.g. 9.15). Null if absent.' },
            rawText: { type: Type.STRING, description: 'Verbatim APR text or "Not stated"' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause reference' },
            notes: { type: Type.STRING, description: 'All-inclusive cost breakdown notes' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        tenureMonths: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.INTEGER, description: 'Total tenure in number of months (e.g. 240). Null if absent.' },
            rawText: { type: Type.STRING, description: 'Verbatim text for tenure (e.g. "20 years / 240 months")' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Moratorium or reset notes' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        emi: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Monthly EMI installment in INR (e.g. 37126). Null if absent.' },
            rawText: { type: Type.STRING, description: 'Verbatim EMI text' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Due date or installment schedule details' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        processingFees: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Numeric processing fee in INR (e.g. 5000). Null if absent.' },
            gstDetails: { type: Type.STRING, description: 'Details on GST (18%) inclusion or addition' },
            percentage: { type: Type.NUMBER, description: 'Percentage if fee is percentage-based, else null' },
            rawText: { type: Type.STRING, description: 'Verbatim text regarding processing fees' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Whether upfront or deducted from disbursement' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        insurance: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.NUMBER, description: 'Numeric insurance premium charged in INR (e.g. 0 or 78000).' },
            isMandatory: { type: Type.BOOLEAN, description: 'True if framed as mandatory/condition precedent, false if voluntary, null if not mentioned' },
            policyName: { type: Type.STRING, description: 'Policy type e.g. Credit Life, Property Insurance, Suraksha Cover' },
            rawText: { type: Type.STRING, description: 'Verbatim text regarding insurance' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Whether capitalized into loan or paid separately' },
          },
          required: ['rawText', 'pageClauseRef'],
        },
        penalCharges: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.STRING, description: 'Description of penal fee e.g. "₹500 per month" or "24% p.a. compounded"' },
            isCompoundedInterest: { type: Type.BOOLEAN, description: 'True if document states compounded interest or penal interest on overdue amount (which violates RBI rule)' },
            isRbiCompliant: { type: Type.BOOLEAN, description: 'True if simple reasonable charges, false if penal interest / compounded' },
            rawText: { type: Type.STRING, description: 'Verbatim text of penal clause' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Specific penalty formulas' },
          },
          required: ['value', 'isCompoundedInterest', 'isRbiCompliant', 'rawText', 'pageClauseRef'],
        },
        prepaymentCharges: {
          type: Type.OBJECT,
          properties: {
            value: { type: Type.STRING, description: 'Description e.g. "Nil / Zero" or "2% within 18 months"' },
            hasPenalty: { type: Type.BOOLEAN, description: 'True if any prepayment or foreclosure fee is levied' },
            isFloatingNilExempt: { type: Type.BOOLEAN, description: 'True if compliant with RBI mandate of zero prepayment for individual floating loans' },
            rawText: { type: Type.STRING, description: 'Verbatim clause text' },
            pageClauseRef: { type: Type.STRING, description: 'Page and clause' },
            notes: { type: Type.STRING, description: 'Lock-in periods or conditions' },
          },
          required: ['value', 'hasPenalty', 'rawText', 'pageClauseRef'],
        },
      },
      required: [
        'loanAmount',
        'interestRate',
        'apr',
        'tenureMonths',
        'emi',
        'processingFees',
        'insurance',
        'penalCharges',
        'prepaymentCharges',
      ],
    },
  },
  required: ['lenderName', 'loanType', 'rawSummary', 'fields'],
};

// Document extraction route
app.post('/api/extract', async (req: Request, res: Response) => {
  try {
    const { documentType, documentName, textContent, fileBase64, mimeType } = req.body;

    if (!documentType) {
      res.status(400).json({ error: 'Missing documentType (kfs, sanction_letter, or loan_agreement)' });
      return;
    }

    if (!textContent && !fileBase64) {
      res.status(400).json({ error: 'Please provide either document text or fileBase64' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API is not configured on the server. Please attach GEMINI_API_KEY in the Settings > Secrets panel.',
      });
      return;
    }

    const docTypeLabel =
      documentType === 'kfs'
        ? 'Key Facts Statement (KFS)'
        : documentType === 'sanction_letter'
        ? 'Sanction Letter'
        : 'Loan Agreement';

    const systemPrompt = `You are an expert Indian banking and legal document auditor specializing in retail and MSME loans under Reserve Bank of India (RBI) regulations.
Your objective is to examine this ${docTypeLabel} and extract the 9 core loan terms with absolute fidelity to the source document.

CRITICAL VERIFICATION INSTRUCTIONS:
1. NEVER invent, hallucinate, guess, or extrapolate values. If a field is not present in the document text/pages, set numeric value to null, rawText to "Not mentioned in document", and pageClauseRef to "Page reference not detected in document text".
2. Page & Clause Citations: Only cite a page or clause reference if it is explicitly present in the document (e.g. "Page 1, Item 3", "Clause 4.1", "Schedule B, Row 2"). If the document does not display page numbers or explicit clauses, set pageClauseRef to "Page reference not detected in document text". Do NOT guess page numbers.
3. Numeric & Financial Extraction:
   - Loan Amount: Extract pure integer in INR (e.g. Rs. 42 Lakhs -> 4200000). Set to null if not found.
   - Interest Rate: Extract pure decimal percentage per annum (e.g. 8.75). Set to null if not found.
   - APR: Extract Annual Percentage Rate decimal (e.g. 9.15). Set to null if absent.
   - Tenure: Convert to total number of months (e.g. 20 years -> 240). Set to null if absent.
   - EMI: Monthly installment amount in INR. Set to null if absent.
   - Processing Fees: Upfront processing fee amount in INR. Set to null if absent.
   - Insurance: Loan protection/credit shield premium amount if stated. Flag whether framed as mandatory condition precedent or voluntary.
   - Penal Charges: Check whether the lender levies simple flat penal charges (RBI compliant) or compounded penal interest.
   - Prepayment / Foreclosure Charges: Check if foreclosure penalties are levied on floating rate loans.
4. Identify the Lender Name, Borrower Name, and Loan Type accurately. If borrower name is redacted or absent, return "Borrower".`;

    let contentsPayload: any;

    if (fileBase64 && mimeType) {
      const fileValidation = validateDocumentFile(fileBase64, mimeType, documentName);
      if (!fileValidation.isValid) {
        res.status(400).json({ error: fileValidation.error });
        return;
      }

      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (mimeType === 'text/plain' || (documentName && documentName.toLowerCase().endsWith('.txt'))) {
        let textDecoded = '';
        try {
          textDecoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
        } catch {
          textDecoded = '';
        }
        contentsPayload = [
          {
            text: `Document Type: ${docTypeLabel}\nDocument Name: ${documentName || 'Uploaded Text Document'}\n\nDocument Text Content:\n"""\n${textDecoded}\n"""\n\nPlease extract all 9 key loan terms and exact clause references from the text above as defined in the schema.`,
          },
        ];
      } else {
        contentsPayload = [
          {
            inlineData: {
              mimeType: mimeType === 'application/pdf' ? 'application/pdf' : mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Please analyze this Indian loan document (${docTypeLabel}: "${documentName || 'Uploaded Document'}"). Extract all 9 key loan terms and exact verifiable page/clause references as defined in the schema. If a page or clause is not explicitly numbered, state "Page reference not detected in document text".`,
          },
        ];
      }
    } else {
      const textValidation = validateTextContent(textContent);
      if (!textValidation.isValid) {
        res.status(400).json({ error: textValidation.error });
        return;
      }

      contentsPayload = [
        {
          text: `Document Type: ${docTypeLabel}\nDocument Name: ${documentName || 'Pasted Content'}\n\nDocument Text:\n"""\n${textContent}\n"""\n\nPlease extract all 9 key loan terms and exact clause references from the text above as defined in the schema.`,
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsPayload,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
        temperature: 0.1, // low temperature for strictly grounded deterministic extraction
      },
    });

    const outputText = response.text;
    if (!outputText) {
      res.status(502).json({ error: 'No output received from Gemini document parser.' });
      return;
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(outputText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', outputText);
      res.status(502).json({
        error: 'Unable to parse AI extraction output as valid JSON. Please retry.',
      });
      return;
    }

    const aiDataValidation = validateAiParsedData(parsedData);
    if (!aiDataValidation.isValid) {
      res.status(502).json({
        error: aiDataValidation.error || 'The document analyzer could not identify standard loan contract terms in the submitted file.',
      });
      return;
    }

    const checkFieldVerified = (
      val: any,
      raw?: string,
      ref?: string,
      fieldKey?: keyof ExtractedLoanFields
    ): boolean => {
      const res = verifySourceSubstantiation(val, raw, ref, fieldKey);
      return res.isVerified;
    };

    const extractedResult = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      documentType,
      documentName: documentName || `${docTypeLabel}.pdf`,
      uploadDate: new Date().toISOString().split('T')[0],
      isDemo: false,
      isCombinedPackage: Boolean(req.body.isCombinedPackage),
      originFileName: req.body.originFileName || documentName,
      originSection: req.body.originSection,
      lenderName: parsedData.lenderName || 'Not identified in document',
      borrowerName: parsedData.borrowerName || 'Borrower',
      loanType: parsedData.loanType || 'Retail Loan',
      rawSummary: parsedData.rawSummary,
      fields: {
        loanAmount: {
          value: parsedData.fields?.loanAmount?.value ?? null,
          rawText: parsedData.fields?.loanAmount?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.loanAmount?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.loanAmount?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.loanAmount?.value,
            parsedData.fields?.loanAmount?.rawText,
            parsedData.fields?.loanAmount?.pageClauseRef,
            'loanAmount'
          ),
        },
        interestRate: {
          value: parsedData.fields?.interestRate?.value ?? null,
          rateType: parsedData.fields?.interestRate?.rateType || 'unknown',
          benchmark: parsedData.fields?.interestRate?.benchmark,
          rawText: parsedData.fields?.interestRate?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.interestRate?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.interestRate?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.interestRate?.value,
            parsedData.fields?.interestRate?.rawText,
            parsedData.fields?.interestRate?.pageClauseRef,
            'interestRate'
          ),
        },
        apr: {
          value: parsedData.fields?.apr?.value ?? null,
          rawText: parsedData.fields?.apr?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.apr?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.apr?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.apr?.value,
            parsedData.fields?.apr?.rawText,
            parsedData.fields?.apr?.pageClauseRef,
            'apr'
          ),
        },
        tenureMonths: {
          value: parsedData.fields?.tenureMonths?.value ?? null,
          rawText: parsedData.fields?.tenureMonths?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.tenureMonths?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.tenureMonths?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.tenureMonths?.value,
            parsedData.fields?.tenureMonths?.rawText,
            parsedData.fields?.tenureMonths?.pageClauseRef,
            'tenureMonths'
          ),
        },
        emi: {
          value: parsedData.fields?.emi?.value ?? null,
          rawText: parsedData.fields?.emi?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.emi?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.emi?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.emi?.value,
            parsedData.fields?.emi?.rawText,
            parsedData.fields?.emi?.pageClauseRef,
            'emi'
          ),
        },
        processingFees: {
          value: parsedData.fields?.processingFees?.value ?? null,
          gstDetails: parsedData.fields?.processingFees?.gstDetails,
          percentage: parsedData.fields?.processingFees?.percentage ?? null,
          rawText: parsedData.fields?.processingFees?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.processingFees?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.processingFees?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.processingFees?.value,
            parsedData.fields?.processingFees?.rawText,
            parsedData.fields?.processingFees?.pageClauseRef,
            'processingFees'
          ),
        },
        insurance: {
          value: parsedData.fields?.insurance?.value ?? null,
          isMandatory: parsedData.fields?.insurance?.isMandatory ?? null,
          policyName: parsedData.fields?.insurance?.policyName,
          rawText: parsedData.fields?.insurance?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.insurance?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.insurance?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.insurance?.value,
            parsedData.fields?.insurance?.rawText,
            parsedData.fields?.insurance?.pageClauseRef,
            'insurance'
          ),
        },
        penalCharges: {
          value: parsedData.fields?.penalCharges?.value || 'Not specified in document',
          isCompoundedInterest:
            typeof parsedData.fields?.penalCharges?.isCompoundedInterest === 'boolean'
              ? parsedData.fields.penalCharges.isCompoundedInterest
              : null,
          isRbiCompliant:
            typeof parsedData.fields?.penalCharges?.isRbiCompliant === 'boolean'
              ? parsedData.fields.penalCharges.isRbiCompliant
              : null,
          rawText: parsedData.fields?.penalCharges?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.penalCharges?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.penalCharges?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.penalCharges?.value,
            parsedData.fields?.penalCharges?.rawText,
            parsedData.fields?.penalCharges?.pageClauseRef,
            'penalCharges'
          ),
        },
        prepaymentCharges: {
          value: parsedData.fields?.prepaymentCharges?.value || 'Not specified in document',
          hasPenalty:
            typeof parsedData.fields?.prepaymentCharges?.hasPenalty === 'boolean'
              ? parsedData.fields.prepaymentCharges.hasPenalty
              : null,
          isFloatingNilExempt:
            typeof parsedData.fields?.prepaymentCharges?.isFloatingNilExempt === 'boolean'
              ? parsedData.fields.prepaymentCharges.isFloatingNilExempt
              : null,
          rawText: parsedData.fields?.prepaymentCharges?.rawText || 'Not specified in document',
          pageClauseRef: parsedData.fields?.prepaymentCharges?.pageClauseRef || 'Page reference not detected in document text',
          notes: parsedData.fields?.prepaymentCharges?.notes,
          isVerifiedInSource: checkFieldVerified(
            parsedData.fields?.prepaymentCharges?.value,
            parsedData.fields?.prepaymentCharges?.rawText,
            parsedData.fields?.prepaymentCharges?.pageClauseRef,
            'prepaymentCharges'
          ),
        },
      },
    };

    res.json(extractedResult);
  } catch (error: any) {
    const providerStatus = Number(error?.status ?? error?.statusCode ?? 0);
    const providerMessage = String(error?.message ?? '');
    const quotaExceeded =
      providerStatus === 429 ||
      /RESOURCE_EXHAUSTED|quota exceeded|rate limit/i.test(providerMessage);

    if (quotaExceeded) {
      console.warn('Gemini free-tier quota reached; automatic retry skipped.');
      res.status(429).json({
        code: 'GEMINI_QUOTA_EXCEEDED',
        error: 'The Gemini free-tier request limit has been reached. Please wait for the quota to reset, or use the sample demo. This application does not enable billing automatically.',
      });
      return;
    }

    console.error('Document extraction failed:', {
      status: providerStatus || 'unknown',
      message: providerMessage.slice(0, 300),
    });
    res.status(502).json({
      code: 'DOCUMENT_EXTRACTION_FAILED',
      error: 'Gemini could not process this document right now. Please try later or use the sample demo.',
    });
  }
});

// Dispute letter generator endpoint
app.post('/api/generate-lender-inquiry', async (req: Request, res: Response) => {
  try {
    const { report } = req.body;
    if (!report) {
      res.status(400).json({ error: 'Missing comparison report data' });
      return;
    }

    const ai = getAiClient();
    if (!ai) {
      // Deterministic fallback dispute letter
      const fallbackSubject = `Urgent: Discrepancy Clarification Required on Loan Application - ${report.borrowerName}`;
      const questionsList = report.comparisons
        .filter((c: any) => c.status === 'mismatch' || c.severity === 'critical')
        .map((c: any, idx: number) => `${idx + 1}. ${c.label}:\n   - Issue: ${c.summary}\n   - Required Clarification: ${c.lenderQuestion}\n   - Reference: ${c.rbiGuideline}`)
        .join('\n\n');

      const fallbackBody = `To,\nThe Branch Manager / Credit Officer,\n${report.lenderName}\n\nSubject: ${fallbackSubject}\n\nDear Sir/Madam,\n\nI am in receipt of the draft Loan Agreement regarding my ${report.loanType}. Upon a meticulous cross-verification against the Key Facts Statement (KFS) and Sanction Letter previously issued by your institution, I have noticed significant discrepancies between the promised terms and the agreement clauses.\n\nKindly furnish your written clarifications on the following points before I execute the agreement:\n\n${questionsList}\n\nAs you are aware, Reserve Bank of India (RBI) directives on Fair Practices Code, KFS disclosure mandates, and the Circular on Penal Charges in Loan Accounts (DoR.MCS.REC.28/01.01.001/2023-24) require lenders to strictly adhere to the Key Facts Statement and prohibit unauthorized charges or compounding of penal interest.\n\nI request you to rectify these clauses in the final execution copy so that we may proceed smoothly.\n\nYours sincerely,\n${report.borrowerName}`;

      res.json({ subject: fallbackSubject, letterBody: fallbackBody });
      return;
    }

    const prompt = `Write a professional, legally grounded, polite yet firm loan clarification and dispute letter from borrower "${report.borrowerName}" to "${report.lenderName}".
The borrower is comparing their Key Facts Statement (KFS), Sanction Letter, and the final Loan Agreement for their ${report.loanType}.
Here are the specific discrepancies and questions:
${JSON.stringify(
  report.comparisons.map((c: any) => ({
    term: c.label,
    status: c.status,
    discrepancy: c.summary,
    questionToAsk: c.lenderQuestion,
    rbiRule: c.rbiGuideline,
    financialImpact: c.financialImpact,
  })),
  null,
  2
)}

Format the response as JSON with "subject" (single line subject) and "letterBody" (structured formal letter citing relevant clauses, numbers, and RBI circulars).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            letterBody: { type: Type.STRING },
          },
          required: ['subject', 'letterBody'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (err: any) {
    console.error('Error in letter generation:', err);
    res.status(500).json({ error: 'Failed to generate lender inquiry letter' });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LoanLens server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
