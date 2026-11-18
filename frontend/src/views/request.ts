import { LitElement, type PropertyValues, css, html, nothing } from "lit";
import type { ApiError } from "../api";
import { type Strings, statusLabel } from "../localize";
import type { ChangeSet } from "../model";
import type { AIDraftsInfo } from "../types";
import { errorBox, fire, sharedStyles } from "./shared";

export type InfoState =
  | { status: "loading" }
  | { status: "ready"; info: AIDraftsInfo }
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
    history: { attribute: false },
    currentId: { attribute: false },
    drafting: { type: Boolean },
    error: { attribute: false },
    exampleRequest: { attribute: false },
    _text: { state: true },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare info: InfoState;
  declare history: HistoryState;
  /** The change set open in the proposal view, marked in the list. */
  declare currentId: string | null;
  /** True while a draft is being created. */
  declare drafting: boolean;
  declare error: ApiError | null;
  declare exampleRequest: string;
  declare _text: string;

  constructor() {
    super();
    this._text = "";
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
            @click=${() => fire(this, "create-draft", { request: this._text.trim() })}
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
