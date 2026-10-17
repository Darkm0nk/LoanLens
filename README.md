# LoanLens — Check Before You Sign

**LoanLens** is a fintech web application designed for Indian borrowers to systematically cross-audit loan documents before signing.

In retail lending in India (housing loans, personal loans, loan against property), commercial terms can occasionally differ between initial pre-contract disclosures (**Key Facts Statement (KFS)** or **Sanction Letter**) and the 25–40 page **Loan Agreement** draft—including external benchmark spreads, upfront fee inclusions, ancillary credit insurance, and penal clauses.

LoanLens extracts and cross-evaluates 9 core loan terms across documents, identifying variances, displaying verified source page/clause references only when detected in the source text, providing verified RBI regulatory circular contexts, and generating a formal clarification letter for the borrower to review with their lender.

---

## What Has Been Audited & Implemented

### 1. Unmistakable Demo Mode
- All synthetic sample documents, borrower names (`[Sample Data]`), lender institutions (`[Sample Data]`), and comparative metrics are explicitly designated as sample demonstration data.
- The UI features clear visual banners and pill badges in navigation, upload cards, comparison tables, and dispute letters to ensure synthetic data is never mistaken for user-uploaded documents.
- Clearly states that Google Gemini AI evaluates user-uploaded files only, and does not analyze private documents in Demo Mode.

### 2. Rigorous Regulatory Auditing (RBI & IRDAI Citations)
- All sensationalist or unsupported claims (e.g. "illegal", "criminal", "predatory trap") have been removed.
- Findings are grounded in verified circular identifiers, issue dates, effective dates, official notification URLs, and specific applicability conditions:
  - **KFS Mandate:** RBI Circular `RBI/2024-25/18 DOR.MCS.REC.17/01.01.001/2024-25` (Effective October 1, 2024 for retail and MSME loans).
  - **Penal Charges vs. Penal Interest:** RBI Circular `RBI/2023-24/53 DoR.MCS.REC.28/01.01.001/2023-24` (Effective April 1, 2024 requiring reasonable penal charges rather than compounding penal interest).
  - **Foreclosure Charges:** RBI Circular `DBOD.Dir.BC.115/13.03.00/2013-14` (Exemption strictly applies to individual retail borrowers on floating-rate term loans).
  - **Ancillary Insurance Bundling:** IRDAI `IRDAI/NL/GDL/MISC/10/2024` & RBI Fair Practices Directions (Freedom of insurance provider choice).
  - **External Benchmark Linked Rate (EBLR):** RBI Circular `DBR.Dir.BC.No.14/13.03.00/2019-20`.
- Conditional rules are labeled with explicit verification notices (e.g., verifying whether a loan is floating-rate, whether a co-borrower is a commercial entity, or if property insurance is required as collateral protection).

### 3. Cautious Review Recommendations
- Verdicts are presented objectively as:
  - **Terms Aligned Across Documents** (Consistent)
  - **Clarifications Recommended** (Minor Variances)
  - **Review Variances with Lender** (Variances Noted)
- Explicit notice informs borrowers: *A document discrepancy alone does not constitute proof of error or wrongdoing. Terms may adjust during underwriting due to benchmark reset schedules or administrative parameters. Clarify all points with your lender.*

### 4. Real Gemini Document Understanding & Verification
- Real PDF and image files are processed server-side via `@google/genai` (`gemini-3.8-flash`) using strict JSON schema output.
- Distinct pipeline stages: Validating, Uploading, Extracting, Completed, or Failed.
- Source page numbers and clause references are verified against document text. If not detected in the uploaded file, the UI displays *"Page reference not detected in document text"* and never invents citations.
- Pre-upload validation verifies authentic `%PDF` magic bytes and minimum file length, rejecting malformed, empty, or renamed binary files.
- Failures (malformed JSON, unparseable scans, server errors) are reported transparently and never fabricate a fake successful analysis.

### 5. Deterministic Financial Math & Unit Reconciliation
- EMI formula: $E = P \cdot r \cdot \frac{(1+r)^n}{(1+r)^n - 1}$ with reducing balance compounding.
- Lifetime impact calculations require all necessary inputs (principal, interest rate, tenure); when inputs are missing, LoanLens states *"Lifetime impact cannot be computed because required parameters are missing"* instead of fabricating estimates.
- Stated calculation assumptions are displayed for borrower review.
- Unit reconciliation engine detects and resolves unit conflicts:
  - **Tenure:** Converts years to months (e.g., "20 Years" vs "240 Months") and reconciles equivalent durations.
  - **Interest Rate:** Normalizes monthly rates to annualized percentages (% p.a.).
  - **Principal:** Normalizes Lakhs and Crores to INR.

---

## Test Suite

Run the quality and audit test suite:

```bash
npm test
```

The test suite executes 25 automated deterministic checks:
- **Financial Calculations:** EMI formula accuracy, zero percent interest, missing input rejection, lifetime impact math, and assumption outputs.
- **Matching Values:** 100% term-by-term match verification across all 9 loan terms.
- **Mismatches:** Principal, interest rate, tenure, EMI, fee, insurance, penal charge, and prepayment charge discrepancy detection.
- **Missing Terms:** Omitted APR, omitted fees, single-document intake handling.
- **Conflicting Units:** Tenure in years vs months reconciliation, unit conflict detection with duration discrepancies, monthly vs annual interest rate normalization, Lakhs vs INR normalization.
- **Malformed PDFs & Payloads:** Corrupted base64 rejection, missing `%PDF` header rejection, brief text rejection.
- **Failed AI Responses:** Malformed JSON rejection, missing schema fields rejection, empty/primitive model response rejection, demo flag preservation.
- **Regulatory Sourcing:** Circular identifier validation, official HTTPS URL verification, absence of inflammatory/unverified claims.

---

## Local Development & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Ensure `GEMINI_API_KEY` is set in your `.env` file (in Google AI Studio, this is automatically injected from user secrets).

### 3. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```
