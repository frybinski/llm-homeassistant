import { LitElement, type TemplateResult, css, html, nothing } from "lit";
import type { ApiError } from "../api";
import { type Strings, statusLabel } from "../localize";
import { type Decision, offeredDecisions } from "../logic/changeset-actions";
import {
  type AutomationDescription,
  type DescribedItem,
  type Fragment,
  describeConfig,
} from "../logic/describe-config";
import { type DiffLine, operationDiff } from "../logic/diff";
import { toYaml } from "../logic/yaml";
import type { ChangeSet, Finding, Json, Operation } from "../model";
import { errorBox, fire, sharedStyles } from "./shared";

/** The parts of this view; the one active at a decision is sent to the backend. */
export type ProposalPart = "description" | "yaml";
export const PARTS: ProposalPart[] = ["description", "yaml"];

export class ProposalView extends LitElement {
  static override properties = {
    t: { attribute: false },
    language: { attribute: false },
    proposal: { attribute: false },
    section: { attribute: false },
    nameOf: { attribute: false },
    pending: { attribute: false },
    error: { attribute: false },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare proposal: ChangeSet | null;
  declare section: ProposalPart;
  /** Friendly name of an entity, from `hass.states`. */
  declare nameOf: (entityId: string) => string;
  /** The decision that is being sent to the backend, if any. */
  declare pending: Decision | null;
  declare error: ApiError | null;

  constructor() {
    super();
    this.section = "description";
    this.pending = null;
    this.error = null;
  }

  protected override render() {
    const t = this.t;
    const cs = this.proposal;
    if (!cs) {
      return html`
        <section class="card">
          <p class="muted">${t.noProposal}</p>
          <button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
            ${t.toRequest}
          </button>
        </section>
      `;
    }
    return html`
      <section class="card">${this._renderHead(cs)}</section>
      ${this._renderStatusNote(cs)}
      <section class="card">${this._renderBody(cs)}</section>
      <section class="card">
        <h2>${t.findingsHeading}</h2>
        ${cs.findings.length === 0
          ? html`<p class="muted">${t.noFindings}</p>`
          : html`<ul class="findings">
              ${cs.findings.map((f) => this._renderFinding(f))}
            </ul>`}
      </section>
      <section class="card">${this._renderDecision(cs)}</section>
    `;
  }

  // --- Head, status ----------------------------------------------------------

  private _renderHead(cs: ChangeSet) {
    const t = this.t;
    const date = (iso: string) =>
      new Intl.DateTimeFormat(this.language, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      );
    return html`
      <div class="head">
        <h2>${t.proposalHeading}</h2>
        <span class="badge ${cs.status}">${statusLabel(t, cs.status)}</span>
      </div>
      <p class="request">“${cs.request}”</p>
      <dl class="facts small">
        <dt>${t.metaModel}</dt>
        <dd>${cs.model ?? t.modelUnknown}</dd>
        <dt>${t.metaRounds}</dt>
        <dd>${cs.rounds}</dd>
        <dt>${t.metaCreated}</dt>
        <dd>${date(cs.created)}</dd>
        ${cs.decided ? html`<dt>${t.metaDecided}</dt><dd>${date(cs.decided)}</dd>` : nothing}
      </dl>
    `;
  }

  /** Why a change set cannot be applied, or what became of it. */
  private _renderStatusNote(cs: ChangeSet) {
    const t = this.t;
    const errors = cs.findings.filter((f) => f.severity === "error").length;
    if (cs.status === "failed") {
      return html`<div class="callout error" role="note">
        <strong>${t.failedTitle}</strong>
        <p>${t.failedText(cs.rounds, errors)}</p>
      </div>`;
    }
    if (cs.status === "draft") {
      return html`<div class="callout warning" role="note"><p>${t.draftNote}</p></div>`;
    }
    return nothing;
  }

  // --- Body: description or YAML --------------------------------------------

  private _renderBody(cs: ChangeSet) {
    const t = this.t;
    const labels: Record<ProposalPart, string> = {
      description: t.partDescription,
      yaml: t.partYaml,
    };
    return html`
      <div class="segmented" role="group" aria-label=${t.partsLabel}>
        ${PARTS.map(
          (p) => html`<button
            type="button"
            class=${this.section === p ? "on" : ""}
            aria-pressed=${this.section === p ? "true" : "false"}
            @click=${() => fire(this, "set-part", { part: p })}
          >
            ${labels[p]}
          </button>`,
        )}
      </div>
      ${this.section === "description"
        ? cs.operations.map((op, i) => this._renderDescription(op, i, cs.operations.length))
        : this._renderYaml(cs)}
    `;
  }

  private _renderDescription(op: Operation, index: number, count: number) {
    const t = this.t;
    if (op.kind !== "automation" || op.op !== "create" || !op.after) {
      return html`<div class="op">
        ${this._renderItem({
          text: t.operationOther(op.op, op.kind),
          fragments: [{ label: t.fragmentYaml, yaml: toYaml(op as unknown as Json) }],
        })}
      </div>`;
    }
    const d = describeConfig(op.after, {
      t,
      language: this.language,
      nameOf: this.nameOf ?? ((id: string) => id),
    });
    return html`<div class="op">
      <h3>${this._heading(d, index, count)}</h3>
      ${d.description ? html`<p class="muted desc">${d.description}</p>` : nothing}
      ${this._renderGroup(t.triggersHeading, d.triggers)}
      ${this._renderGroup(t.conditionsHeading, d.conditions)}
      ${this._renderGroup(t.actionsHeading, d.actions, true)}
      ${d.mode ? html`<p class="mode"><span class="muted">${t.modeLabel}:</span> ${this._modeText(d.mode)}</p>` : nothing}
      ${d.other.length > 0
        ? html`<h4>${t.otherFieldsHeading}</h4>${d.other.map((f) => this._renderFragment(f))}`
        : nothing}
    </div>`;
  }

  private _heading(d: AutomationDescription, index: number, count: number): string {
    const t = this.t;
    const name = d.alias ? t.automationHeading(d.alias) : t.automationUnnamed;
    return count > 1 ? `${index + 1}/${count} ${name}` : name;
  }

  private _modeText(mode: string): string {
    const t = this.t;
    return mode === "restart" ? t.modeRestart : mode === "single" ? t.modeSingle : mode;
  }

  private _renderGroup(title: string, items: DescribedItem[], ordered = false) {
    const t = this.t;
    return html`
      <h4>${title}</h4>
      ${items.length === 0
        ? html`<p class="muted none">${t.none}</p>`
        : ordered
          ? html`<ol class="items">${items.map((i) => html`<li>${this._renderItem(i)}</li>`)}</ol>`
          : html`<ul class="items">${items.map((i) => html`<li>${this._renderItem(i)}</li>`)}</ul>`}
    `;
  }

  private _renderItem(item: DescribedItem) {
    return html`<span class="item-text">${item.text}</span>${item.fragments.map((f) =>
      this._renderFragment(f),
    )}`;
  }

  private _renderFragment(f: Fragment) {
    return html`<div class="fragment">
      <span class="frag-label">${f.label}</span>
      <pre class="yaml">${f.yaml}</pre>
    </div>`;
  }

  private _renderYaml(cs: ChangeSet) {
    const t = this.t;
    return html`
      <p class="muted note">${t.yamlNote}</p>
      ${cs.operations.map(
        (op) => html`<pre class="yaml diff" tabindex="0">${operationDiff(op).map((l) => this._renderLine(l))}</pre>`,
      )}
    `;
  }

  private _renderLine(l: DiffLine): TemplateResult {
    return html`<span class="dl ${l.kind}">${l.text}</span>`;
  }

  // --- Findings ---------------------------------------------------------------

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
        ${f.path ? html`<p class="path muted">${t.pathLabel}: <code>${f.path}</code></p>` : nothing}
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

  // --- Decision -------------------------------------------------------------

  private _renderDecision(cs: ChangeSet) {
    const t = this.t;
    const offered = offeredDecisions(cs.status);
    const busy = this.pending !== null;
    const labels: Record<Decision, [string, string]> = {
      apply: [t.apply, t.applying],
      discard: [t.discard, t.discarding],
      revert: [t.revert, t.reverting],
    };
    const classes: Record<Decision, string> = { apply: "", discard: "danger", revert: "secondary" };
    const ids = cs.operations.flatMap((op) => (op.target_id ? [op.target_id] : []));
    const status: Record<string, string | undefined> = {
      applied: t.stateApplied,
      reverted: t.stateReverted,
      discarded: t.stateDiscarded,
    };
    return html`
      <h2>${t.decisionHeading}</h2>
      <div class="actions">
        ${offered.map(
          (d) => html`<button
            type="button"
            class=${classes[d]}
            ?disabled=${busy}
            aria-busy=${this.pending === d ? "true" : "false"}
            @click=${() => fire(this, "decide", { decision: d })}
          >
            ${this.pending === d ? labels[d][1] : labels[d][0]}
          </button>`,
        )}
        ${cs.status === "reverted" || cs.status === "discarded"
          ? html`<button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
              ${t.toRequest}
            </button>`
          : nothing}
      </div>
      ${offered.includes("apply") ? html`<p class="muted note">${t.applyEffect}</p>` : nothing}
      ${offered.includes("revert") ? html`<p class="muted note">${t.revertEffect}</p>` : nothing}
      ${status[cs.status] ? html`<p class="state" role="status">${status[cs.status]}</p>` : nothing}
      ${cs.status === "applied" && ids.length > 0
        ? html`<ul class="created">
            ${ids.map(
              (id) => html`<li>
                <span class="muted">${t.createdAutomation} (${t.automationId}):</span>
                <code>${id}</code>
                <a href="/config/automation/edit/${encodeURIComponent(id)}">${t.openInEditor}</a>
              </li>`,
            )}
          </ul>`
        : nothing}
      ${this.error ? errorBox(t, this.error) : nothing}
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
        overflow-wrap: anywhere;
      }
      dl.small {
        font-size: 14px;
      }
      .callout {
        margin: 0 0 16px;
        padding: 12px 16px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
      }
      .callout p {
        margin: 4px 0 0;
      }
      .callout.error {
        color: var(--primary-text-color);
        border-color: var(--error-color);
        border-width: 2px;
      }
      .callout.error strong {
        color: var(--error-color);
      }
      .callout.warning {
        border-color: var(--warning-color);
      }
      .segmented {
        display: inline-flex;
        margin-bottom: 16px;
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        overflow: hidden;
      }
      .segmented button {
        color: var(--primary-color);
        background: transparent;
        border: none;
        border-radius: 0;
      }
      .segmented button.on {
        color: var(--text-primary-color);
        background-color: var(--primary-color);
      }
      h4 {
        margin: 16px 0 6px;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .op + .op {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color);
      }
      .op h3 {
        margin: 0;
      }
      .desc {
        margin: 4px 0 0;
      }
      .items {
        margin: 0;
        padding-left: 24px;
      }
      .items li + li {
        margin-top: 6px;
      }
      .item-text {
        overflow-wrap: anywhere;
      }
      .none {
        margin: 0;
      }
      .mode {
        margin: 16px 0 0;
      }
      .fragment {
        margin: 6px 0;
      }
      .frag-label {
        display: block;
        font-size: 12px;
        color: var(--secondary-text-color);
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
      .finding p {
        overflow-wrap: anywhere;
      }
      .finding .path {
        margin: 0;
        font-size: 13px;
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
      .note {
        margin: 8px 0 0;
        font-size: 13px;
      }
      .yaml {
        margin: 4px 0 0;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        line-height: 1.45;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border-radius: 8px;
      }
      .yaml.diff {
        padding: 12px 0;
        margin-top: 12px;
      }
      .dl {
        display: block;
        padding: 0 12px 0 28px;
        position: relative;
        white-space: pre;
      }
      .dl::before {
        position: absolute;
        left: 10px;
        content: " ";
        color: var(--secondary-text-color);
      }
      .dl.add {
        background-color: color-mix(in srgb, var(--success-color, var(--primary-color)) 18%, transparent);
      }
      .dl.add::before {
        content: "+";
        color: var(--success-color, var(--primary-color));
      }
      .dl.remove {
        background-color: color-mix(in srgb, var(--error-color) 18%, transparent);
      }
      .dl.remove::before {
        content: "-";
        color: var(--error-color);
      }
      .state {
        margin: 12px 0 0;
      }
      .created {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
      }
      .created li {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
        align-items: baseline;
      }
      .created a {
        color: var(--primary-color);
      }
      .created code {
        overflow-wrap: anywhere;
      }
    `,
  ];
}

customElements.define("ai-drafts-proposal", ProposalView);
