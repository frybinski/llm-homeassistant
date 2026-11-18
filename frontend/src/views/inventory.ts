import { LitElement, css, html, nothing } from "lit";
import type { Strings } from "../localize";
import type { Description } from "../logic/describe";
import type { Dependency } from "../logic/net";
import { formatDuration } from "../logic/text";
import { demoBanner, fire, sharedStyles } from "./shared";

export interface InventoryItem {
  id: string;
  alias: string;
  mode: string | null;
  description: Description;
  /** True for the automation the showcase applied just now. */
  isNew: boolean;
}

export class InventoryView extends LitElement {
  static override properties = {
    t: { attribute: false },
    items: { attribute: false },
    dependencies: { attribute: false },
    stateLabelOf: { attribute: false },
  };

  declare t: Strings;
  declare items: InventoryItem[];
  declare dependencies: Dependency[];
  /** Label of a state place, for the dependency sentences. */
  declare stateLabelOf: (placeId: string) => string;

  protected override render() {
    const t = this.t;
    return html`
      ${demoBanner(t)}
      <h2>${t.inventoryHeading}</h2>
      ${this.items.length === 0 ? html`<p class="muted">${t.inventoryEmpty}</p>` : nothing}
      <ul class="list">
        ${this.items.map((item) => this._renderItem(item))}
      </ul>
    `;
  }

  private _renderItem(item: InventoryItem) {
    const t = this.t;
    const d = item.description;
    const units = { hour: t.unitHour, minute: t.unitMinute, second: t.unitSecond };
    const aliasOf = (id: string) => this.items.find((i) => i.id === id)?.alias ?? id;
    const role = (r: Dependency["role"]) => (r === "trigger" ? t.roleTrigger : t.roleCondition);
    const sentences = [
      ...this.dependencies
        .filter((dep) => dep.from === item.id)
        .map((dep) =>
          t.writesFor(this.stateLabelOf(dep.placeId), aliasOf(dep.to), role(dep.role)),
        ),
      ...this.dependencies
        .filter((dep) => dep.to === item.id)
        .map((dep) =>
          t.readsFrom(this.stateLabelOf(dep.placeId), aliasOf(dep.from), role(dep.role)),
        ),
    ];
    return html`
      <li class="card">
        <div class="head">
          <h3>${item.alias}</h3>
          ${item.isNew ? html`<span class="badge proposal">${t.newBadge}</span>` : nothing}
        </div>
        <p class="summary">
          <span class="part">${d.triggers.map((x) => x.text).join(", ")}</span>
          <span class="arrow" aria-hidden="true">${t.summaryArrow}</span>
          <span class="part"
            >${d.effects
              .map((x) =>
                x.delay ? `${t.after(formatDuration(x.delay, units))}: ${x.text}` : x.text,
              )
              .join(", ")}</span
          >
        </p>
        <dl class="facts">
          <dt>${t.condition}</dt>
          <dd>${d.conditions.length ? d.conditions.map((x) => x.text).join(", ") : t.none}</dd>
          <dt>${d.rooms.length === 1 ? t.room : t.rooms}</dt>
          <dd>${d.rooms.length ? d.rooms.join(", ") : t.none}</dd>
          ${item.mode ? html`<dt>${t.modeLabel}</dt><dd>${item.mode}</dd>` : nothing}
          <dt>${t.dependenciesHeading}</dt>
          <dd>
            ${sentences.length === 0
              ? html`<span class="muted">${t.noDependencies}</span>`
              : sentences.map((s) => html`<div class="dep">${s}</div>`)}
          </dd>
        </dl>
        <div class="actions">
          <button
            type="button"
            class="secondary"
            @click=${() => fire(this, "focus-automation", { automationId: item.id })}
          >
            ${t.showInDomainView}
          </button>
        </div>
      </li>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }
      .head h3 {
        margin: 0;
        font-size: 16px;
      }
      .summary {
        margin: 0 0 12px;
        font-size: 15px;
      }
      .arrow {
        margin: 0 6px;
        color: var(--primary-color);
        font-weight: 500;
      }
      .facts {
        margin-bottom: 12px;
        font-size: 14px;
      }
      .actions {
        margin-top: 12px;
      }
      .dep + .dep {
        margin-top: 4px;
      }
    `,
  ];
}

customElements.define("ai-drafts-inventory", InventoryView);
