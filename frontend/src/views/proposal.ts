import { LitElement, css, html, nothing } from "lit";
import { type Strings, statusLabel } from "../localize";
import { type Action, canDo, hasErrors } from "../logic/changeset-machine";
import { type Description } from "../logic/describe";
import { formatDuration } from "../logic/text";
import { toYaml } from "../logic/yaml";
import type { ChangeSet, Finding } from "../model";
import { demoBanner, fire, sharedStyles } from "./shared";

export class ProposalView extends LitElement {
  static override properties = {
    t: { attribute: false },
    language: { attribute: false },
    proposal: { attribute: false },
    description: { attribute: false },
    mode: { attribute: false },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare proposal: ChangeSet | null;
  /** The automation in house terms, derived from the net; null if unknown. */
  declare description: Description | null;
  declare mode: string | null;

  protected override render() {
    const t = this.t;
    const cs = this.proposal;
    if (!cs) {
      return html`
        ${demoBanner(t)}
        <section class="card">
          <p class="muted">${t.noProposal}</p>
          <button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
            ${t.toRequest}
          </button>
        </section>
      `;
    }
    return html`
      ${demoBanner(t)}
      <section class="card">
        <div class="head">
          <h2>${t.proposalHeading}</h2>
          <span class="badge ${cs.status}">${statusLabel(t, cs.status)}</span>
        </div>
        <p class="request">“${cs.request}”</p>
        ${this._renderSummary()}
      </section>
      <section class="card">
        <h2>${t.findingsHeading}</h2>
        ${cs.findings.length === 0
          ? html`<p class="muted">${t.noFindings}</p>`
          : html`<ul class="findings">
              ${cs.findings.map((f) => this._renderFinding(f))}
            </ul>`}
      </section>
      <section class="card">${this._renderYaml(cs)}</section>
      <section class="card">${this._renderDecision(cs)}</section>
    `;
  }

  private _renderSummary() {
    const t = this.t;
    const d = this.description;
    if (!d) return nothing;
    const units = { hour: t.unitHour, minute: t.unitMinute, second: t.unitSecond };
    const withRoom = (text: string, room: string | null) =>
      room ? html`${text} <span class="muted">(${room})</span>` : html`${text}`;
    const modeText =
      this.mode === "restart" ? t.modeRestart : this.mode === "single" ? t.modeSingle : this.mode;
    return html`
      <h3>${t.summaryHeading}</h3>
      <dl class="facts">
        <dt>${t.trigger}</dt>
        <dd>${d.triggers.map((x) => html`<div>${withRoom(x.text, x.room)}</div>`)}</dd>
        <dt>${t.condition}</dt>
        <dd>
          ${d.conditions.length === 0
            ? t.none
            : d.conditions.map((x) => html`<div>${withRoom(x.text, x.room)}</div>`)}
        </dd>
        <dt>${t.effect}</dt>
        <dd>
          ${d.effects.map(
            (x) => html`<div>
              ${x.delay ? html`<span class="muted">${t.after(formatDuration(x.delay, units))}:</span> ` : nothing}${withRoom(x.text, x.room)}
            </div>`,
          )}
        </dd>
        <dt>${d.rooms.length === 1 ? t.room : t.rooms}</dt>
        <dd>${d.rooms.length ? d.rooms.join(", ") : t.none}</dd>
        ${modeText ? html`<dt>${t.modeLabel}</dt><dd>${modeText}</dd>` : nothing}
      </dl>
    `;
  }

  private _renderFinding(f: Finding) {
    const t = this.t;
    const label =
      f.severity === "error"
        ? t.severityError
        : f.severity === "warning"
          ? t.severityWarning
          : t.severityInfo;
    return html`
      <li class="finding">
        <div class="line">
          <span class="badge ${f.severity}">${label}</span>
          <code class="check">${f.check}</code>
        </div>
        <p>${f.message}</p>
        ${f.net_refs.length > 0
          ? html`<button
              type="button"
              class="secondary"
              @click=${() => fire(this, "show-finding", { netRefs: f.net_refs })}
            >
              ${t.showInDomain}
            </button>`
          : nothing}
      </li>
    `;
  }

  private _renderYaml(cs: ChangeSet) {
    const t = this.t;
    // A create is all additions, so the plain YAML of `after` is the whole diff.
    const blocks = cs.operations.flatMap((op) => (op.after ? [toYaml(op.after)] : []));
    return html`
      <details>
        <summary>${t.yamlSummary}</summary>
        <p class="muted note">${t.yamlNote}</p>
        ${blocks.map((yaml) => html`<pre class="yaml">${yaml}</pre>`)}
      </details>
    `;
  }

  private _renderDecision(cs: ChangeSet) {
    const t = this.t;
    const act = (action: Action) => () => fire(this, action);
    const decided = cs.decided
      ? t.decidedAt(
          new Intl.DateTimeFormat(this.language, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(cs.decided),
          ),
        )
      : null;
    const note: Record<string, string | undefined> = {
      applied: t.stateApplied,
      reverted: t.stateReverted,
      discarded: t.stateDiscarded,
      failed: t.stateFailed,
    };
    return html`
      <div class="actions">
        ${cs.status === "checked" || cs.status === "draft"
          ? html`
              <button type="button" ?disabled=${!canDo(cs, "apply")} @click=${act("apply")}>
                ${t.apply}
              </button>
              <button
                type="button"
                class="danger"
                ?disabled=${!canDo(cs, "discard")}
                @click=${act("discard")}
              >
                ${t.discard}
              </button>
            `
          : nothing}
        ${cs.status === "applied"
          ? html`<button type="button" class="secondary" @click=${act("revert")}>
              ${t.revert}
            </button>`
          : nothing}
        ${cs.status === "reverted" || cs.status === "discarded"
          ? html`<button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
              ${t.toRequest}
            </button>`
          : nothing}
      </div>
      ${hasErrors(cs) && cs.status === "checked"
        ? html`<p class="muted note">${t.blockedByErrors}</p>`
        : nothing}
      ${note[cs.status] ? html`<p class="state" role="status">${note[cs.status]}</p>` : nothing}
      ${decided ? html`<p class="muted note">${decided}</p>` : nothing}
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .head h2 {
        margin: 0;
      }
      .request {
        margin: 8px 0 16px;
        font-style: italic;
      }
      .findings {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .finding {
        padding: 12px 0;
        border-top: 1px solid var(--divider-color);
      }
      .finding:first-child {
        padding-top: 0;
        border-top: none;
      }
      .finding:last-child {
        padding-bottom: 0;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        margin-bottom: 6px;
      }
      .check {
        font-size: 12px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      summary {
        cursor: pointer;
        font-weight: 500;
      }
      .note {
        margin: 8px 0 0;
        font-size: 13px;
      }
      .yaml {
        margin: 8px 0 0;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        line-height: 1.45;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border-radius: 8px;
      }
      .state {
        margin: 12px 0 0;
      }
    `,
  ];
}

customElements.define("ai-drafts-proposal", ProposalView);
