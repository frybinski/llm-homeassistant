/**
 * Lines of the YAML preview, each marked as an addition, a removal or context.
 *
 * Milestone M1 only creates automations, so every line is an addition. A real
 * line diff replaces `diffLines` later; the view only reads `DiffLine[]`.
 */
import type { Operation } from "../model";
import { toYaml } from "./yaml";

export type DiffKind = "add" | "remove" | "context";

export interface DiffLine {
  kind: DiffKind;
  text: string;
}

/** Diff of two YAML texts. `null` means the object does not exist on that side. */
export function diffLines(before: string | null, after: string | null): DiffLine[] {
  // Placeholder for a real diff: with a `before` side, show it removed, then
  // the `after` side added. For a create, `before` is null and this is exact.
  const side = (text: string | null, kind: DiffKind): DiffLine[] =>
    text === null ? [] : text.split("\n").map((line) => ({ kind, text: line }));
  return [...side(before, "remove"), ...side(after, "add")];
}

/** The preview of one operation. */
export function operationDiff(op: Operation): DiffLine[] {
  return diffLines(op.before ? toYaml(op.before) : null, op.after ? toYaml(op.after) : null);
}
