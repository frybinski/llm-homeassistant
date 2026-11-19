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

  // Demo marking (domain view and inventory only)
  demoTitle: "Example data",
  demoText:
    "This view shows fixed example data, not your house. It reads nothing from Home Assistant and writes nothing.",

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
  drafting: "Creating draft…",
  draftingNote:
    "The model is working. With a real model this can take up to a minute. Please keep this page open.",
  historyHeading: "History",
  historyEmpty: "No proposals yet.",
  historyLoading: "Loading history…",
  historyError: "The history could not be loaded.",
  historyOpenHint: "Click an entry to open it in the proposal view.",
  modelLabel: "Model for this draft",
  modelDefaultMark: "default",
  modelPreferred: "Home Assistant's preferred AI Task entity",
  modelsLoading: "Loading models…",
  modelsError: "The models could not be loaded.",
  modelsUnavailable: "The model list is not available",
  modelNote:
    "Applies to the drafts you create from now on, as long as this page is open. The default is set in the integration settings (Reconfigure).",
  historyModel: "Model",
  currentBadge: "Open",
  roundsLabel: (n: number) => `${n} repair ${n === 1 ? "round" : "rounds"}`,
  statusDraft: "Draft",
  statusChecked: "Checked",
  statusFailed: "Failed",
  statusApplied: "Applied",
  statusReverted: "Reverted",
  statusDiscarded: "Discarded",

  // Errors of backend commands
  errorCode: "Error code",
  errBusy: "Another draft is still running. Try again when it has finished.",
  errModel:
    "The model could not be reached or gave no usable answer. The failed proposal is stored and appears in the history.",
  errInvalidModel: "The chosen model cannot be used with the configured model source.",
  errNotLoaded:
    "AI Drafts is not set up. Add the integration under Settings, Devices and services.",
  errUnknown: "Something unexpected went wrong.",
  errApplyBlocked: "Applying is blocked: the proposal has error findings.",
  errApplyFailed: "Applying failed.",
  errRevertRefused: "Reverting was refused. Nothing was changed.",
  errWrongState:
    "That is not possible in the current status. The view now shows the current status.",
  errNotFound: "This proposal no longer exists.",

  // Proposal view
  noProposal:
    "No proposal is open. Create a draft from a request, or open an entry from the history.",
  toRequest: "To the request",
  proposalHeading: "Proposal",
  metaModel: "Model",
  metaRounds: "Repair rounds",
  metaCreated: "Created",
  metaDecided: "Decided",
  modelUnknown: "unknown",
  partsLabel: "Representation",
  partDescription: "In words",
  partYaml: "YAML",
  automationHeading: (alias: string) => `Automation “${alias}”`,
  automationUnnamed: "Automation without a name",
  triggersHeading: "Triggers",
  conditionsHeading: "Conditions",
  actionsHeading: "Actions",
  none: "none",
  modeLabel: "Mode",
  modeRestart: "restart: a new trigger starts the run again",
  modeSingle: "single: a running run is not interrupted",
  otherFieldsHeading: "Further fields",
  operationOther: (op: string, kind: string) => `Operation “${op}” on “${kind}” (not described)`,
  yamlNote:
    "Every line is an addition: this proposal creates a new automation and changes nothing that exists.",
  findingsHeading: "Findings",
  noFindings: "No findings.",
  severityError: "Error",
  severityWarning: "Warning",
  severityInfo: "Note",
  pathLabel: "Path",
  showInDomain: "Show in domain view",
  failedTitle: "This proposal cannot be applied",
  failedText: (rounds: number, errors: number) =>
    `The check still found ${errors} ${errors === 1 ? "error" : "errors"} after ${rounds} repair ${rounds === 1 ? "round" : "rounds"}, or the model gave no usable answer. The errors are listed under Findings.`,
  draftNote:
    "This draft was not checked to the end. It cannot be applied, only discarded.",
  decisionHeading: "Decision",
  apply: "Apply",
  discard: "Discard",
  revert: "Revert",
  applying: "Applying…",
  discarding: "Discarding…",
  reverting: "Reverting…",
  applyEffect:
    "Apply writes the automation into automations.yaml and loads it in Home Assistant.",
  revertEffect:
    "Revert takes the automation out of automations.yaml again, unless it was edited by hand since.",
  stateApplied: "Applied: the automation is now in automations.yaml and loaded.",
  stateReverted: "Reverted: the automation was taken out of automations.yaml again.",
  stateDiscarded: "Discarded. Nothing was written.",
  createdAutomation: "Created automation",
  automationId: "ID",
  openInEditor: "Open in the Home Assistant editor",

  // Description of automations
  quote: (s: string) => `“${s}”`,
  clock: (time: string) => time,
  sunrise: "sunrise",
  sunset: "sunset",
  triggerFor: (d: string) => ` and stays so for ${d}`,
  conditionFor: (d: string) => ` for at least ${d}`,
  changes: (who: string) => `${who} changes`,
  changesTo: (who: string, to: string) => `${who} changes to ${to}`,
  changesFrom: (who: string, from: string) => `${who} changes from ${from}`,
  changesFromTo: (who: string, from: string, to: string) =>
    `${who} changes from ${from} to ${to}`,
  timeAt: (time: string) => `at ${time}`,
  timeAtEntity: (name: string) => `at the time set by ${name}`,
  sunTrigger: (event: string, offset: string, before: boolean) =>
    offset === "" ? `at ${event}` : `${offset} ${before ? "before" : "after"} ${event}`,
  triggerNumeric: (who: string, above: string | null, below: string | null) =>
    above !== null && below !== null
      ? `${who} enters the range between ${above} and ${below}`
      : above !== null
        ? `${who} rises above ${above}`
        : `${who} drops below ${below}`,
  isState: (who: string, states: string) => `${who} is ${states}`,
  conditionNumeric: (who: string, above: string | null, below: string | null) =>
    above !== null && below !== null
      ? `${who} is between ${above} and ${below}`
      : above !== null
        ? `${who} is above ${above}`
        : `${who} is below ${below}`,
  sunCondition: (kind: "after" | "before", event: string, offset: string, before: boolean) =>
    offset === ""
      ? `${kind} ${event}`
      : `${kind === "after" ? "from" : "until"} ${offset} ${before ? "before" : "after"} ${event}`,
  timeCondition: (kind: "after" | "before", time: string) => `${kind} ${time}`,
  timeConditionEntity: (kind: "after" | "before", name: string) =>
    `${kind} the time set by ${name}`,
  onWeekdays: (days: string) => `on ${days}`,
  turnOn: (who: string) => `Turns on ${who}`,
  turnOff: (who: string) => `Turns off ${who}`,
  toggle: (who: string) => `Toggles ${who}`,
  callOn: (service: string, who: string) => `Calls ${service} on ${who}`,
  call: (service: string) => `Calls ${service}`,
  waits: (d: string) => `Waits ${d}`,
  unknownTrigger: "Trigger (not described)",
  unknownTriggerOf: (type: string) => `Trigger of type “${type}” (not described)`,
  unknownCondition: "Condition (not described)",
  unknownConditionOf: (type: string) => `Condition of type “${type}” (not described)`,
  unknownAction: "Step (not described)",
  unknownActionOf: (type: string) => `Step “${type}” (not described)`,
  fragmentYaml: "YAML fragment",
  fragmentTarget: "Further target fields",
  fragmentData: "Data",

  // Domain view
  viewHouse: "House",
  viewNet: "Net",
  viewMode: "Representation",
  noRoom: "No room",
  proposalBadge: "Proposal",
  markExample: "Mark the elements of the example finding",
  marksActive: "The elements named by the example finding are marked.",
  focusActive: (alias: string) => `Focus: ${alias}`,
  clear: "Clear",
  legendHeading: "Legend",
  legendExisting: "Existing automation",
  legendProposal: "Example proposal",
  legendMarked: "Named by the example finding",
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
  trigger: "Trigger",
  effect: "Effect",
  condition: "Condition",
  room: "Room",
  rooms: "Rooms",
  after: (d: string) => `after ${d}`,

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
    "Diese Ansicht zeigt feste Beispieldaten, nicht dein Haus. Sie liest nichts aus Home Assistant und schreibt nichts.",

  tabRequest: "Anfrage und Verlauf",
  tabProposal: "Vorschlag und Befunde",
  tabDomain: "Domänenansicht",
  tabInventory: "Bestand",

  requestHeading: "Neue Anfrage",
  requestLabel: "Was soll Home Assistant tun?",
  requestPlaceholder: "Beschreibe die Automation in eigenen Worten",
  useExample: "Beispielanfrage übernehmen",
  createDraft: "Entwurf erstellen",
  drafting: "Entwurf wird erstellt…",
  draftingNote:
    "Das Modell arbeitet. Mit einem echten Modell kann das bis zu eine Minute dauern. Bitte lass diese Seite offen.",
  historyHeading: "Verlauf",
  historyEmpty: "Noch keine Vorschläge.",
  historyLoading: "Verlauf lädt…",
  historyError: "Der Verlauf konnte nicht geladen werden.",
  historyOpenHint: "Ein Klick auf einen Eintrag öffnet ihn in der Ansicht „Vorschlag und Befunde“.",
  modelLabel: "Modell für diesen Entwurf",
  modelDefaultMark: "Standard",
  modelPreferred: "Bevorzugte AI-Task-Entität von Home Assistant",
  modelsLoading: "Modelle werden geladen…",
  modelsError: "Die Modelle konnten nicht geladen werden.",
  modelsUnavailable: "Die Modellliste ist nicht verfügbar",
  modelNote:
    "Gilt für die Entwürfe, die du ab jetzt erstellst, solange diese Seite geöffnet ist. Der Standard wird in den Einstellungen der Integration festgelegt (Neu konfigurieren).",
  historyModel: "Modell",
  currentBadge: "Geöffnet",
  roundsLabel: (n: number) => `${n} ${n === 1 ? "Reparaturrunde" : "Reparaturrunden"}`,
  statusDraft: "Entwurf",
  statusChecked: "Geprüft",
  statusFailed: "Fehlgeschlagen",
  statusApplied: "Übernommen",
  statusReverted: "Rückgängig gemacht",
  statusDiscarded: "Verworfen",

  errorCode: "Fehlercode",
  errBusy: "Es läuft noch ein anderer Entwurf. Versuche es erneut, wenn er fertig ist.",
  errModel:
    "Das Modell war nicht erreichbar oder hat keine brauchbare Antwort geliefert. Der fehlgeschlagene Vorschlag ist gespeichert und steht im Verlauf.",
  errInvalidModel:
    "Das gewählte Modell passt nicht zur eingestellten Modellquelle.",
  errNotLoaded:
    "AI Drafts ist nicht eingerichtet. Füge die Integration unter Einstellungen, Geräte und Dienste hinzu.",
  errUnknown: "Es ist etwas Unerwartetes schiefgegangen.",
  errApplyBlocked: "Übernehmen ist gesperrt: Der Vorschlag hat Fehler-Befunde.",
  errApplyFailed: "Das Übernehmen ist fehlgeschlagen.",
  errRevertRefused: "Rückgängig wurde abgelehnt. Es wurde nichts geändert.",
  errWrongState:
    "Das ist im aktuellen Status nicht möglich. Die Ansicht zeigt jetzt den aktuellen Status.",
  errNotFound: "Diesen Vorschlag gibt es nicht mehr.",

  noProposal:
    "Es ist kein Vorschlag geöffnet. Erstelle einen Entwurf aus einer Anfrage oder öffne einen Eintrag aus dem Verlauf.",
  toRequest: "Zur Anfrage",
  proposalHeading: "Vorschlag",
  metaModel: "Modell",
  metaRounds: "Reparaturrunden",
  metaCreated: "Erstellt",
  metaDecided: "Entschieden",
  modelUnknown: "unbekannt",
  partsLabel: "Darstellung",
  partDescription: "In Worten",
  partYaml: "YAML",
  automationHeading: (alias: string) => `Automation „${alias}“`,
  automationUnnamed: "Automation ohne Namen",
  triggersHeading: "Auslöser",
  conditionsHeading: "Bedingungen",
  actionsHeading: "Aktionen",
  none: "keine",
  modeLabel: "Modus",
  modeRestart: "restart: ein neuer Auslöser startet den Ablauf neu",
  modeSingle: "single: ein laufender Ablauf wird nicht unterbrochen",
  otherFieldsHeading: "Weitere Felder",
  operationOther: (op: string, kind: string) => `Vorgang „${op}“ auf „${kind}“ (nicht beschrieben)`,
  yamlNote:
    "Jede Zeile ist eine Ergänzung: Dieser Vorschlag legt eine neue Automation an und ändert nichts Bestehendes.",
  findingsHeading: "Befunde",
  noFindings: "Keine Befunde.",
  severityError: "Fehler",
  severityWarning: "Warnung",
  severityInfo: "Hinweis",
  pathLabel: "Pfad",
  showInDomain: "In der Domänenansicht zeigen",
  failedTitle: "Dieser Vorschlag lässt sich nicht übernehmen",
  failedText: (rounds: number, errors: number) =>
    `Die Prüfung hat nach ${rounds} ${rounds === 1 ? "Reparaturrunde" : "Reparaturrunden"} noch ${errors} Fehler gefunden, oder das Modell hat keine brauchbare Antwort geliefert. Die Fehler stehen unter „Befunde“.`,
  draftNote:
    "Dieser Entwurf wurde nicht zu Ende geprüft. Er lässt sich nicht übernehmen, nur verwerfen.",
  decisionHeading: "Entscheidung",
  apply: "Übernehmen",
  discard: "Verwerfen",
  revert: "Rückgängig",
  applying: "Wird übernommen…",
  discarding: "Wird verworfen…",
  reverting: "Wird rückgängig gemacht…",
  applyEffect:
    "Übernehmen schreibt die Automation in die Datei automations.yaml und lädt sie in Home Assistant.",
  revertEffect:
    "Rückgängig nimmt die Automation wieder aus automations.yaml, sofern sie seitdem nicht von Hand geändert wurde.",
  stateApplied: "Übernommen: Die Automation steht jetzt in automations.yaml und ist geladen.",
  stateReverted: "Rückgängig gemacht: Die Automation wurde wieder aus automations.yaml genommen.",
  stateDiscarded: "Verworfen. Es wurde nichts geschrieben.",
  createdAutomation: "Angelegte Automation",
  automationId: "ID",
  openInEditor: "Im Editor von Home Assistant öffnen",

  quote: (s: string) => `„${s}“`,
  clock: (time: string) => `${time} Uhr`,
  sunrise: "Sonnenaufgang",
  sunset: "Sonnenuntergang",
  triggerFor: (d: string) => ` und bleibt so für ${d}`,
  conditionFor: (d: string) => ` seit mindestens ${d}`,
  changes: (who: string) => `${who} ändert sich`,
  changesTo: (who: string, to: string) => `${who} wechselt zu ${to}`,
  changesFrom: (who: string, from: string) => `${who} wechselt von ${from}`,
  changesFromTo: (who: string, from: string, to: string) =>
    `${who} wechselt von ${from} zu ${to}`,
  timeAt: (time: string) => `um ${time}`,
  timeAtEntity: (name: string) => `zur Uhrzeit von ${name}`,
  sunTrigger: (event: string, offset: string, before: boolean) =>
    offset === "" ? `bei ${event}` : `${offset} ${before ? "vor" : "nach"} ${event}`,
  triggerNumeric: (who: string, above: string | null, below: string | null) =>
    above !== null && below !== null
      ? `${who} gelangt in den Bereich zwischen ${above} und ${below}`
      : above !== null
        ? `${who} steigt über ${above}`
        : `${who} fällt unter ${below}`,
  isState: (who: string, states: string) => `${who} ist ${states}`,
  conditionNumeric: (who: string, above: string | null, below: string | null) =>
    above !== null && below !== null
      ? `${who} liegt zwischen ${above} und ${below}`
      : above !== null
        ? `${who} liegt über ${above}`
        : `${who} liegt unter ${below}`,
  sunCondition: (kind: "after" | "before", event: string, offset: string, before: boolean) =>
    offset === ""
      ? `${kind === "after" ? "nach" : "vor"} ${event}`
      : `${kind === "after" ? "ab" : "bis"} ${offset} ${before ? "vor" : "nach"} ${event}`,
  timeCondition: (kind: "after" | "before", time: string) =>
    `${kind === "after" ? "nach" : "vor"} ${time}`,
  timeConditionEntity: (kind: "after" | "before", name: string) =>
    `${kind === "after" ? "nach" : "vor"} der Uhrzeit von ${name}`,
  onWeekdays: (days: string) => `an ${days}`,
  turnOn: (who: string) => `Schaltet ${who} ein`,
  turnOff: (who: string) => `Schaltet ${who} aus`,
  toggle: (who: string) => `Schaltet ${who} um`,
  callOn: (service: string, who: string) => `Ruft ${service} auf für ${who}`,
  call: (service: string) => `Ruft ${service} auf`,
  waits: (d: string) => `Wartet ${d}`,
  unknownTrigger: "Auslöser (nicht beschrieben)",
  unknownTriggerOf: (type: string) => `Auslöser vom Typ „${type}“ (nicht beschrieben)`,
  unknownCondition: "Bedingung (nicht beschrieben)",
  unknownConditionOf: (type: string) => `Bedingung vom Typ „${type}“ (nicht beschrieben)`,
  unknownAction: "Schritt (nicht beschrieben)",
  unknownActionOf: (type: string) => `Schritt „${type}“ (nicht beschrieben)`,
  fragmentYaml: "YAML-Ausschnitt",
  fragmentTarget: "Weitere Zielangaben",
  fragmentData: "Daten",

  viewHouse: "Haus",
  viewNet: "Netz",
  viewMode: "Darstellung",
  noRoom: "Ohne Raum",
  proposalBadge: "Vorschlag",
  markExample: "Elemente des Beispielbefunds markieren",
  marksActive: "Die vom Beispielbefund genannten Elemente sind markiert.",
  focusActive: (alias: string) => `Fokus: ${alias}`,
  clear: "Aufheben",
  legendHeading: "Legende",
  legendExisting: "Bestehende Automation",
  legendProposal: "Beispielvorschlag",
  legendMarked: "Vom Beispielbefund genannt",
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
  trigger: "Auslöser",
  effect: "Wirkung",
  condition: "Bedingung",
  room: "Raum",
  rooms: "Räume",
  after: (d: string) => `nach ${d}`,

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
