import { LitElement, css, html } from "lit";
import { AUTOMATIONS, HISTORY, HOUSE, NET_EXISTING, NET_PROPOSAL, PROPOSAL } from "./demo";
import { type Strings, getStrings } from "./localize";
import { type Action, perform } from "./logic/changeset-machine";
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
import { type InfoState } from "./views/request";
import "./views/domain-view";
import "./views/inventory";
import "./views/proposal";
import "./views/request";

type Tab = "request" | "proposal" | "domain" | "inventory";
const TABS: Tab[] = ["request", "proposal", "domain", "inventory"];

const NET_FULL = mergeNets(NET_EXISTING, NET_PROPOSAL);
const PROPOSAL_AUTOMATION_ID = String(PROPOSAL.operations[0]?.after?.id ?? "");
const ALIASES = new Map<string, string>([
  ...AUTOMATIONS.map((a): [string, string] => [a.id, a.alias]),
  [PROPOSAL_AUTOMATION_ID, String(PROPOSAL.operations[0]?.after?.alias ?? "")],
]);
const INFOS = deriveAutomations(NET_FULL);
const PLACE_LABELS = new Map(NET_FULL.places.map((p) => [p.id, p.label]));

class AIDraftsPanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    route: { attribute: false },
    panel: { attribute: false },
    _info: { state: true },
    _tab: { state: true },
    _proposal: { state: true },
    _marks: { state: true },
    _focus: { state: true },
    _mode: { state: true },
  };

  declare hass: HomeAssistant;
  declare narrow: boolean;
  declare route: Route;
  declare panel: PanelInfo;
  declare _info: InfoState;
  declare _tab: Tab;
  /** The open proposal; null until a draft was created. */
  declare _proposal: ChangeSet | null;
  declare _marks: Marks;
  declare _focus: string | null;
  declare _mode: DomainMode;

  private _requested = false;

  constructor() {
    super();
    this._info = { status: "loading" };
    this._tab = "request";
    this._proposal = null;
    this._marks = NO_MARKS;
    this._focus = null;
    this._mode = "house";
  }

  protected override willUpdate(): void {
    // Load once, as soon as `hass` is available.
    if (this.hass && !this._requested) {
      this._requested = true;
      void this._loadInfo();
    }
  }

  private async _loadInfo(): Promise<void> {
    this._info = { status: "loading" };
    try {
      const info = await this.hass.callWS<
        Extract<InfoState, { status: "ready" }>["info"]
      >({ type: "ai_drafts/info" });
      this._info = { status: "ready", info };
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      this._info = { status: "error", message };
    }
  }

  // --- Showcase state ------------------------------------------------------

  /** An automation exists in the showcase while the proposal is open or applied. */
  private get _proposalLive(): "open" | "applied" | null {
    const status = this._proposal?.status;
    if (status === "checked" || status === "draft") return "open";
    if (status === "applied") return "applied";
    return null;
  }

  private _alias(id: string): string {
    return ALIASES.get(id) ?? id;
  }

  private _domainAutomations(): DomainAutomation[] {
    const live = this._proposalLive;
    return INFOS.filter((i) => i.id !== PROPOSAL_AUTOMATION_ID || live !== null).map((info) => ({
      info,
      alias: this._alias(info.id),
      isProposal: info.id === PROPOSAL_AUTOMATION_ID && live === "open",
    }));
  }

  private _inventoryItems(): InventoryItem[] {
    return INFOS.filter((i) => i.id !== PROPOSAL_AUTOMATION_ID || this._proposalLive === "applied").map(
      (info) => ({
        id: info.id,
        alias: this._alias(info.id),
        mode: info.mode,
        description: describeAutomation(info, HOUSE),
        isNew: info.id === PROPOSAL_AUTOMATION_ID,
      }),
    );
  }

  private _decide(action: Action): void {
    if (!this._proposal) return;
    this._proposal = perform(this._proposal, action);
    // A marked finding or focus on an automation that just vanished is stale.
    if (this._proposalLive === null) {
      this._marks = NO_MARKS;
      if (this._focus === PROPOSAL_AUTOMATION_ID) this._focus = null;
    }
  }

  private _go(tab: Tab): void {
    this._tab = tab;
  }

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
        @open-proposal=${() => this._go("proposal")}
        @goto-request=${() => this._go("request")}
        @retry-info=${() => void this._loadInfo()}
        @show-finding=${this._onShowFinding}
        @focus-automation=${this._onFocusAutomation}
        @clear-marks=${() => (this._marks = NO_MARKS)}
        @clear-focus=${() => (this._focus = null)}
        @set-mode=${(e: CustomEvent<{ mode: DomainMode }>) => (this._mode = e.detail.mode)}
        @apply=${() => this._decide("apply")}
        @discard=${() => this._decide("discard")}
        @revert=${() => this._decide("revert")}
      >
        ${this._renderViews(t, language)}
      </div>
    `;
  }

  private _renderViews(t: Strings, language: string | undefined) {
    const proposalInfo = INFOS.find((i) => i.id === PROPOSAL_AUTOMATION_ID) ?? null;
    return html`
      <div class="view" id="view-request" role="tabpanel" ?hidden=${this._tab !== "request"}>
        <ai-drafts-request
          .t=${t}
          .language=${language}
          .info=${this._info}
          .history=${HISTORY}
          .proposal=${this._proposal}
          .exampleRequest=${PROPOSAL.request}
        ></ai-drafts-request>
      </div>
      <div class="view" id="view-proposal" role="tabpanel" ?hidden=${this._tab !== "proposal"}>
        <ai-drafts-proposal
          .t=${t}
          .language=${language}
          .proposal=${this._proposal}
          .description=${proposalInfo ? describeAutomation(proposalInfo, HOUSE) : null}
          .mode=${proposalInfo?.mode ?? null}
        ></ai-drafts-proposal>
      </div>
      <div class="view wide" id="view-domain" role="tabpanel" ?hidden=${this._tab !== "domain"}>
        <ai-drafts-domain
          .t=${t}
          .language=${language}
          .house=${HOUSE}
          .net=${NET_FULL}
          .automations=${this._domainAutomations()}
          .marks=${this._marks}
          .focusId=${this._focus}
          .mode=${this._mode}
        ></ai-drafts-domain>
      </div>
      <div class="view" id="view-inventory" role="tabpanel" ?hidden=${this._tab !== "inventory"}>
        <ai-drafts-inventory
          .t=${t}
          .items=${this._inventoryItems()}
          .dependencies=${deriveDependencies(
            INFOS.filter((i) => i.id !== PROPOSAL_AUTOMATION_ID || this._proposalLive === "applied"),
          )}
          .stateLabelOf=${(id: string) => PLACE_LABELS.get(id) ?? id}
        ></ai-drafts-inventory>
      </div>
    `;
  }

  // --- Events --------------------------------------------------------------

  private _onCreateDraft = (): void => {
    // The showcase has one prepared proposal; creating a draft always opens it.
    this._proposal = { ...PROPOSAL };
    this._marks = NO_MARKS;
    this._focus = null;
    this._go("proposal");
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
