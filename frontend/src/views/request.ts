import { LitElement, type PropertyValues, css, html, nothing } from "lit";
import type { ApiError } from "../api";
import { type Strings, statusLabel } from "../localize";
import type { ChangeSet } from "../model";
import type { AIDraftsInfo, AIDraftsModels } from "../types";
import { errorBox, fire, sharedStyles } from "./shared";

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
      ${this._renderInfo()}
      <section class="card">
        <h2>${t.requestHeading}</h2>
        <div class="fields">
          <div class="field request-field">
            <label for="request">${t.requestLabel}</label>
            <textarea
              id="request"
              rows="3"
              maxlength="4000"
              .value=${this._text}
              ?readonly=${this.drafting}
              placeholder=${t.requestPlaceholder}
              @input=${(e: Event) => {
                this._text = (e.target as HTMLTextAreaElement).value;
              }}
            ></textarea>
          </div>
          ${this._renderModelField()}
        </div>
        ${this._renderModelNote()}
        <div class="suggestion">
          <button
            class="secondary"
            type="button"
            ?disabled=${this.drafting}
            @click=${() => {
              this._text = this.exampleRequest;
            }}
          >
            ${t.useExample}
          </button>
          <span class="muted example">“${this.exampleRequest}”</span>
        </div>
        <div class="actions">
          <button
            type="button"
            ?disabled=${!canSend}
            aria-busy=${this.drafting ? "true" : "false"}
            @click=${() =>
              fire(this, "create-draft", {
                request: this._text.trim(),
                model: this._modelToSend(),
              })}
          >
            ${this.drafting ? html`<span class="spinner" aria-hidden="true"></span>` : nothing}
            ${this.drafting ? t.drafting : t.createDraft}
          </button>
        </div>
        ${this.drafting ? html`<p class="muted note" role="status">${t.draftingNote}</p>` : nothing}
        ${this.error ? errorBox(t, this.error) : nothing}
      </section>
      <section class="card">
        <h2>${t.historyHeading}</h2>
        ${this._renderHistory()}
      </section>
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
        <div class="error" role="alert">
          <p>${t.error}</p>
          <p class="detail">${state.message}</p>
          <button type="button" @click=${() => fire(this, "retry-info")}>${t.retry}</button>
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
        <div class="error" role="alert">
          <p>${t.historyError}</p>
          <p class="detail">${h.message}</p>
          <button type="button" @click=${() => fire(this, "retry-history")}>${t.retry}</button>
        </div>
      `;
    }
    if (h.items.length === 0) return html`<p class="muted">${t.historyEmpty}</p>`;
    const date = new Intl.DateTimeFormat(this.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return html`
      <p class="muted note">${t.historyOpenHint}</p>
      <ul class="history">
        ${h.items.map((cs) => {
          const firstError = cs.findings.find((f) => f.severity === "error");
          const current = cs.id === this.currentId;
          return html`
            <li>
              <button
                type="button"
                class="entry ${current ? "current" : ""}"
                aria-current=${current ? "true" : "false"}
                @click=${() => fire(this, "open-changeset", { id: cs.id })}
              >
                <span class="line">
                  <span class="badge ${cs.status}">${statusLabel(t, cs.status)}</span>
                  <span class="when muted">${date.format(new Date(cs.created))}</span>
                  ${cs.rounds > 0
                    ? html`<span class="muted">${t.roundsLabel(cs.rounds)}</span>`
                    : nothing}
                  ${cs.model
                    ? html`<span class="muted model">${t.historyModel}: ${cs.model}</span>`
                    : nothing}
                  ${current ? html`<span class="muted open">${t.currentBadge}</span>` : nothing}
                </span>
                <span class="text">${cs.request}</span>
                ${cs.status === "failed" && firstError
                  ? html`<span class="finding-text">${firstError.message}</span>`
                  : nothing}
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
        color: var(--secondary-text-color);
      }
      .fields {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 16px;
      }
      .field {
        min-width: 0;
      }
      .request-field {
        flex: 3 1 280px;
      }
      .model-field {
        flex: 1 1 200px;
      }
      select {
        box-sizing: border-box;
        width: 100%;
        padding: 8px 12px;
        font: inherit;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }
      select:disabled {
        opacity: 0.6;
      }
      .unavailable {
        padding-inline-start: 8px;
        border-inline-start: 3px solid var(--warning-color, var(--divider-color));
        overflow-wrap: anywhere;
      }
      .loading-models {
        margin: 0;
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 8px 12px;
        font: inherit;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        resize: vertical;
      }
      .suggestion {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin: 8px 0 12px;
      }
      .example {
        font-size: 14px;
      }
      .note {
        margin: 12px 0 0;
        font-size: 13px;
      }
      .info {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
        margin: 0 0 16px;
        font-size: 13px;
      }
      .detail {
        color: var(--secondary-text-color);
      }
      .spinner {
        display: inline-block;
        box-sizing: border-box;
        width: 14px;
        height: 14px;
        margin-right: 8px;
        vertical-align: -2px;
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
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation-duration: 3s;
        }
      }
      .history {
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
      }
      .history li + li {
        margin-top: 8px;
      }
      button.entry {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 10px 12px;
        text-align: start;
        color: var(--primary-text-color);
        background-color: transparent;
        border: 1px solid var(--divider-color);
      }
      button.entry:hover {
        background-color: var(--secondary-background-color);
      }
      button.entry.current {
        border-color: var(--primary-color);
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        margin-bottom: 4px;
        font-size: 13px;
      }
      .open {
        margin-left: auto;
      }
      .text {
        display: block;
        overflow-wrap: anywhere;
      }
      .finding-text {
        display: block;
        margin-top: 4px;
        font-size: 13px;
        color: var(--error-color);
        overflow-wrap: anywhere;
      }
    `,
  ];
}

customElements.define("ai-drafts-request", RequestView);
