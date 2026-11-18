/** The subset of Home Assistant's `hass` object that the panel uses. */
export interface HomeAssistant {
  language: string;
  locale: { language: string };
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
  model_source: "ai_task" | "openai_compatible" | null;
  model: string | null;
}
