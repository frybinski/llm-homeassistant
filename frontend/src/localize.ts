const EN = {
  title: "AI Drafts",
  version: "Version",
  modelSource: "Model source",
  model: "Model",
  sourceAiTask: "Home Assistant AI Task",
  sourceOpenai: "OpenAI-compatible server",
  preferredAiTask: "preferred AI Task entity",
  loading: "Loading…",
  error: "Could not load AI Drafts information.",
  retry: "Retry",

  // Demo marking
  demoTitle: "Example data",
  demoText:
    "This view shows fixed example data. No model is called and nothing is written to Home Assistant.",

  // Tabs
  tabRequest: "Request and history",
  tabProposal: "Proposal and findings",
  tabDomain: "Domain view",
  tabInventory: "Inventory",

  // Request view
  requestHeading: "New request",
  requestLabel: "What should Home Assistant do?",
  requestPlaceholder: "Describe the automation in your own words",
  useExample: "Use the example request",
  createDraft: "Create draft",
  createHint:
    "In the showcase, creating a draft always opens the prepared proposal.",
  historyHeading: "History",
  historyEmpty: "No proposals yet.",
  openProposal: "Open",
  roundsLabel: (n: number) => `${n} repair ${n === 1 ? "round" : "rounds"}`,
  statusDraft: "Draft",
  statusChecked: "Checked",
  statusFailed: "Failed",
  statusApplied: "Applied",
  statusReverted: "Reverted",
  statusDiscarded: "Discarded",

  // Proposal view
  noProposal: "There is no proposal yet. Create a draft from a request first.",
  toRequest: "To the request",
  proposalHeading: "Proposal",
  summaryHeading: "What the proposal does",
  creates: "Creates the automation",
  trigger: "Trigger",
  condition: "Condition",
  effect: "Effect",
  room: "Room",
  rooms: "Rooms",
  none: "none",
  modeLabel: "Mode",
  modeRestart: "restart: a new trigger starts the run again",
  modeSingle: "single: a running run is not interrupted",
  after: (d: string) => `after ${d}`,
  findingsHeading: "Findings",
  noFindings: "No findings.",
  severityError: "Error",
  severityWarning: "Warning",
  severityInfo: "Note",
  showInDomain: "Show in domain view",
  yamlSummary: "Automation as YAML",
  yamlNote: "Secondary view for checking. Display only, nothing is written.",
  apply: "Apply",
  discard: "Discard",
  revert: "Revert",
  blockedByErrors: "Error findings block applying.",
  stateApplied:
    "Applied in the showcase. The automation now appears in the inventory. Nothing was written to Home Assistant.",
  stateReverted: "Reverted. The automation is gone from the inventory again.",
  stateDiscarded: "Discarded.",
  stateFailed: "This proposal failed and cannot be applied.",
  decidedAt: (d: string) => `Decided ${d}`,

  // Domain view
  viewHouse: "House",
  viewNet: "Net",
  viewMode: "Representation",
  noRoom: "No room",
  proposalBadge: "Proposal",
  marksActive: "Elements named by the finding are marked.",
  focusActive: (alias: string) => `Focus: ${alias}`,
  clear: "Clear",
  legendHeading: "Legend",
  legendExisting: "Existing automation",
  legendProposal: "Proposal",
  legendMarked: "Named by a finding",
  legendCondition: "Condition",
  legendPlaceState: "State place",
  legendPlaceControl: "Control place",
  legendTransition: "Transition",
  legendRead: "reads",
  legendConsume: "consumes",
  legendProduce: "produces",
  netHeading: "Underlying net (format version 0, provisional)",
  netHint:
    "One diagram per automation. State places that several automations use are repeated in each diagram.",
  annotationMode: "mode",
  annotationDelay: "delay",
  annotationEvent: "event",
  annotationGuard: "guard",
  houseLabel: "Diagram of the house with rooms, devices and automations",
  netLabel: (alias: string) => `Net of the automation ${alias}`,

  // Inventory
  inventoryHeading: "Existing automations",
  inventoryEmpty: "No automations.",
  newBadge: "New",
  showInDomainView: "Show in domain view",
  dependenciesHeading: "Dependencies",
  noDependencies: "No dependencies on other automations.",
  writesFor: (state: string, other: string, role: string) =>
    `Writes “${state}”, which “${other}” uses as ${role}.`,
  readsFrom: (state: string, other: string, role: string) =>
    `Uses “${state}” as ${role}, written by “${other}”.`,
  roleTrigger: "trigger",
  roleCondition: "condition",
  summaryArrow: "→",

  // Units for delays
  unitHour: ["hour", "hours"] as [string, string],
  unitMinute: ["minute", "minutes"] as [string, string],
  unitSecond: ["second", "seconds"] as [string, string],
};

export type Strings = typeof EN;

const DE: Strings = {
  title: "AI Drafts",
  version: "Version",
  modelSource: "Modellquelle",
  model: "Modell",
  sourceAiTask: "Home-Assistant-AI-Task",
  sourceOpenai: "OpenAI-kompatibler Server",
  preferredAiTask: "bevorzugte AI-Task-Entität",
  loading: "Lädt…",
  error: "Die Informationen zu AI Drafts konnten nicht geladen werden.",
  retry: "Erneut versuchen",

  demoTitle: "Beispieldaten",
  demoText:
    "Diese Ansicht zeigt feste Beispieldaten. Es wird kein Modell aufgerufen und nichts in Home Assistant geschrieben.",

  tabRequest: "Anfrage und Verlauf",
  tabProposal: "Vorschlag und Befunde",
  tabDomain: "Domänenansicht",
  tabInventory: "Bestand",

  requestHeading: "Neue Anfrage",
  requestLabel: "Was soll Home Assistant tun?",
  requestPlaceholder: "Beschreibe die Automation in eigenen Worten",
  useExample: "Beispielanfrage übernehmen",
  createDraft: "Entwurf erstellen",
  createHint:
    "Im Schaukasten öffnet „Entwurf erstellen“ immer den vorbereiteten Vorschlag.",
  historyHeading: "Verlauf",
  historyEmpty: "Noch keine Vorschläge.",
  openProposal: "Öffnen",
  roundsLabel: (n: number) => `${n} ${n === 1 ? "Reparaturrunde" : "Reparaturrunden"}`,
  statusDraft: "Entwurf",
  statusChecked: "Geprüft",
  statusFailed: "Fehlgeschlagen",
  statusApplied: "Übernommen",
  statusReverted: "Rückgängig gemacht",
  statusDiscarded: "Verworfen",

  noProposal:
    "Es gibt noch keinen Vorschlag. Erstelle zuerst einen Entwurf aus einer Anfrage.",
  toRequest: "Zur Anfrage",
  proposalHeading: "Vorschlag",
  summaryHeading: "Was der Vorschlag tut",
  creates: "Legt die Automation an",
  trigger: "Auslöser",
  condition: "Bedingung",
  effect: "Wirkung",
  room: "Raum",
  rooms: "Räume",
  none: "keine",
  modeLabel: "Modus",
  modeRestart: "restart: ein neuer Auslöser startet den Ablauf neu",
  modeSingle: "single: ein laufender Ablauf wird nicht unterbrochen",
  after: (d: string) => `nach ${d}`,
  findingsHeading: "Befunde",
  noFindings: "Keine Befunde.",
  severityError: "Fehler",
  severityWarning: "Warnung",
  severityInfo: "Hinweis",
  showInDomain: "In der Domänenansicht zeigen",
  yamlSummary: "Automation als YAML",
  yamlNote: "Zweite Ansicht zur Kontrolle. Nur Anzeige, es wird nichts geschrieben.",
  apply: "Übernehmen",
  discard: "Verwerfen",
  revert: "Rückgängig",
  blockedByErrors: "Fehler-Befunde sperren das Übernehmen.",
  stateApplied:
    "Im Schaukasten übernommen. Die Automation erscheint jetzt im Bestand. Es wurde nichts in Home Assistant geschrieben.",
  stateReverted: "Rückgängig gemacht. Die Automation ist wieder aus dem Bestand verschwunden.",
  stateDiscarded: "Verworfen.",
  stateFailed: "Dieser Vorschlag ist fehlgeschlagen und lässt sich nicht übernehmen.",
  decidedAt: (d: string) => `Entschieden ${d}`,

  viewHouse: "Haus",
  viewNet: "Netz",
  viewMode: "Darstellung",
  noRoom: "Ohne Raum",
  proposalBadge: "Vorschlag",
  marksActive: "Die vom Befund genannten Elemente sind markiert.",
  focusActive: (alias: string) => `Fokus: ${alias}`,
  clear: "Aufheben",
  legendHeading: "Legende",
  legendExisting: "Bestehende Automation",
  legendProposal: "Vorschlag",
  legendMarked: "Vom Befund genannt",
  legendCondition: "Bedingung",
  legendPlaceState: "Zustandsstelle",
  legendPlaceControl: "Kontrollstelle",
  legendTransition: "Transition",
  legendRead: "liest",
  legendConsume: "verbraucht",
  legendProduce: "erzeugt",
  netHeading: "Zugrunde liegendes Netz (Format Version 0, vorläufig)",
  netHint:
    "Ein Diagramm je Automation. Zustandsstellen, die mehrere Automationen nutzen, stehen in jedem Diagramm.",
  annotationMode: "Modus",
  annotationDelay: "Wartezeit",
  annotationEvent: "Ereignis",
  annotationGuard: "Wächter",
  houseLabel: "Diagramm des Hauses mit Räumen, Geräten und Automationen",
  netLabel: (alias: string) => `Netz der Automation ${alias}`,

  inventoryHeading: "Bestehende Automationen",
  inventoryEmpty: "Keine Automationen.",
  newBadge: "Neu",
  showInDomainView: "In der Domänenansicht zeigen",
  dependenciesHeading: "Abhängigkeiten",
  noDependencies: "Keine Abhängigkeiten zu anderen Automationen.",
  writesFor: (state: string, other: string, role: string) =>
    `Schreibt „${state}“, das „${other}“ als ${role} nutzt.`,
  readsFrom: (state: string, other: string, role: string) =>
    `Nutzt „${state}“ als ${role}, geschrieben von „${other}“.`,
  roleTrigger: "Auslöser",
  roleCondition: "Bedingung",
  summaryArrow: "→",

  unitHour: ["Stunde", "Stunden"],
  unitMinute: ["Minute", "Minuten"],
  unitSecond: ["Sekunde", "Sekunden"],
};

/** Pick the dictionary for a Home Assistant language code; English is the fallback. */
export function getStrings(language: string | undefined): Strings {
  return language?.toLowerCase().startsWith("de") ? DE : EN;
}

export function statusLabel(t: Strings, status: string): string {
  const labels: Record<string, string> = {
    draft: t.statusDraft,
    checked: t.statusChecked,
    failed: t.statusFailed,
    applied: t.statusApplied,
    reverted: t.statusReverted,
    discarded: t.statusDiscarded,
  };
  return labels[status] ?? status;
}

/** Entity states of the example data, shown next to the entity. */
export function stateLabel(language: string | undefined, state: string): string {
  const de = language?.toLowerCase().startsWith("de");
  const labels: Record<string, [string, string]> = {
    on: ["on", "an"],
    off: ["off", "aus"],
    playing: ["playing", "läuft"],
    above_horizon: ["above horizon", "über dem Horizont"],
    below_horizon: ["below horizon", "unter dem Horizont"],
  };
  return labels[state]?.[de ? 1 : 0] ?? state;
}
