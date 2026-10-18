/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtractedLoanDocument, LoanDocumentType } from '../types/loan';
import { DEMO_SCENARIO_CLEAN, DEMO_SCENARIO_DISCREPANCY } from '../data/demoData';

export interface LoanSlotState {
  kfsDoc: ExtractedLoanDocument | null;
  sanctionDoc: ExtractedLoanDocument | null;
  agreementDoc: ExtractedLoanDocument | null;
  activeScenarioId?: string | null;
}

/**
 * Pure state transition function that loads a single synthetic sample document into the designated slot.
 *
 * Guarantees:
 * 1. Strict Isolation: If any real documents exist in any slot, all real documents are purged to guarantee
 *    that real uploaded documents are never cross-compared against synthetic demo documents.
 * 2. Scenario Consistency: Automatically determines the active scenario (Pooja Iyer for clean vs.
 *    Vikramaditya Sharma for discrepancy) from existing demo documents or activeScenarioId.
 * 3. Incompatible Scenario Protection: Purges any existing demo documents belonging to a conflicting scenario,
 *    preventing accidental combination of incompatible synthetic loan profiles.
 */
export function loadSingleSampleDocument(
  state: LoanSlotState,
  docType: LoanDocumentType
): LoanSlotState {
  // 1. Purge all real documents across all slots to enforce data isolation
  let kfsDoc = state.kfsDoc && !state.kfsDoc.isDemo ? null : state.kfsDoc;
  let sanctionDoc = state.sanctionDoc && !state.sanctionDoc.isDemo ? null : state.sanctionDoc;
  let agreementDoc = state.agreementDoc && !state.agreementDoc.isDemo ? null : state.agreementDoc;

  // 2. Identify target demo scenario:
  // If activeScenarioId is explicitly set, prioritize it; otherwise infer from existing demo docs.
  let isCleanScenario = false;
  if (state.activeScenarioId) {
    isCleanScenario = state.activeScenarioId === 'personal_loan_clean';
  } else {
    isCleanScenario = [kfsDoc, sanctionDoc, agreementDoc].some(
      (d) => d?.isDemo && d.borrowerName?.includes('Pooja Iyer')
    );
  }

  const scenario = isCleanScenario ? DEMO_SCENARIO_CLEAN : DEMO_SCENARIO_DISCREPANCY;

  // 3. Purge any conflicting demo documents from the opposing scenario
  const isConflicting = (d: ExtractedLoanDocument | null) => {
    if (!d || !d.isDemo) return false;
    const isPooja = Boolean(d.borrowerName?.includes('Pooja Iyer'));
    return isCleanScenario ? !isPooja : isPooja;
  };

  if (isConflicting(kfsDoc)) kfsDoc = null;
  if (isConflicting(sanctionDoc)) sanctionDoc = null;
  if (isConflicting(agreementDoc)) agreementDoc = null;

  // 4. Populate target slot with the requested demo document
  if (docType === 'kfs') kfsDoc = scenario.kfsDoc;
  else if (docType === 'sanction_letter') sanctionDoc = scenario.sanctionDoc;
  else if (docType === 'loan_agreement') agreementDoc = scenario.agreementDoc;

  return {
    kfsDoc,
    sanctionDoc,
    agreementDoc,
    activeScenarioId: scenario.id,
  };
}

/**
 * Resets all document slots and active scenario ID to clean initial state.
 */
export function resetAllLoanState(): LoanSlotState {
  return {
    kfsDoc: null,
    sanctionDoc: null,
    agreementDoc: null,
    activeScenarioId: null,
  };
}

/**
 * Updates a document slot with a newly uploaded or extracted document.
 * If a real document is added, all existing demo documents are purged.
 */
export function setDocumentSlot(
  state: LoanSlotState,
  docType: LoanDocumentType,
  doc: ExtractedLoanDocument | null
): LoanSlotState {
  let { kfsDoc, sanctionDoc, agreementDoc, activeScenarioId } = state;

  // If a real document is being added, clear all demo documents and activeScenarioId
  if (doc && !doc.isDemo) {
    activeScenarioId = null;
    if (kfsDoc?.isDemo) kfsDoc = null;
    if (sanctionDoc?.isDemo) sanctionDoc = null;
    if (agreementDoc?.isDemo) agreementDoc = null;
  }

  if (docType === 'kfs') kfsDoc = doc;
  else if (docType === 'sanction_letter') sanctionDoc = doc;
  else if (docType === 'loan_agreement') agreementDoc = doc;

  return {
    kfsDoc,
    sanctionDoc,
    agreementDoc,
    activeScenarioId,
  };
}
