import { LitElement, css, html } from "lit";
import { type Strings, getStrings } from "./localize";
import type { BlaupauseInfo, HomeAssistant, PanelInfo, Route } from "./types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; info: BlaupauseInfo }
  | { status: "error"; message: string };

class BlaupausePanel extends LitElement {
  static override properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    route: { attribute: false },
    panel: { attribute: false },
    _state: { state: true },
  };

  declare hass: HomeAssistant;
  declare narrow: boolean;
  declare route: Route;
  declare panel: PanelInfo;
  declare _state: LoadState;

  private _requested = false;

  constructor() {
    super();
    this._state = { status: "loading" };
  }

  protected override willUpdate(): void {
    // Load once, as soon as `hass` is available.
    if (this.hass && !this._requested) {
      this._requested = true;
      void this._load();
    }
  }

  private async _load(): Promise<void> {
    this._state = { status: "loading" };
    try {
      const info = await this.hass.callWS<BlaupauseInfo>({
        type: "blaupause/info",
      });
      this._state = { status: "ready", info };
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      this._state = { status: "error", message };
    }
  }

  protected override render() {
    const t = getStrings(this.hass?.locale?.language ?? this.hass?.language);
    return html`
      <div class="header">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="title">${t.title}</div>
      </div>
      <div class="content">${this._renderBody(t)}</div>
    `;
  }

  private _renderBody(t: Strings) {
    const state = this._state;
    if (state.status === "loading") {
      return html`<p class="muted">${t.loading}</p>`;
    }
    if (state.status === "error") {
      return html`
        <div class="error" role="alert">
          <p>${t.error}</p>
          <p class="detail">${state.message}</p>
          <button
            @click=${() => {
              void this._load();
            }}
          >
            ${t.retry}
          </button>
        </div>
      `;
    }
    const { info } = state;
    const source =
      info.model_source === "ai_task"
        ? t.sourceAiTask
        : info.model_source === "openai_compatible"
          ? t.sourceOpenai
          : "–";
    const model =
      info.model ?? (info.model_source === "ai_task" ? t.preferredAiTask : "–");
    return html`
      <dl class="info">
        <dt>${t.version}</dt>
        <dd>${info.version}</dd>
        <dt>${t.modelSource}</dt>
        <dd>${source}</dd>
        <dt>${t.model}</dt>
        <dd>${model}</dd>
      </dl>
      <p class="muted empty">${t.empty}</p>
    `;
  }

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
    .content {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }
    .info {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 16px;
      margin: 0 0 16px;
      padding: 16px;
      background-color: var(--card-background-color);
      border-radius: var(--ha-card-border-radius, 12px);
      border: 1px solid var(--divider-color);
    }
    dt {
      color: var(--secondary-text-color);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--secondary-text-color);
    }
    .error {
      padding: 16px;
      border: 1px solid var(--error-color);
      border-radius: var(--ha-card-border-radius, 12px);
      color: var(--error-color);
    }
    .error p {
      margin: 0 0 8px;
    }
    .detail {
      color: var(--secondary-text-color);
      font-family: var(--code-font-family, monospace);
      font-size: 0.9em;
    }
    button {
      font: inherit;
      padding: 8px 16px;
      cursor: pointer;
      color: var(--text-primary-color);
      background-color: var(--primary-color);
      border: none;
      border-radius: 8px;
    }
  `;
}

customElements.define("blaupause-panel", BlaupausePanel);
