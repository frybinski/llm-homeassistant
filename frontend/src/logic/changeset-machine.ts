/**
 * Mirror of the state machine in `changeset.py`, for the showcase only. It
 * changes the status locally and keeps to the same table, so the demo cannot
 * do what the real thing would refuse.
 */
import type { ChangeSet, ChangeSetStatus } from "../model";

export type Action = "apply" | "discard" | "revert";

// Keep in step with ALLOWED_TRANSITIONS in custom_components/ai_drafts/changeset.py.
const ALLOWED: Record<ChangeSetStatus, ChangeSetStatus[]> = {
  draft: ["checked", "failed", "discarded"],
  checked: ["applied", "discarded"],
  failed: ["discarded"],
  applied: ["reverted"],
  reverted: [],
  discarded: [],
};

const TARGET: Record<Action, ChangeSetStatus> = {
  apply: "applied",
  discard: "discarded",
  revert: "reverted",
};

export function hasErrors(cs: ChangeSet): boolean {
  return cs.findings.some((f) => f.severity === "error");
}

export function canDo(cs: ChangeSet, action: Action): boolean {
  if (!ALLOWED[cs.status].includes(TARGET[action])) return false;
  // Like `ChangeSet.apply`: error findings block applying.
  return !(action === "apply" && hasErrors(cs));
}

/** Return the change set after the action; throws if it is not allowed. */
export function perform(cs: ChangeSet, action: Action): ChangeSet {
  if (!canDo(cs, action)) {
    throw new Error(`cannot ${action} a change set in status '${cs.status}'`);
  }
  // `decided` is set by apply and discard and kept by revert, as in Python.
  const decided = action === "revert" ? cs.decided : new Date().toISOString();
  return { ...cs, status: TARGET[action], decided };
}
