/**
 * What the panel offers for a status. The backend decides what is allowed
 * (`ALLOWED_TRANSITIONS` in `changeset.py`) and refuses the rest; this only
 * keeps the buttons in line with it. It never changes a status.
 */
import type { ChangeSetStatus } from "../model";

export type Decision = "apply" | "discard" | "revert";

const OFFERED: Record<ChangeSetStatus, Decision[]> = {
  draft: ["discard"],
  checked: ["apply", "discard"],
  failed: ["discard"],
  applied: ["revert"],
  reverted: [],
  discarded: [],
};

export function offeredDecisions(status: ChangeSetStatus): Decision[] {
  return OFFERED[status];
}
