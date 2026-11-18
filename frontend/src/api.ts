/** The WebSocket commands of the backend (PLAN.md section 14), one function each. */
import type { ChangeSet } from "./model";
import type { HomeAssistant } from "./types";
import type { Decision } from "./logic/changeset-actions";

/** An error answer of a command, or any other failure of the call. */
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Home Assistant rejects with `{code, message}`; anything else is "unknown". */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err && typeof err === "object") {
    const { code, message } = err as { code?: unknown; message?: unknown };
    return new ApiError(
      typeof code === "string" || typeof code === "number" ? String(code) : "unknown",
      typeof message === "string" ? message : JSON.stringify(err),
    );
  }
  return new ApiError("unknown", String(err));
}

async function call<T>(hass: HomeAssistant, msg: { type: string; [key: string]: unknown }): Promise<T> {
  try {
    return await hass.callWS<T>(msg);
  } catch (err) {
    throw toApiError(err);
  }
}

export const listChangeSets = (hass: HomeAssistant) =>
  call<ChangeSet[]>(hass, { type: "ai_drafts/changesets/list" });

export const createDraft = (hass: HomeAssistant, request: string) =>
  call<ChangeSet>(hass, { type: "ai_drafts/draft", request });

export interface DecisionContext {
  /** The part of the proposal view that was active at the click. */
  decidedIn: string;
  /** The views and parts visited while the change set was open. */
  viewsOpened: string[];
}

/** Apply, discard or revert. Revert takes no context, the backend does not read it. */
export function decide(
  hass: HomeAssistant,
  decision: Decision,
  changeSetId: string,
  context: DecisionContext,
) {
  const msg: { type: string; [key: string]: unknown } = {
    type: `ai_drafts/changesets/${decision}`,
    change_set_id: changeSetId,
  };
  if (decision !== "revert") {
    msg.decided_in = context.decidedIn;
    msg.views_opened = context.viewsOpened;
  }
  return call<ChangeSet>(hass, msg);
}
