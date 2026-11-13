import { id } from "ethers";
import { CONSENT_SCOPE_LABEL, PLAN_RECORD_LABEL } from "./constants.js";

export function planRecordType(): string {
  return id(PLAN_RECORD_LABEL);
}

export function consentScope(): string {
  return id(CONSENT_SCOPE_LABEL);
}
