import { LitElement, type PropertyValues, css, html, nothing } from "lit";
import type { ApiError } from "../api";
import type { Strings } from "../localize";
import type { ChangeSet } from "../model";
import type { AIDraftsInfo, AIDraftsModels } from "../types";
import { errorBox, fire, icon, sharedStyles, statusBadge, statusIcon } from "./shared";

export type InfoState =
  | { status: "loading" }
  | { status: "ready"; info: AIDraftsInfo }
  | { status: "error"; message: string };

export type ModelsState =
  | { status: "loading" }
  | { status: "ready"; models: AIDraftsModels }
  | { status: "error"; message: string };

export type HistoryState =
  | { status: "loading" }
  | { status: "ready"; items: ChangeSet[] }
  | { status: "error"; message: string };

export class RequestView extends LitElement {
  static override properties = {
    t: { attribute: false },
    language: { attribute: false },
    info: { attribute: false },
    models: { attribute: false },
    history: { attribute: false },
    currentId: { attribute: false },
    drafting: { type: Boolean },
    error: { attribute: false },
    exampleRequest: { attribute: false },
    _text: { state: true },
    _model: { state: true },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare info: InfoState;
  declare models: ModelsState;
  declare history: HistoryState;
  /** The change set open in the proposal view, marked in the list. */
  declare currentId: string | null;
  /** True while a draft is being created. */
  declare drafting: boolean;
  declare error: ApiError | null;
  declare exampleRequest: string;
  declare _text: string;
  /** The model chosen in the selector (option value); null follows the configured default. */
  declare _model: string | null;

  constructor() {
    super();
    this._text = "";
    this._model = null;
    this.drafting = false;
    this.error = null;
  }

  protected override updated(changed: PropertyValues<this>): void {
    // A draft that ended without an error was opened in the proposal view: the
    // text is spent. After an error it stays, so the request can be sent again.
    if (changed.get("drafting") === true && !this.drafting && !this.error) {
      this._text = "";
    }
  }

  protected override render() {
    const t = this.t;
    const canSend = this._text.trim() !== "" && !this.drafting;
    return html`
      <section class="card compose ${this.drafting ? "busy" : ""}" aria-busy=${this.drafting ? "true" : "false"}>
        ${this.drafting ? html`<div class="progress" aria-hidden="true"><span></span></div>` : nothing}
        <h2>${t.requestHeading}</h2>
        <div class="request-field">
          <label for="request">${t.requestLabel}</label>
          <textarea
            id="request"
            rows="5"
            maxlength="4000"
            .value=${this._text}
            ?readonly=${this.drafting}
            placeholder=${t.requestPlaceholder}
            @input=${(e: Event) => {
              this._text = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
        </div>
        <div class="suggestion">
          <button
            class="secondary small"
            type="button"
            ?disabled=${this.drafting}
            @click=${() => {
              this._text = this.exampleRequest;
            }}
          >
            ${icon("mdi:lightbulb-on-outline")}${t.useExample}
          </button>
          <span class="muted example">“${this.exampleRequest}”</span>
        </div>
        <div class="controls">
          ${this._renderModelField()}
          <button
            class="send"
            type="button"
            ?disabled=${!canSend}
            @click=${() =>
              fire(this, "create-draft", {
                request: this._text.trim(),
                model: this._modelToSend(),
              })}
          >
            ${this.drafting
              ? html`<span class="spinner" aria-hidden="true"></span>`
              : icon("mdi:creation-outline")}
            ${this.drafting ? t.drafting : t.createDraft}
          </button>
        </div>
        ${this._renderModelNote()}
        ${this.drafting
          ? html`<div class="alert info" role="status">
              ${icon("mdi:timer-sand")}
              <div class="alert-body"><p>${t.draftingNote}</p></div>
            </div>`
          : nothing}
        ${this.error ? errorBox(t, this.error) : nothing}
      </section>
      <section class="card">
        <h2>${t.historyHeading}</h2>
        ${this._renderHistory()}
      </section>
      ${this._renderInfo()}
    `;
  }

  /** The selector's options as (value, label) pairs, with the default marked; null until loaded. */
  private _modelChoices(): { value: string; label: string; isDefault: boolean }[] | null {
    if (this.models.status !== "ready") return null;
    const { models, default: configured } = this.models.models;
    const defaultValue = configured ?? "";
    return models.map((m) => {
      const value = m.id ?? "";
      const label = m.id === null ? this.t.modelPreferred : m.label;
      const isDefault = value === defaultValue;
      return {
        value,
        label: isDefault ? `${label} (${this.t.modelDefaultMark})` : label,
        isDefault,
      };
    });
  }

  /** The option value shown: the user's choice if it is still on offer, else the default. */
  private _selectedModel(choices: { value: string; isDefault: boolean }[]): string {
    const chosen = choices.find((c) => c.value === this._model);
    return (chosen ?? choices.find((c) => c.isDefault) ?? choices[0])?.value ?? "";
  }

  /** What to send as `model`: undefined (the configured one), a name, or null (preferred entity). */
  private _modelToSend(): string | null | undefined {
    const choices = this._modelChoices();
    if (!choices) return undefined;
    const value = this._selectedModel(choices);
    if (choices.find((c) => c.value === value)?.isDefault ?? true) return undefined;
    return value === "" ? null : value;
  }

  private _renderModelField() {
    const t = this.t;
    const choices = this._modelChoices();
    return html`
      <div class="field model-field">
        <label for="model">${t.modelLabel}</label>
        ${choices
          ? html`
              <select
                id="model"
                ?disabled=${this.drafting}
                .value=${this._selectedModel(choices)}
                @change=${(e: Event) => {
                  this._model = (e.target as HTMLSelectElement).value;
                }}
              >
                ${choices.map(
                  (c) => html`<option value=${c.value} ?selected=${c.value === this._selectedModel(choices)}>
                    ${c.label}
                  </option>`,
                )}
              </select>
            `
          : this.models.status === "loading"
            ? html`<p class="muted loading-models">${t.modelsLoading}</p>`
            : html`<p class="finding-text">${t.modelsError}</p>`}
      </div>
    `;
  }

  private _renderModelNote() {
    const t = this.t;
    const state = this.models;
    return html`
      ${state.status === "error"
        ? html`<p class="muted note">${t.modelsUnavailable}: ${state.message}</p>`
        : nothing}
      ${state.status === "ready" && state.models.error
        ? html`<p class="note unavailable" role="status">
            ${t.modelsUnavailable}: ${state.models.error}
          </p>`
        : nothing}
      <p class="muted note">${t.modelNote}</p>
    `;
  }

  private _renderInfo() {
    const t = this.t;
    const state = this.info;
    if (state.status === "loading") {
      return html`<p class="muted">${t.loading}</p>`;
    }
    if (state.status === "error") {
      return html`
        <div class="alert error" role="alert">
          ${icon("mdi:alert-circle")}
          <div class="alert-body">
            <p>${t.error}</p>
            <p class="detail">${state.message}</p>
            <button type="button" class="secondary" @click=${() => fire(this, "retry-info")}>${t.retry}</button>
          </div>
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
    const model = info.model ?? (info.model_source === "ai_task" ? t.preferredAiTask : "–");
    return html`
      <p class="info muted">
        <span>${t.version} ${info.version}</span>
        <span>${t.modelSource}: ${source}</span>
        <span>${t.model}: ${model}</span>
      </p>
    `;
  }

  private _renderHistory() {
    const t = this.t;
    const h = this.history;
    if (h.status === "loading") return html`<p class="muted">${t.historyLoading}</p>`;
    if (h.status === "error") {
      return html`
        <div class="alert error" role="alert">
          ${icon("mdi:alert-circle")}
          <div class="alert-body">
            <p>${t.historyError}</p>
            <p class="detail">${h.message}</p>
            <button type="button" class="secondary" @click=${() => fire(this, "retry-history")}>${t.retry}</button>
          </div>
        </div>
      `;
    }
    if (h.items.length === 0) {
      return html`<div class="empty">
        ${icon("mdi:history")}
        <p>${t.historyEmpty}</p>
        <p class="muted">${t.historyEmptyHint}</p>
      </div>`;
    }
    const date = new Intl.DateTimeFormat(this.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return html`
      <p class="muted note hint">${t.historyOpenHint}</p>
      <ul class="history">
        ${h.items.map((cs) => {
          const firstError = cs.findings.find((f) => f.severity === "error");
          const current = cs.id === this.currentId;
          return html`
            <li>
              <button
                type="button"
                class="entry ${cs.status} ${current ? "current" : ""}"
                aria-current=${current ? "true" : "false"}
                @click=${() => fire(this, "open-changeset", { id: cs.id })}
              >
                <span class="lead">${icon(statusIcon(cs.status))}</span>
                <span class="main">
                  <span class="text">${cs.request}</span>
                  <span class="meta muted">
                    <span>${date.format(new Date(cs.created))}</span>
                    ${cs.model ? html`<span>${t.historyModel}: ${cs.model}</span>` : nothing}
                    ${cs.rounds > 0 ? html`<span>${t.roundsLabel(cs.rounds)}</span>` : nothing}
                  </span>
                  ${cs.status === "failed" && firstError
                    ? html`<span class="finding-text">${firstError.message}</span>`
                    : nothing}
                </span>
                <span class="side">
                  ${statusBadge(t, cs.status)}
                  ${current ? html`<span class="open">${t.currentBadge}</span>` : nothing}
                </span>
              </button>
            </li>
          `;
        })}
      </ul>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        font-weight: 500;
        color: var(--secondary-text-color);
      }
      .compose {
        position: relative;
        overflow: hidden;
      }
      .request-field {
        min-width: 0;
      }
      textarea,
      select {
        box-sizing: border-box;
        width: 100%;
        font: inherit;
        color: var(--primary-text-color);
        background-color: var(--input-fill-color, var(--secondary-background-color));
        border: 1px solid var(--outline-color, var(--divider-color));
        border-radius: 10px;
      }
      textarea {
        min-height: 128px;
        padding: 14px 16px;
        font-size: 16px;
        line-height: 1.5;
        resize: vertical;
      }
      textarea::placeholder {
        color: var(--secondary-text-color);
        opacity: 0.8;
      }
      textarea:focus {
        border-color: var(--primary-color);
      }
      select {
        min-height: 40px;
        padding: 0 12px;
      }
      select:disabled,
      textarea[readonly] {
        opacity: 0.65;
      }
      .suggestion {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
        margin: 12px 0 0;
      }
      button.small {
        min-height: 32px;
        padding: 0 14px;
        font-size: 13px;
      }
      .example {
        font-size: 13px;
        overflow-wrap: anywhere;
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px 16px;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color);
      }
      .model-field {
        flex: 0 1 300px;
        min-width: 0;
      }
      .model-field label {
        font-weight: 400;
        font-size: 12px;
      }
      button.send {
        min-width: 180px;
        min-height: 44px;
        font-size: 15px;
      }
      @media (max-width: 480px) {
        .model-field {
          flex-basis: 100%;
        }
        button.send {
          width: 100%;
        }
      }
      .unavailable {
        padding-inline-start: 8px;
        border-inline-start: 3px solid var(--warning-color, var(--divider-color));
        overflow-wrap: anywhere;
      }
      .loading-models {
        margin: 0;
      }
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
      .info {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
        margin: 0;
        padding: 0 4px;
        font-size: 12px;
      }
      .alert {
        margin-top: 16px;
      }
      .alert button {
        min-height: 32px;
      }
      .spinner {
        display: inline-block;
        box-sizing: border-box;
        width: 16px;
        height: 16px;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .progress {
        position: absolute;
        inset: 0 0 auto 0;
        height: 3px;
        background-color: color-mix(in srgb, var(--primary-color) 20%, transparent);
      }
      .progress span {
        display: block;
        width: 35%;
        height: 100%;
        background-color: var(--primary-color);
        animation: slide 1.6s ease-in-out infinite;
      }
      @keyframes slide {
        from {
          transform: translateX(-100%);
        }
        to {
          transform: translateX(300%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
          border-right-color: currentColor;
          border-style: dotted;
        }
        .progress span {
          width: 100%;
          animation: none;
          opacity: 0.6;
        }
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px 12px 12px;
        text-align: center;
      }
      .empty ha-icon {
        --mdc-icon-size: 40px;
        margin-bottom: 8px;
        color: var(--secondary-text-color);
      }
      .empty p {
        margin: 0 0 4px;
      }
      .hint {
        margin: -4px 0 12px;
      }
      .history {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .history li + li {
        margin-top: 8px;
      }
      button.entry {
        --status-color: var(--secondary-text-color);
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        font-weight: 400;
        text-align: start;
        color: var(--primary-text-color);
        background-color: transparent;
        border: 1px solid var(--divider-color);
        border-radius: 10px;
      }
      button.entry:hover:not(:disabled) {
        filter: none;
        background-color: var(--secondary-background-color);
      }
      button.entry.current {
        background-color: color-mix(in srgb, var(--primary-color) 8%, transparent);
        border-color: var(--primary-color);
        border-inline-start-width: 4px;
        padding-inline-start: 11px;
      }
      button.entry.checked {
        --status-color: var(--primary-color);
      }
      button.entry.applied {
        --status-color: var(--success-color, var(--primary-color));
      }
      button.entry.failed {
        --status-color: var(--error-color);
      }
      button.entry.draft {
        --status-color: var(--warning-color);
      }
      .lead {
        display: grid;
        place-items: center;
        flex: none;
        width: 36px;
        height: 36px;
        color: var(--status-color);
        background-color: color-mix(in srgb, var(--status-color) 14%, transparent);
        border-radius: 50%;
      }
      .main {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .text {
        display: -webkit-box;
        overflow: hidden;
        font-size: 15px;
        line-height: 1.35;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0 14px;
        font-size: 12px;
      }
      .side {
        display: flex;
        flex: none;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
      }
      .open {
        font-size: 12px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      @media (max-width: 480px) {
        button.entry {
          flex-wrap: wrap;
        }
        .main {
          flex-basis: calc(100% - 60px);
        }
        .side {
          flex-direction: row-reverse;
          align-items: center;
          margin-inline-start: 48px;
        }
      }
      .finding-text {
        display: block;
        margin-top: 2px;
        font-size: 13px;
        color: var(--error-color);
        overflow-wrap: anywhere;
      }
    `,
  ];
}

customElements.define("ai-drafts-request", RequestView);
