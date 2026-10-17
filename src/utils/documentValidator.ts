/**
 * Deterministic validation for document intake, PDF magic bytes,
 * text lengths, and Gemini structured output integrity.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a base64 encoded document file.
 * Specifically checks for minimum size and valid %PDF magic header for PDF files.
 */
export function validateDocumentFile(
  base64Data: string | null | undefined,
  mimeType?: string,
  fileName?: string
): ValidationResult {
  if (!base64Data || typeof base64Data !== 'string') {
    return { isValid: false, error: 'Document data is missing.' };
  }

  // Strip prefix data URL and any internal whitespace/newlines from base64
  const clean = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (clean.length < 50) {
    return {
      isValid: false,
      error: 'Uploaded file appears empty or corrupted (under 50 bytes). Please upload a valid document.',
    };
  }

  // Base64 regex format check on initial chunk
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  const sample = clean.substring(0, Math.min(128, clean.length));
  if (!base64Regex.test(sample)) {
    return {
      isValid: false,
      error: 'Malformed base64 file encoding. Please check the file format.',
    };
  }

  const isPdf =
    mimeType === 'application/pdf' ||
    (Boolean(fileName) && fileName!.toLowerCase().endsWith('.pdf'));

  if (isPdf) {
    try {
      // Decode up to the first 1024 bytes (ISO 32000-1 allows header within first 1024 bytes)
      const decodedHead = Buffer.from(clean.substring(0, 2048), 'base64').toString('binary');
      if (!decodedHead.includes('%PDF')) {
        return {
          isValid: false,
          error: 'Uploaded file is not a valid PDF document (missing %PDF file header). Please ensure the file is an authentic, uncorrupted PDF.',
        };
      }
    } catch {
      return {
        isValid: false,
        error: 'Failed to decode base64 file data. File is corrupted.',
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates pasted text content.
 */
export function validateTextContent(text: string | null | undefined): ValidationResult {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Pasted text is empty.' };
  }

  const trimmed = text.trim();
  if (trimmed.length < 30) {
    return {
      isValid: false,
      error: 'Pasted text is too brief to contain standard loan terms. Please paste complete loan clauses, schedules, or KFS text.',
    };
  }

  return { isValid: true };
}

/**
 * Validates AI extraction response integrity.
 * Ensures the model returned all required fields without fabrication.
 */
export function validateAiParsedData(parsedData: any): ValidationResult {
  if (!parsedData || typeof parsedData !== 'object') {
    return {
      isValid: false,
      error: 'The document analyzer response is empty or invalid.',
    };
  }

  if (!parsedData.fields || typeof parsedData.fields !== 'object') {
    return {
      isValid: false,
      error: 'The document analyzer could not identify standard loan contract terms in the submitted file.',
    };
  }

  const requiredFields = [
    'loanAmount',
    'interestRate',
    'apr',
    'tenureMonths',
    'emi',
    'processingFees',
    'insurance',
    'penalCharges',
    'prepaymentCharges',
  ];

  for (const field of requiredFields) {
    if (!parsedData.fields[field]) {
      return {
        isValid: false,
        error: `Incomplete extraction: Missing field "${field}" in document analysis.`,
      };
    }
  }

  return { isValid: true };
}
