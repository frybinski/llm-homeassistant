import { LitElement, type PropertyValues, css, html, nothing } from "lit";
import { type ApiError, createDraft, decide, listChangeSets, listModels, toApiError } from "./api";
import { AUTOMATIONS, HOUSE, NET_EXISTING, NET_PROPOSAL, PROPOSAL } from "./demo";
import { type Strings, getStrings } from "./localize";
import type { Decision } from "./logic/changeset-actions";
import { describeAutomation } from "./logic/describe";
import {
  type Marks,
  NO_MARKS,
  deriveAutomations,
  deriveDependencies,
  mergeNets,
  resolveMarks,
} from "./logic/net";
import type { ChangeSet } from "./model";
import type { HomeAssistant, PanelInfo, Route } from "./types";
import { type DomainAutomation, type DomainMode } from "./views/domain-view";
import { type InventoryItem } from "./views/inventory";
import { type ProposalPart } from "./views/proposal";
import { type HistoryState, type InfoState, type ModelsState } from "./views/request";
import "./views/domain-view";
import "./views/inventory";
import "./views/proposal";
import "./views/request";

/**
 * The hash this bundle was loaded with: the `v` of its own module URL, which the
 * backend sets to the content hash of the bundle. Null if the URL has none.
 */
function loadedBundleHash(): string | null {
  try {
    return new URL(import.meta.url).searchParams.get("v") || null;
  } catch {
    return null;
  }
}
const LOADED_HASH = loadedBundleHash();

type Tab = "request" | "proposal" | "domain" | "inventory";
const TABS: Tab[] = ["request", "proposal", "domain", "inventory"];

// Domain view and inventory still show the example house (milestone M3).
const NET_FULL = mergeNets(NET_EXISTING, NET_PROPOSAL);
const EXAMPLE_PROPOSAL_ID = String(PROPOSAL.operations[0]?.after?.id ?? "");
const ALIASES = new Map<string, string>([
  ...AUTOMATIONS.map((a): [string, string] => [a.id, a.alias]),
  [EXAMPLE_PROPOSAL_ID, String(PROPOSAL.operations[0]?.after?.alias ?? "")],
]);
const INFOS = deriveAutomations(NET_FULL);
const EXISTING_INFOS = INFOS.filter((i) => i.id !== EXAMPLE_PROPOSAL_ID);
const PLACE_LABELS = new Map(NET_FULL.places.map((p) => [p.id, p.label]));
const EXAMPLE_REFS = PROPOSAL.findings.flatMap((f) => f.net_refs);
const DOMAIN_AUTOMATIONS: DomainAutomation[] = INFOS.map((info) => ({
  info,
  alias: ALIASES.get(info.id) ?? info.id,
  isProposal: info.id === EXAMPLE_PROPOSAL_ID,
}));
const INVENTORY_ITEMS: InventoryItem[] = EXISTING_INFOS.map((info) => ({
  id: info.id,
  alias: ALIASES.get(info.id) ?? info.id,
  mode: info.mode,
  description: describeAutomation(info, HOUSE),
}));
const INVENTORY_DEPENDENCIES = deriveDependencies(EXISTING_INFOS);

class AIDraftsPanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    route: { attribute: false },
    panel: { attribute: false },
    _info: { state: true },
    _latestHash: { state: true },
    _tab: { state: true },
    _history: { state: true },
    _models: { state: true },
    _current: { state: true },
    _part: { state: true },
    _drafting: { state: true },
    _draftError: { state: true },
    _pending: { state: true },
    _decisionError: { state: true },
    _marks: { state: true },
    _focus: { state: true },
    _mode: { state: true },
  };

  declare hass: HomeAssistant;
  declare narrow: boolean;
  declare route: Route;
  declare panel: PanelInfo;
  declare _info: InfoState;
  /** Bundle hash the backend reported last, or null if not known yet. */
  declare _latestHash: string | null;
  declare _tab: Tab;
  declare _history: HistoryState;
  declare _models: ModelsState;
  /** The change set open in the proposal view, as the backend last returned it. */
  declare _current: ChangeSet | null;
  declare _part: ProposalPart;
  declare _drafting: boolean;
  declare _draftError: ApiError | null;
  /** The decision being sent to the backend. */
  declare _pending: Decision | null;
  declare _decisionError: ApiError | null;
  declare _marks: Marks;
  declare _focus: string | null;
  declare _mode: DomainMode;

  private _requested = false;
  private _historySeq = 0;
  private _modelsSeq = 0;
  /** Views and parts visited while the current change set is open. */
  private _viewsOpened: string[] = [];

  constructor() {
    super();
    this._info = { status: "loading" };
    this._latestHash = null;
    this._tab = "request";
    this._history = { status: "loading" };
    this._models = { status: "loading" };
    this._current = null;
    this._part = "description";
    this._drafting = false;
    this._draftError = null;
    this._pending = null;
    this._decisionError = null;
    this._marks = NO_MARKS;
    this._focus = null;
    this._mode = "house";
  }

  protected override willUpdate(changed: PropertyValues): void {
    // The connection came back: Home Assistant may have restarted with an update.
    const before = changed.get("hass") as HomeAssistant | undefined;
    if (this.hass && before?.connected === false && this.hass.connected === true) {
      void this._checkBundle();
    }
    // Load once, as soon as `hass` is available.
    if (this.hass && !this._requested) {
      this._requested = true;
      void this._loadInfo();
      void this._loadHistory();
      void this._loadModels();
    }
  }

  private async _loadInfo(): Promise<void> {
    this._info = { status: "loading" };
    try {
      const info = await this.hass.callWS<
        Extract<InfoState, { status: "ready" }>["info"]
      >({ type: "ai_drafts/info" });
      this._info = { status: "ready", info };
      this._latestHash = info.bundle_hash ?? null;
    } catch (err) {
      this._info = { status: "error", message: toApiError(err).message };
    }
  }

  /** Ask the backend which bundle it serves now. Silent: a failure shows nothing. */
  private async _checkBundle(): Promise<void> {
    try {
      const info = await this.hass.callWS<{ bundle_hash?: string }>({ type: "ai_drafts/info" });
      this._latestHash = info.bundle_hash ?? null;
    } catch {
      // Not connected or not set up: the other views report their own errors.
    }
  }

  /** Reload the model list. A late answer of an older call is dropped. */
  private async _loadModels(): Promise<void> {
    const seq = ++this._modelsSeq;
    try {
      const models = await listModels(this.hass);
      if (seq !== this._modelsSeq) return;
      this._models = { status: "ready", models };
    } catch (err) {
      if (seq !== this._modelsSeq) return;
      this._models = { status: "error", message: toApiError(err).message };
    }
  }

  // --- Change sets ---------------------------------------------------------

  /** Reload the history. A late answer of an older call is dropped. */
  private async _loadHistory(): Promise<void> {
    const seq = ++this._historySeq;
    try {
      const items = await listChangeSets(this.hass);
      if (seq !== this._historySeq) return;
      this._history = { status: "ready", items };
      // Keep the open change set in step with the backend, unless a decision
      // is in flight: its answer is newer than this list.
      if (this._current && this._pending === null) {
        const fresh = items.find((cs) => cs.id === this._current?.id);
        if (fresh) this._current = fresh;
      }
    } catch (err) {
      if (seq !== this._historySeq) return;
      this._history = { status: "error", message: toApiError(err).message };
    }
  }

  private _open(changeSet: ChangeSet): void {
    this._current = changeSet;
    this._part = "description";
    this._viewsOpened = [];
    this._decisionError = null;
    this._go("proposal");
  }

  private _onCreateDraft = async (
    e: CustomEvent<{ request: string; model?: string | null }>,
  ): Promise<void> => {
    if (this._drafting) return;
    this._drafting = true;
    this._draftError = null;
    try {
      const changeSet = await createDraft(this.hass, e.detail.request, e.detail.model);
      this._open(changeSet);
    } catch (err) {
      this._draftError = toApiError(err);
    } finally {
      this._drafting = false;
    }
    // After a model error the failed change set is stored, so reload in any case.
    void this._loadHistory();
  };

  private _onDecide = async (e: CustomEvent<{ decision: Decision }>): Promise<void> => {
    const current = this._current;
    if (!current || this._pending) return;
    this._pending = e.detail.decision;
    this._decisionError = null;
    try {
      // Show exactly what the backend returns, never a status of our own.
      this._current = await decide(this.hass, e.detail.decision, current.id, {
        decidedIn: this._part,
        viewsOpened: this._viewsOpened,
      });
    } catch (err) {
      this._decisionError = toApiError(err);
    } finally {
      this._pending = null;
    }
    // Also after an error: a wrong_state means the list knows better.
    void this._loadHistory();
  };

  // --- Navigation ----------------------------------------------------------

  private _go(tab: Tab): void {
    this._tab = tab;
    this._visit();
    if (tab === "request") {
      void this._checkBundle();
      void this._loadHistory();
      void this._loadModels();
    }
  }

  private _setPart(part: ProposalPart): void {
    this._part = part;
    this._visit();
  }

  /** Record the view that is now active, while a change set is open. */
  private _visit(): void {
    if (!this._current) return;
    const name = this._tab === "proposal" ? `proposal.${this._part}` : this._tab;
    if (!this._viewsOpened.includes(name)) this._viewsOpened = [...this._viewsOpened, name];
  }

  /** True if the backend serves a newer bundle than the one running here. */
  private _outdated(): boolean {
    return LOADED_HASH !== null && this._latestHash !== null && this._latestHash !== LOADED_HASH;
  }

  private _nameOf = (entityId: string): string => {
    const name = this.hass?.states?.[entityId]?.attributes?.friendly_name;
    return typeof name === "string" && name ? name : entityId;
  };

  // --- Rendering -----------------------------------------------------------

  protected override render() {
    const t = getStrings(this.hass?.locale?.language ?? this.hass?.language);
    const language = this.hass?.locale?.language ?? this.hass?.language;
    const labels: Record<Tab, string> = {
      request: t.tabRequest,
      proposal: t.tabProposal,
      domain: t.tabDomain,
      inventory: t.tabInventory,
    };
    return html`
      <div class="header">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">${t.title}</div>
      </div>
      ${this._outdated()
        ? html`<div class="outdated" role="alert">
            <div class="outdated-text">
              <strong>${t.outdatedTitle}</strong>
              <span>${t.outdatedText}</span>
            </div>
            <button type="button" class="outdated-button" @click=${() => location.reload()}>
              ${t.outdatedReload}
            </button>
          </div>`
        : nothing}
      <div class="tabs" role="tablist">
        ${TABS.map(
          (tab) => html`<button
            type="button"
            role="tab"
            id="tab-${tab}"
            aria-selected=${this._tab === tab ? "true" : "false"}
            aria-controls="view-${tab}"
            class=${this._tab === tab ? "active" : ""}
            @click=${() => this._go(tab)}
          >
            ${labels[tab]}
          </button>`,
        )}
      </div>
      <div
        class="content"
        @create-draft=${this._onCreateDraft}
        @open-changeset=${this._onOpenChangeSet}
        @decide=${this._onDecide}
        @set-part=${(e: CustomEvent<{ part: ProposalPart }>) => this._setPart(e.detail.part)}
        @goto-request=${() => this._go("request")}
        @retry-info=${() => void this._loadInfo()}
        @retry-history=${() => void this._loadHistory()}
        @show-finding=${this._onShowFinding}
        @mark-example=${() => (this._marks = resolveMarks(NET_FULL, EXAMPLE_REFS))}
        @focus-automation=${this._onFocusAutomation}
        @clear-marks=${() => (this._marks = NO_MARKS)}
        @clear-focus=${() => (this._focus = null)}
        @set-mode=${(e: CustomEvent<{ mode: DomainMode }>) => (this._mode = e.detail.mode)}
      >
        ${this._renderViews(t, language)}
      </div>
    `;
  }

  private _renderViews(t: Strings, language: string | undefined) {
    return html`
      <div class="view" id="view-request" role="tabpanel" ?hidden=${this._tab !== "request"}>
        <ai-drafts-request
          .t=${t}
          .language=${language}
          .info=${this._info}
          .models=${this._models}
          .history=${this._history}
          .currentId=${this._current?.id ?? null}
          .drafting=${this._drafting}
          .error=${this._draftError}
          .exampleRequest=${PROPOSAL.request}
        ></ai-drafts-request>
      </div>
      <div class="view" id="view-proposal" role="tabpanel" ?hidden=${this._tab !== "proposal"}>
        <ai-drafts-proposal
          .t=${t}
          .language=${language}
          .proposal=${this._current}
          .section=${this._part}
          .nameOf=${this._nameOf}
          .pending=${this._pending}
          .error=${this._decisionError}
        ></ai-drafts-proposal>
      </div>
      <div class="view wide" id="view-domain" role="tabpanel" ?hidden=${this._tab !== "domain"}>
        <ai-drafts-domain
          .t=${t}
          .language=${language}
          .house=${HOUSE}
          .net=${NET_FULL}
          .automations=${DOMAIN_AUTOMATIONS}
          .marks=${this._marks}
          .focusId=${this._focus}
          .mode=${this._mode}
        ></ai-drafts-domain>
      </div>
      <div class="view" id="view-inventory" role="tabpanel" ?hidden=${this._tab !== "inventory"}>
        <ai-drafts-inventory
          .t=${t}
          .items=${INVENTORY_ITEMS}
          .dependencies=${INVENTORY_DEPENDENCIES}
          .stateLabelOf=${(id: string) => PLACE_LABELS.get(id) ?? id}
        ></ai-drafts-inventory>
      </div>
    `;
  }

  // --- Events --------------------------------------------------------------

  private _onOpenChangeSet = (e: CustomEvent<{ id: string }>): void => {
    if (this._history.status !== "ready") return;
    const changeSet = this._history.items.find((cs) => cs.id === e.detail.id);
    if (changeSet) this._open(changeSet);
  };

  private _onShowFinding = (e: CustomEvent<{ netRefs: string[] }>): void => {
    this._marks = resolveMarks(NET_FULL, e.detail.netRefs);
    this._focus = null;
    this._go("domain");
  };

  private _onFocusAutomation = (
    e: CustomEvent<{ automationId: string; toggle?: boolean }>,
  ): void => {
    const { automationId, toggle } = e.detail;
    this._focus = toggle && this._focus === automationId ? null : automationId;
    if (!toggle) {
      this._marks = NO_MARKS;
      this._go("domain");
    }
  };

  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--primary-background-color);
      color: var(--primary-text-color);
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      height: var(--header-height, 56px);
      padding: 0 12px;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      border-bottom: var(--app-header-border-bottom, none);
    }
    .title {
      font-size: 20px;
      font-weight: 400;
    }
    .outdated {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background-color: var(--warning-color);
      color: var(--text-primary-color, #fff);
    }
    .outdated-text {
      display: flex;
      flex: 1 1 280px;
      flex-direction: column;
      gap: 2px;
      font-size: 14px;
    }
    .outdated-button {
      flex: none;
      padding: 8px 16px;
      font: inherit;
      font-weight: 500;
      color: var(--primary-text-color);
      background-color: var(--card-background-color, var(--primary-background-color));
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-border-radius, 4px);
      cursor: pointer;
    }
    .outdated-button:focus-visible {
      outline: 2px solid var(--primary-text-color);
      outline-offset: 2px;
    }
    .tabs {
      display: flex;
      overflow-x: auto;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color));
      scrollbar-width: none;
    }
    .tabs button {
      flex: none;
      padding: 12px 16px;
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      color: inherit;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      opacity: 0.75;
    }
    .tabs button.active {
      border-bottom-color: currentColor;
      opacity: 1;
    }
    .tabs button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -4px;
    }
    .content {
      padding: 16px;
    }
    .view {
      max-width: 760px;
      margin: 0 auto;
    }
    .view.wide {
      max-width: 1320px;
    }
    .view[hidden] {
      display: none;
    }
  `;
}

customElements.define("ai-drafts-panel", AIDraftsPanel);
