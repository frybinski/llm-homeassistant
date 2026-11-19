/** The subset of Home Assistant's `hass` object that the panel uses. */
export interface HomeAssistant {
  language: string;
  locale: { language: string };
  /** False while the WebSocket connection to Home Assistant is lost. */
  connected?: boolean;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
  callWS<T>(msg: { type: string; [key: string]: unknown }): Promise<T>;
}

export interface PanelInfo {
  config: Record<string, unknown> | null;
}

export interface Route {
  path: string;
  prefix: string;
}

/** Result of the `ai_drafts/info` WebSocket command. */
export interface AIDraftsInfo {
  version: string;
  /** Hash of the bundle the backend currently serves (the `v` of its URL). */
  bundle_hash: string;
  model_source: "ai_task" | "openai_compatible" | null;
  model: string | null;
}

/** One entry of the model selector. `id` null is the preferred AI Task entity. */
export interface ModelOption {
  id: string | null;
  label: string;
}

/** Result of the `ai_drafts/models` WebSocket command. */
export interface AIDraftsModels {
  model_source: "ai_task" | "openai_compatible" | null;
  /** The configured model (server source) or entity (AI Task source); null is the preferred entity. */
  default: string | null;
  models: ModelOption[];
  /** Why the list is incomplete, or null. */
  error: string | null;
}
