/**
 * Verified Reserve Bank of India (RBI) and regulatory references for Indian retail lending.
 * Grounded in official RBI notifications with circular identifiers, dates, URLs, and specific applicability conditions.
 */

export interface RegulatoryRule {
  id: string;
  topic: string;
  circularId: string;
  circularTitle: string;
  issueDate: string;
  effectiveDate: string;
  sourceUrl: string;
  issuingAuthority: 'Reserve Bank of India' | 'IRDAI / RBI';
  applicabilityConditions: string[];
  summary: string;
  guidanceText: string;
  verificationNotice: string;
}

export const REGULATORY_RULES: Record<string, RegulatoryRule> = {
  kfs_harmonization: {
    id: 'kfs_harmonization',
    topic: 'Key Facts Statement (KFS) Disclosure',
    circularId: 'RBI/2024-25/18 DOR.MCS.REC.17/01.01.001/2024-25',
    circularTitle: 'Key Facts Statement (KFS) for Loans & Advances – Deregulation of Interest Rates, Fair Practices Code',
    issueDate: 'April 15, 2024',
    effectiveDate: 'October 1, 2024',
    sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12668&Mode=0',
    issuingAuthority: 'Reserve Bank of India',
    applicabilityConditions: [
      'Applies to all Commercial Banks, Primary Urban Co-operative Banks, and NBFCs (including Housing Finance Companies).',
      'Covers new retail and MSME term loans sanctioned on or after October 1, 2024.',
      'Excludes credit card receivables.',
    ],
    summary:
      'Lenders are required to provide a standardized KFS to borrowers prior to contract execution. Any fee or charge not mentioned in the KFS cannot be charged to the borrower at any stage.',
    guidanceText:
      'Under RBI Circular DOR.MCS.REC.17/01.01.001/2024-25, lenders are expected to provide a standardized KFS detailing the all-inclusive APR and fee schedule. If terms in the draft agreement differ from the KFS, request written confirmation from the lender. Note: A discrepancy between negotiation stages does not constitute proof of illegality or wrongdoing.',
    verificationNotice:
      'Applicability Caveat: Applies to facilities sanctioned on or after October 1, 2024. Differences between negotiation copies and final schedules may reflect approved underwriting revisions; verify whether an amended KFS was issued. A discrepancy alone does not prove regulatory violation.',
  },

  penal_charges: {
    id: 'penal_charges',
    topic: 'Penal Charges vs. Penal Interest',
    circularId: 'RBI/2023-24/53 DoR.MCS.REC.28/01.01.001/2023-24',
    circularTitle: 'Fair Lending Practice - Penal Charges in Loan Accounts',
    issueDate: 'August 18, 2023',
    effectiveDate: 'April 1, 2024',
    sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12527&Mode=0',
    issuingAuthority: 'Reserve Bank of India',
    applicabilityConditions: [
      'Applies to all Regulated Entities (Banks, NBFCs, HFCs, All-India Financial Institutions).',
      'Penalty for delayed payment must strictly be treated as "penal charges" and not as "penal interest" added to the rate of interest.',
      'No compounding of interest on penal charges is permitted.',
      'Excludes credit cards, external commercial borrowings, trade credits, and structured obligations.',
    ],
    summary:
      'Lenders are instructed to levy reasonable flat penal charges rather than compounding penal interest on overdue installments.',
    guidanceText:
      'Under RBI Circular DoR.MCS.REC.28/01.01.001/2023-24, penalties for delayed installment payments should be formulated as reasonable penal charges rather than compounding penal interest. If an execution draft includes default compounding clauses, request clarification from your loan officer.',
    verificationNotice:
      'Applicability Caveat: In effect from April 1, 2024 for all regulated entities. Standard commercial default charges may differ; verify whether this facility is governed under retail borrower circulars. A discrepancy alone does not prove regulatory violation.',
  },

  foreclosure_floating: {
    id: 'foreclosure_floating',
    topic: 'Prepayment & Foreclosure Charges',
    circularId: 'DBOD.Dir.BC.115/13.03.00/2013-14 & DNBR (PD) CC.No.005/03.10.119/2014-15',
    circularTitle: 'Levy of Foreclosure Charges / Pre-payment Penalty on Floating Rate Term Loans',
    issueDate: 'May 7, 2014',
    effectiveDate: 'Immediate upon issue',
    sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=8894&Mode=0',
    issuingAuthority: 'Reserve Bank of India',
    applicabilityConditions: [
      'Applies strictly to floating rate term loans sanctioned to individual borrowers.',
      'Does NOT apply to fixed-rate loans.',
      'Does NOT apply to loans where a business entity, company, or partnership firm is a borrower or co-borrower.',
      'Does NOT apply to loans borrowed for commercial or business purposes.',
    ],
    summary:
      'Banks and NBFCs cannot charge foreclosure charges or prepayment penalties on floating-rate term loans sanctioned to individual borrowers.',
    guidanceText:
      'Under RBI Circular DBOD.Dir.BC.115/13.03.00/2013-14, lenders shall not levy prepayment or foreclosure charges on floating-rate term loans to individual borrowers. If you are an individual retail borrower under a floating-rate facility, verify if foreclosure charges in the draft agreement apply to your category.',
    verificationNotice:
      'Applicability Caveat: This statutory exemption applies specifically to individual retail borrowers on floating rates. Prepayment fees may be legally permissible for fixed-rate facilities, non-individual borrowers, or commercial loans. A discrepancy alone does not prove regulatory violation.',
  },

  insurance_bundling: {
    id: 'insurance_bundling',
    topic: 'Ancillary Insurance Bundling',
    circularId: 'IRDAI/NL/GDL/MISC/10/2024 & RBI Master Directions on Fair Practices Code',
    circularTitle: 'Guidelines on Insurance Tie-ups and Protection of Policyholders Interests',
    issueDate: 'April 2024',
    effectiveDate: 'Continuous regulatory standard',
    sourceUrl: 'https://irdai.gov.in',
    issuingAuthority: 'IRDAI / RBI',
    applicabilityConditions: [
      'Lenders may require collateral/property to be insured against fire/natural perils to protect underlying security.',
      'However, making a specific life insurance policy or credit shield from a preferred partner mandatory is restricted under fair practice codes.',
      'Borrowers retain the option to assign an existing policy or choose another IRDAI-registered insurer.',
    ],
    summary:
      'Coercive tying of credit life insurance as an unalterable condition for loan disbursement is restricted under fair lending codes. Insurance should remain transparent with freedom of provider choice.',
    guidanceText:
      'Under regulatory guidelines from IRDAI and RBI Fair Practices codes, credit insurance cannot be unilaterally added or presented as mandatory without explicit borrower consent. Check whether the policy is voluntary and whether fees are debited upfront from loan proceeds.',
    verificationNotice:
      'Applicability Caveat: Clarify whether the policy is an optional credit protection product or if property insurance is required as a security condition. Borrowers may assign existing policies. A discrepancy alone does not prove regulatory violation.',
  },

  external_benchmark_eblr: {
    id: 'external_benchmark_eblr',
    topic: 'External Benchmark Interest Rate (EBLR) & Spread',
    circularId: 'DBR.Dir.BC.No.14/13.03.00/2019-20',
    circularTitle: 'External Benchmark Based Lending',
    issueDate: 'September 4, 2019',
    effectiveDate: 'October 1, 2019',
    sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11681&Mode=0',
    issuingAuthority: 'Reserve Bank of India',
    applicabilityConditions: [
      'Applies to all scheduled commercial banks (excluding RRBs).',
      'Applies to all new floating rate personal or retail loans (housing, auto, etc.) and floating rate loans to Micro and Small Enterprises.',
      'Spread over the external benchmark (e.g. Repo Rate) can only be altered if borrower credit assessment undergoes a substantial change as pre-agreed in contract.',
    ],
    summary:
      'Floating-rate retail loans must be benchmarked to an external rate. The credit risk spread contracted at inception cannot be altered arbitrarily during the tenure.',
    guidanceText:
      'Under RBI Circular DBR.Dir.BC.No.14/13.03.00/2019-20, banks must link floating retail loans to an external benchmark with a clear spread breakdown. Review any variance in benchmark spread between your sanction letter and loan agreement.',
    verificationNotice:
      'Applicability Caveat: Verify the external benchmark publication date and spread schedule specified in your sanction terms. Benchmark resets occur periodically as per agreed reset cycles. A discrepancy alone does not prove regulatory violation.',
  },
};
