import { LitElement, type TemplateResult, css, html, nothing } from "lit";
import type { ApiError } from "../api";
import type { Strings } from "../localize";
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
import { errorBox, fire, icon, severityIcon, sharedStyles, statusBadge } from "./shared";

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
    _copied: { state: true },
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
  /** Index of the YAML block whose copy button was just used. */
  declare _copied: number | null;
  /** Display names of the entities of the automation being described, to set them apart. */
  private _names: string[] = [];
  private _copyTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this._copied = null;
    this.section = "description";
    this.pending = null;
    this.error = null;
  }

  protected override render() {
    const t = this.t;
    const cs = this.proposal;
    if (!cs) {
      return html`
        <section class="card empty">
          ${icon("mdi:file-document-outline")}
          <p class="muted">${t.noProposal}</p>
          <button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
            ${icon("mdi:arrow-left")}${t.toRequest}
          </button>
        </section>
      `;
    }
    return html`
      <section class="card">${this._renderHead(cs)}${this._renderStatusNote(cs)}</section>
      <section class="card">${this._renderBody(cs)}</section>
      <section class="card">
        <h2>${t.findingsHeading}${cs.findings.length > 0 ? html` <span class="count">${cs.findings.length}</span>` : nothing}</h2>
        ${this._renderFindings(cs)}
      </section>
      ${this._renderDecision(cs)}
    `;
  }

  // --- Head, status ----------------------------------------------------------

  private _renderHead(cs: ChangeSet) {
    const t = this.t;
    const date = (iso: string) =>
      new Intl.DateTimeFormat(this.language, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso),
      );
    const only = cs.operations.length === 1 ? cs.operations[0] : undefined;
    const alias = only?.after?.alias;
    const title = typeof alias === "string" && alias ? alias : t.proposalHeading;
    return html`
      <div class="head">
        <h2 class="headline">${title}</h2>
        ${statusBadge(t, cs.status)}
      </div>
      <p class="request">${icon("mdi:format-quote-open")}<span>${cs.request}</span></p>
      <dl class="meta">
        <div><dt>${t.metaModel}</dt><dd>${cs.model ?? t.modelUnknown}</dd></div>
        <div><dt>${t.metaRounds}</dt><dd>${cs.rounds}</dd></div>
        <div><dt>${t.metaCreated}</dt><dd>${date(cs.created)}</dd></div>
        ${cs.decided ? html`<div><dt>${t.metaDecided}</dt><dd>${date(cs.decided)}</dd></div>` : nothing}
      </dl>
    `;
  }

  /** Why a change set cannot be applied, or what became of it. */
  private _renderStatusNote(cs: ChangeSet) {
    const t = this.t;
    const errors = cs.findings.filter((f) => f.severity === "error").length;
    if (cs.status === "failed") {
      return html`<div class="alert error" role="note">
        ${icon("mdi:alert-circle")}
        <div class="alert-body">
          <strong>${t.failedTitle}</strong>
          <p>${t.failedText(cs.rounds, errors)}</p>
        </div>
      </div>`;
    }
    if (cs.status === "draft") {
      return html`<div class="alert warning" role="note">
        ${icon("mdi:alert")}
        <div class="alert-body"><p>${t.draftNote}</p></div>
      </div>`;
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
    this._names = [];
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
      nameOf: (id: string) => {
        const name = (this.nameOf ?? ((x: string) => x))(id);
        this._names.push(name);
        return name;
      },
    });
    return html`<div class="op">
      ${count > 1 ? html`<h3>${this._heading(d, index, count)}</h3>` : nothing}
      ${d.description ? html`<p class="muted desc">${d.description}</p>` : nothing}
      <ol class="flow">
        ${this._renderStep("trigger", t.triggersHeading, "mdi:flash-outline", d.triggers)}
        ${this._renderStep("condition", t.conditionsHeading, "mdi:filter-outline", d.conditions)}
        ${this._renderStep("action", t.actionsHeading, "mdi:play-circle-outline", d.actions, true)}
      </ol>
      ${d.mode
        ? html`<p class="mode">${icon("mdi:repeat")}<span><span class="muted">${t.modeLabel}:</span> ${this._modeText(d.mode)}</span></p>`
        : nothing}
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

  private _renderStep(
    kind: string,
    title: string,
    iconName: string,
    items: DescribedItem[],
    ordered = false,
  ) {
    const t = this.t;
    return html`
      <li class="step ${kind}">
        <span class="rail">${icon(iconName)}</span>
        <div class="step-body">
          <h4>${title}</h4>
          ${items.length === 0
            ? html`<p class="muted none">${t.none}</p>`
            : html`<ul class="items ${ordered ? "numbered" : ""}">
                ${items.map((i) => html`<li>${this._renderItem(i)}</li>`)}
              </ul>`}
        </div>
      </li>
    `;
  }

  /** The text of a step with entity names set apart and quoted states emphasised. */
  private _rich(text: string) {
    const names = [...new Set(this._names)].filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = [...names.map(esc), "[„“”][^„“”]+[“”]"];
    const re = new RegExp(`(${parts.join("|")})`, "g");
    return text.split(re).map((seg, i) => {
      if (i % 2 === 0 || seg === "") return seg;
      return names.includes(seg)
        ? html`<span class="entity">${seg}</span>`
        : html`<span class="state-value">${seg}</span>`;
    });
  }

  private _renderItem(item: DescribedItem) {
    return html`<span class="item-text">${this._rich(item.text)}</span>${item.fragments.map((f) =>
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
      ${cs.operations.map((op, i) => {
        const lines = operationDiff(op);
        const copied = this._copied === i;
        return html`<div class="code">
          <div class="code-bar">
            <span class="code-label">${icon("mdi:code-braces")}${t.partYaml}</span>
            <button type="button" class="secondary small" @click=${() => void this._copy(lines, i)}>
              ${icon(copied ? "mdi:check" : "mdi:content-copy")}${copied ? t.copiedYaml : t.copyYaml}
            </button>
          </div>
          <pre class="yaml diff" tabindex="0">${lines.map((l) => this._renderLine(l))}</pre>
        </div>`;
      })}
      <span class="visually-hidden" role="status">${this._copied !== null ? t.copiedYaml : ""}</span>
    `;
  }

  private async _copy(lines: DiffLine[], index: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(lines.map((l) => l.text).join("\n"));
    } catch {
      return;
    }
    this._copied = index;
    clearTimeout(this._copyTimer);
    this._copyTimer = setTimeout(() => (this._copied = null), 2000);
  }

  override disconnectedCallback(): void {
    clearTimeout(this._copyTimer);
    super.disconnectedCallback();
  }

  private _renderLine(l: DiffLine): TemplateResult {
    return html`<span class="dl ${l.kind}">${l.text}</span>`;
  }

  // --- Findings ---------------------------------------------------------------

  private _renderFindings(cs: ChangeSet) {
    const t = this.t;
    if (cs.findings.length === 0) {
      if (cs.status === "draft" || cs.status === "failed") {
        return html`<p class="muted">${t.noFindings}</p>`;
      }
      return html`<div class="alert success no-findings" role="status">
        ${icon("mdi:check-circle")}
        <div class="alert-body">
          <strong>${t.noFindings}</strong>
          <p>${t.noFindingsDetail}</p>
        </div>
      </div>`;
    }
    return html`<ul class="findings">
      ${cs.findings.map((f) => this._renderFinding(f))}
    </ul>`;
  }

  private _renderFinding(f: Finding) {
    const t = this.t;
    const label =
      f.severity === "error"
        ? t.severityError
        : f.severity === "warning"
          ? t.severityWarning
          : t.severityInfo;
    const kind = f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "info";
    return html`
      <li class="alert ${kind} finding">
        ${icon(severityIcon(f.severity))}
        <div class="alert-body">
          <div class="line">
            <strong class="severity">${label}</strong>
            <code class="check">${f.check}</code>
          </div>
          <p>${f.message}</p>
          ${f.path ? html`<p class="path muted">${t.pathLabel}: <code>${f.path}</code></p>` : nothing}
          ${f.net_refs.length > 0
            ? html`<button
                type="button"
                class="secondary small"
                @click=${() => fire(this, "show-finding", { netRefs: f.net_refs })}
              >
                ${icon("mdi:graph-outline")}${t.showInDomain}
              </button>`
            : nothing}
        </div>
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
    const icons: Record<Decision, string> = {
      apply: "mdi:check",
      discard: "mdi:delete-outline",
      revert: "mdi:undo-variant",
    };
    const ids = cs.operations.flatMap((op) => (op.target_id ? [op.target_id] : []));
    const status: Record<string, string | undefined> = {
      applied: t.stateApplied,
      reverted: t.stateReverted,
      discarded: t.stateDiscarded,
    };
    const hasActions = offered.length > 0 || cs.status === "reverted" || cs.status === "discarded";
    return html`
      <section class="card decision ${offered.includes("apply") ? "sticky" : ""}">
        <h2 class="visually-hidden">${t.decisionHeading}</h2>
        ${status[cs.status]
          ? html`<p class="state" role="status">${icon("mdi:information-outline")}<span>${status[cs.status]}</span></p>`
          : nothing}
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
        ${hasActions
          ? html`<div class="decide">
              <div class="actions">
                ${offered.map(
                  (d) => html`<button
                    type="button"
                    class="${classes[d]} ${d === "apply" ? "primary-action" : ""}"
                    ?disabled=${busy}
                    aria-busy=${this.pending === d ? "true" : "false"}
                    @click=${() => fire(this, "decide", { decision: d })}
                  >
                    ${icon(icons[d])}${this.pending === d ? labels[d][1] : labels[d][0]}
                  </button>`,
                )}
                ${cs.status === "reverted" || cs.status === "discarded"
                  ? html`<button type="button" class="secondary" @click=${() => fire(this, "goto-request")}>
                      ${icon("mdi:arrow-left")}${t.toRequest}
                    </button>`
                  : nothing}
              </div>
              ${offered.includes("apply") ? html`<p class="effect muted">${t.applyEffect}</p>` : nothing}
              ${offered.includes("revert") ? html`<p class="effect muted">${t.revertEffect}</p>` : nothing}
            </div>`
          : nothing}
        ${this.error ? errorBox(t, this.error) : nothing}
      </section>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding-block: 32px;
        text-align: center;
      }
      .empty ha-icon {
        --mdc-icon-size: 40px;
        color: var(--secondary-text-color);
      }
      .empty p {
        margin: 0;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 12px;
      }
      .headline {
        flex: 1 1 auto;
        min-width: 0;
        margin: 0;
        font-size: 22px;
        font-weight: 500;
        line-height: 1.25;
        overflow-wrap: anywhere;
      }
      .request {
        display: flex;
        gap: 6px;
        margin: 8px 0 14px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      .request ha-icon {
        --mdc-icon-size: 18px;
        margin-top: 2px;
      }
      dl.meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 24px;
        margin: 0;
        font-size: 13px;
      }
      dl.meta div {
        display: flex;
        gap: 6px;
      }
      dl.meta dt {
        color: var(--secondary-text-color);
      }
      dl.meta dd {
        margin: 0;
      }
      .alert {
        margin-top: 16px;
      }
      .count {
        display: inline-block;
        min-width: 20px;
        padding: 0 6px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        text-align: center;
        vertical-align: 2px;
        background-color: var(--secondary-background-color);
        border-radius: 10px;
      }
      .segmented {
        margin-bottom: 20px;
      }
      h4 {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }
      .op + .op {
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid var(--divider-color);
      }
      .op h3 {
        margin: 0 0 4px;
      }
      .desc {
        margin: 0 0 16px;
      }
      /* The flow: trigger, conditions, actions, connected by a line. */
      .flow {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .step {
        position: relative;
        display: flex;
        gap: 14px;
        padding-bottom: 20px;
      }
      .step:last-child {
        padding-bottom: 0;
      }
      .step:not(:last-child)::before {
        position: absolute;
        top: 36px;
        bottom: 4px;
        left: 17px;
        width: 2px;
        content: "";
        background-color: var(--divider-color);
      }
      .rail {
        display: grid;
        flex: none;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--primary-color);
        background-color: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color));
        border: 1px solid color-mix(in srgb, var(--primary-color) 40%, transparent);
        border-radius: 50%;
      }
      .step-body {
        flex: 1;
        min-width: 0;
        padding-top: 6px;
      }
      .items {
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 15px;
      }
      .items li + li {
        margin-top: 8px;
      }
      .items.numbered {
        counter-reset: n;
      }
      .items.numbered li {
        position: relative;
        padding-inline-start: 28px;
        counter-increment: n;
      }
      .items.numbered li::before {
        position: absolute;
        top: 2px;
        left: 0;
        width: 20px;
        height: 20px;
        font-size: 12px;
        font-weight: 500;
        line-height: 20px;
        text-align: center;
        content: counter(n);
        color: var(--secondary-text-color);
        border: 1px solid var(--divider-color);
        border-radius: 50%;
      }
      .item-text {
        overflow-wrap: anywhere;
      }
      .entity {
        display: inline-block;
        padding: 0 8px;
        font-weight: 500;
        line-height: 1.55;
        background-color: color-mix(in srgb, var(--primary-color) 14%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
        border-radius: 6px;
      }
      .state-value {
        font-weight: 500;
      }
      .none {
        margin: 0;
      }
      .mode {
        display: flex;
        gap: 8px;
        align-items: center;
        margin: 20px 0 0;
        padding-top: 14px;
        font-size: 13px;
        border-top: 1px solid var(--divider-color);
      }
      .mode ha-icon {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color);
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
        margin: 0 0 8px;
      }
      .finding:last-child {
        margin-bottom: 0;
      }
      .no-findings {
        margin-top: 0;
      }
      .no-findings p {
        margin: 0;
        color: var(--secondary-text-color);
      }
      .finding p {
        margin-bottom: 4px;
        overflow-wrap: anywhere;
      }
      .finding .path {
        font-size: 13px;
      }
      .finding button {
        margin-top: 6px;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 10px;
        margin-bottom: 2px;
      }
      .check {
        font-size: 12px;
        color: var(--secondary-text-color);
        overflow-wrap: anywhere;
      }
      .note {
        margin: 0 0 12px;
        font-size: 13px;
      }
      button.small {
        min-height: 32px;
        padding: 0 14px;
        font-size: 13px;
      }
      .code {
        overflow: hidden;
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 10px;
      }
      .code + .code {
        margin-top: 12px;
      }
      .code-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px 6px 14px;
        border-bottom: 1px solid var(--divider-color);
      }
      .code-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: var(--secondary-text-color);
      }
      .code-label ha-icon {
        --mdc-icon-size: 16px;
      }
      .yaml {
        margin: 0;
        padding: 12px;
        overflow-x: auto;
        font-family: var(--code-font-family, monospace);
        font-size: 13px;
        line-height: 1.55;
        color: var(--primary-text-color);
        background-color: var(--secondary-background-color);
        border-radius: 8px;
      }
      .fragment .yaml {
        margin-top: 4px;
        border: 1px solid var(--divider-color);
      }
      .yaml.diff {
        padding: 0;
        border-radius: 0;
      }
      .dl:first-child {
        padding-top: 10px;
      }
      .dl:last-child {
        padding-bottom: 10px;
      }
      .dl {
        display: block;
        position: relative;
        padding: 0 14px 0 32px;
        white-space: pre;
      }
      .dl::before {
        position: absolute;
        left: 12px;
        content: " ";
        color: var(--secondary-text-color);
      }
      .dl.add {
        background-color: color-mix(in srgb, var(--success-color, var(--primary-color)) 14%, transparent);
      }
      .dl.add::before {
        content: "+";
        color: var(--success-color, var(--primary-color));
      }
      .dl.remove {
        background-color: color-mix(in srgb, var(--error-color) 14%, transparent);
      }
      .dl.remove::before {
        content: "-";
        color: var(--error-color);
      }
      /* The decision stays in view while the proposal is read. */
      .decision {
        margin-bottom: 0;
      }
      .decision.sticky {
        position: sticky;
        bottom: 0;
        z-index: 1;
        border-bottom-width: 0;
        border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
      }
      .decide {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 20px;
      }
      .decision button.primary-action {
        min-height: 44px;
        padding-inline: 28px;
        font-size: 15px;
      }
      .decision .actions button {
        min-height: 44px;
      }
      .effect {
        flex: 1 1 240px;
        margin: 0;
        font-size: 13px;
      }
      .state {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 0 0 14px;
      }
      .created {
        margin: -6px 0 14px;
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
      @media (max-width: 480px) {
        .headline {
          font-size: 20px;
        }
        .decision.sticky {
          position: static;
          border-bottom-width: var(--ha-card-border-width, 1px);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: none;
        }
      }
    `,
  ];
}

customElements.define("ai-drafts-proposal", ProposalView);
