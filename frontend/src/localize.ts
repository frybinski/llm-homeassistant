const EN = {
  title: "Blaupause",
  version: "Version",
  modelSource: "Model source",
  model: "Model",
  sourceAiTask: "Home Assistant AI Task",
  sourceOpenai: "OpenAI-compatible server",
  preferredAiTask: "preferred AI Task entity",
  empty: "No proposals yet.",
  loading: "Loading…",
  error: "Could not load Blaupause information.",
  retry: "Retry",
};

export type Strings = typeof EN;

const DE: Strings = {
  title: "Blaupause",
  version: "Version",
  modelSource: "Modellquelle",
  model: "Modell",
  sourceAiTask: "Home-Assistant-AI-Task",
  sourceOpenai: "OpenAI-kompatibler Server",
  preferredAiTask: "bevorzugte AI-Task-Entität",
  empty: "Noch keine Vorschläge.",
  loading: "Lädt…",
  error: "Blaupause-Informationen konnten nicht geladen werden.",
  retry: "Erneut versuchen",
};

/** Pick the dictionary for a Home Assistant language code; English is the fallback. */
export function getStrings(language: string | undefined): Strings {
  return language?.toLowerCase().startsWith("de") ? DE : EN;
}
