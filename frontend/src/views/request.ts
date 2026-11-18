import { LitElement, css, html, nothing } from "lit";
import { type Strings, statusLabel } from "../localize";
import type { ChangeSet } from "../model";
import type { AIDraftsInfo } from "../types";
import { demoBanner, fire, sharedStyles } from "./shared";

export type InfoState =
  | { status: "loading" }
  | { status: "ready"; info: AIDraftsInfo }
  | { status: "error"; message: string };

export class RequestView extends LitElement {
  static override properties = {
    t: { attribute: false },
    language: { attribute: false },
    info: { attribute: false },
    history: { attribute: false },
    proposal: { attribute: false },
    exampleRequest: { attribute: false },
    _text: { state: true },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare info: InfoState;
  declare history: ChangeSet[];
  declare proposal: ChangeSet | null;
  declare exampleRequest: string;
  declare _text: string;

  constructor() {
    super();
    this._text = "";
  }

  protected override render() {
    const t = this.t;
    return html`
      ${demoBanner(t)} ${this._renderInfo()}
      <section class="card">
        <h2>${t.requestHeading}</h2>
        <label for="request">${t.requestLabel}</label>
        <textarea
          id="request"
          rows="3"
          .value=${this._text}
          placeholder=${t.requestPlaceholder}
          @input=${(e: Event) => {
            this._text = (e.target as HTMLTextAreaElement).value;
          }}
        ></textarea>
        <div class="suggestion">
          <button
            class="secondary"
            type="button"
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
            ?disabled=${this._text.trim() === ""}
            @click=${() => fire(this, "create-draft")}
          >
            ${t.createDraft}
          </button>
        </div>
        <p class="muted hint">${t.createHint}</p>
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
    const items = [...(this.proposal ? [this.proposal] : []), ...this.history];
    if (items.length === 0) return html`<p class="muted">${t.historyEmpty}</p>`;
    const date = new Intl.DateTimeFormat(this.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return html`
      <ul class="history">
        ${items.map((cs) => {
          const errors = cs.findings.filter((f) => f.severity === "error");
          const current = cs.id === this.proposal?.id;
          return html`
            <li>
              <div class="line">
                <span class="badge ${cs.status}">${statusLabel(t, cs.status)}</span>
                <span class="when muted">${date.format(new Date(cs.created))}</span>
                ${cs.rounds > 0
                  ? html`<span class="muted">${t.roundsLabel(cs.rounds)}</span>`
                  : nothing}
                ${current
                  ? html`<button
                      class="secondary open"
                      type="button"
                      @click=${() => fire(this, "open-proposal")}
                    >
                      ${t.openProposal}
                    </button>`
                  : nothing}
              </div>
              <div class="text">${cs.request}</div>
              ${cs.status === "failed"
                ? errors.map((f) => html`<div class="finding-text">${f.message}</div>`)
                : nothing}
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
      .hint {
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
      .error {
        margin-bottom: 16px;
        padding: 12px 16px;
        color: var(--error-color);
        border: 1px solid var(--error-color);
        border-radius: 8px;
      }
      .error .detail {
        color: var(--secondary-text-color);
        font-family: var(--code-font-family, monospace);
        font-size: 0.9em;
      }
      .history {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .history li {
        padding: 12px 0;
        border-top: 1px solid var(--divider-color);
      }
      .history li:first-child {
        padding-top: 0;
        border-top: none;
      }
      .history li:last-child {
        padding-bottom: 0;
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
        padding: 4px 12px;
      }
      .finding-text {
        margin-top: 4px;
        font-size: 13px;
        color: var(--error-color);
      }
    `,
  ];
}

customElements.define("ai-drafts-request", RequestView);
