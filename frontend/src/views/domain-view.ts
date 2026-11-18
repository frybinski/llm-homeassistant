import { LitElement, css, html, nothing, svg } from "lit";
import { type Strings, stateLabel } from "../localize";
import { type HouseLayout, HUB_H, HUB_W, TILE_H, TILE_W } from "../logic/house-layout";
import { layoutHouse } from "../logic/house-layout";
import { PLACE_R, TRANS_H, TRANS_W, layoutNet } from "../logic/net-layout";
import type { AutomationInfo, Marks } from "../logic/net";
import type { House, Net } from "../model";
import { demoBanner, fire, sharedStyles } from "./shared";

export interface DomainAutomation {
  info: AutomationInfo;
  alias: string;
  /** True for the example proposal, which is drawn highlighted. */
  isProposal: boolean;
}

export type DomainMode = "house" | "net";

export class DomainView extends LitElement {
  static override properties = {
    t: { attribute: false },
    language: { attribute: false },
    house: { attribute: false },
    net: { attribute: false },
    automations: { attribute: false },
    marks: { attribute: false },
    focusId: { attribute: false },
    mode: { attribute: false },
  };

  declare t: Strings;
  declare language: string | undefined;
  declare house: House;
  declare net: Net;
  declare automations: DomainAutomation[];
  declare marks: Marks;
  declare focusId: string | null;
  declare mode: DomainMode;

  private _layout: HouseLayout | null = null;
  private _layoutKey: unknown[] = [];

  protected override willUpdate(): void {
    const key = [this.house, this.automations, this.t];
    if (!this._layout || key.some((k, i) => k !== this._layoutKey[i])) {
      this._layoutKey = key;
      this._layout = layoutHouse(
        this.house,
        this.automations.map((a) => a.info),
        (id) => this._alias(id),
        (transitionId) =>
          this.automations
            .flatMap((a) => a.info.triggers)
            .find((x) => x.transitionId === transitionId)?.label ?? "",
      );
    }
  }

  private _alias(id: string): string {
    return this.automations.find((a) => a.info.id === id)?.alias ?? id;
  }

  private get _hasMarks(): boolean {
    const m = this.marks;
    return m.entityIds.size + m.automationIds.size + m.placeIds.size + m.transitionIds.size > 0;
  }

  protected override render() {
    const t = this.t;
    return html`
      ${demoBanner(t)}
      <div class="toolbar">
        <div class="segmented" role="group" aria-label=${t.viewMode}>
          ${(["house", "net"] as const).map(
            (m) => html`<button
              type="button"
              class=${this.mode === m ? "on" : ""}
              aria-pressed=${this.mode === m ? "true" : "false"}
              @click=${() => fire(this, "set-mode", { mode: m })}
            >
              ${m === "house" ? t.viewHouse : t.viewNet}
            </button>`,
          )}
        </div>
        ${this._hasMarks
          ? nothing
          : html`<button type="button" class="secondary" @click=${() => fire(this, "mark-example")}>
              ${t.markExample}
            </button>`}
        ${this._hasMarks
          ? html`<span class="chip marked">
              ${t.marksActive}
              <button type="button" class="link" @click=${() => fire(this, "clear-marks")}>
                ${t.clear}
              </button>
            </span>`
          : nothing}
        ${this.focusId
          ? html`<span class="chip">
              ${t.focusActive(this._alias(this.focusId))}
              <button type="button" class="link" @click=${() => fire(this, "clear-focus")}>
                ${t.clear}
              </button>
            </span>`
          : nothing}
      </div>
      ${this.mode === "house" ? this._renderHouse() : this._renderNet()}
    `;
  }

  // --- House ---------------------------------------------------------------

  private _renderHouse() {
    const t = this.t;
    const layout = this._layout;
    if (!layout) return nothing;
    const focus = this.focusId;
    const focusTiles = new Set(
      layout.edges.filter((e) => e.automationId === focus).map((e) => e.tileKey),
    );
    const proposalIds = new Set(this.automations.filter((a) => a.isProposal).map((a) => a.info.id));
    const dimmed = (aid: string) => focus !== null && aid !== focus;
    return html`
      <div class="scroll">
        <svg
          class="diagram house"
          viewBox="0 0 ${layout.width} ${layout.height}"
          style="width:100%;min-width:${Math.round(layout.width * 0.7)}px;max-width:${layout.width}px"
          role="img"
          aria-label=${t.houseLabel}
        >
          ${this._markers()}
          ${layout.rooms.map(
            (r) => svg`
              <g class="room">
                <rect x=${r.x} y=${r.y} width=${r.w} height=${r.h} rx="12"></rect>
                <text class="room-name" x=${r.x + 14} y=${r.y + 23}>${r.name ?? t.noRoom}</text>
              </g>`,
          )}
          ${layout.edges.map(
            (e) => svg`
              <path
                class="edge ${e.kind} ${proposalIds.has(e.automationId) ? "proposal" : ""} ${dimmed(e.automationId) ? "dim" : ""}"
                d=${e.d}
                marker-end=${e.kind === "condition" ? "url(#m-cond)" : "url(#m-arrow)"}
              ></path>`,
          )}
          ${layout.tiles.map((tile) => {
            const marked = tile.entityId !== null && this.marks.entityIds.has(tile.entityId);
            const faded = focus !== null && !focusTiles.has(tile.key);
            return svg`
              <g class="tile ${marked ? "marked" : ""} ${faded ? "dim" : ""}">
                ${marked ? svg`<rect class="halo" x=${tile.x - 4} y=${tile.y - 4} width=${TILE_W + 8} height=${TILE_H + 8} rx="12"></rect>` : nothing}
                <rect class="tile-box" x=${tile.x} y=${tile.y} width=${TILE_W} height=${TILE_H} rx="8"></rect>
                <foreignObject x=${tile.x + 8} y=${tile.y + (TILE_H - 28) / 2} width="28" height="28">
                  <div class="icon-wrap"><ha-icon icon=${tile.icon}></ha-icon></div>
                </foreignObject>
                <text class="tile-name" x=${tile.x + 42} y=${tile.state ? tile.y + 22 : tile.y + 31}>${clip(tile.name, 18)}</text>
                ${tile.state ? svg`<text class="tile-state" x=${tile.x + 42} y=${tile.y + 40}>${stateLabel(this.language, tile.state)}</text>` : nothing}
              </g>`;
          })}
          ${layout.hubs.map((hub) => {
            const auto = this.automations.find((a) => a.info.id === hub.automationId);
            const proposal = auto?.isProposal ?? false;
            const marked = this.marks.automationIds.has(hub.automationId);
            const lineH = 15;
            const top = hub.y + (HUB_H - hub.lines.length * lineH) / 2 + 11;
            return svg`
              <g
                class="hub ${proposal ? "proposal" : ""} ${marked ? "marked" : ""} ${dimmed(hub.automationId) ? "dim" : ""} ${focus === hub.automationId ? "focused" : ""}"
                tabindex="0"
                role="button"
                aria-label=${this._alias(hub.automationId)}
                @click=${() => fire(this, "focus-automation", { automationId: hub.automationId, toggle: true })}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fire(this, "focus-automation", { automationId: hub.automationId, toggle: true });
                  }
                }}
              >
                ${marked ? svg`<rect class="halo" x=${hub.x - 4} y=${hub.y - 4} width=${HUB_W + 8} height=${HUB_H + 8} rx="14"></rect>` : nothing}
                <rect class="hub-box" x=${hub.x} y=${hub.y} width=${HUB_W} height=${HUB_H} rx="12"></rect>
                ${hub.lines.map((line, i) => svg`<text class="hub-text" x=${hub.x + HUB_W / 2} y=${top + i * lineH}>${line}</text>`)}
                ${proposal
                  ? svg`<g class="badge-svg">
                      <rect x=${hub.x + HUB_W - 74} y=${hub.y - 9} width="70" height="18" rx="9"></rect>
                      <text x=${hub.x + HUB_W - 39} y=${hub.y + 4}>${t.proposalBadge}</text>
                    </g>`
                  : nothing}
              </g>`;
          })}
        </svg>
      </div>
      ${this._legend(false)}
    `;
  }

  // --- Net -----------------------------------------------------------------

  private _renderNet() {
    const t = this.t;
    let list = this.automations;
    if (this.focusId) list = list.filter((a) => a.info.id === this.focusId);
    else if (this._hasMarks) {
      const rank = (a: DomainAutomation) => (this.marks.automationIds.has(a.info.id) ? 0 : 1);
      list = [...list].sort((a, b) => rank(a) - rank(b));
    }
    return html`
      <h2 class="net-heading">${t.netHeading}</h2>
      <p class="muted">${t.netHint}</p>
      ${list.map((a) => this._renderDiagram(a))} ${this._legend(true)}
    `;
  }

  private _renderDiagram(auto: DomainAutomation) {
    const t = this.t;
    const d = layoutNet(this.net, auto.info.id);
    const annotationLabel: Record<string, string> = {
      mode: t.annotationMode,
      delay: t.annotationDelay,
      event: t.annotationEvent,
      guard: t.annotationGuard,
    };
    const nodeMarked = (id: string) => this.marks.placeIds.has(id) || this.marks.transitionIds.has(id);
    return html`
      <section class="card net-card ${auto.isProposal ? "proposal" : ""}">
        <div class="net-head">
          <h3>${auto.alias}</h3>
          ${auto.isProposal ? html`<span class="badge proposal">${t.proposalBadge}</span>` : nothing}
        </div>
        <div class="scroll">
          <svg
            class="diagram net"
            viewBox="0 0 ${d.width} ${d.height}"
            style="width:100%;min-width:${Math.round(d.width * 0.75)}px;max-width:${d.width}px"
            role="img"
            aria-label=${t.netLabel(auto.alias)}
          >
            ${this._markers()}
            ${d.edges.map((e) => {
              const marked = nodeMarked(e.source) && nodeMarked(e.target);
              return svg`<path class="arc ${e.kind} ${marked ? "marked" : ""}" d=${e.d} marker-end="url(#m-${e.kind})"></path>`;
            })}
            ${d.nodes.map((n) => {
              const marked = nodeMarked(n.id);
              const labelTop = n.y + 40;
              const ann = n.annotations.map(
                (a) => `${annotationLabel[a.type] ?? a.type}: ${a.value}`,
              );
              const shape =
                n.shape === "place"
                  ? svg`<circle class="place ${n.kind}" cx=${n.x} cy=${n.y} r=${PLACE_R}></circle>`
                  : svg`<rect class="trans ${n.kind}" x=${n.x - TRANS_W / 2} y=${n.y - TRANS_H / 2} width=${TRANS_W} height=${TRANS_H} rx="3"></rect>`;
              const halo = marked
                ? n.shape === "place"
                  ? svg`<circle class="halo" cx=${n.x} cy=${n.y} r=${PLACE_R + 5}></circle>`
                  : svg`<rect class="halo" x=${n.x - TRANS_W / 2 - 5} y=${n.y - TRANS_H / 2 - 5} width=${TRANS_W + 10} height=${TRANS_H + 10} rx="6"></rect>`
                : nothing;
              return svg`
                <g class="node ${marked ? "marked" : ""}">
                  ${halo}${shape}
                  ${n.lines.map((l, i) => svg`<text class="node-label" x=${n.x} y=${labelTop + i * 14}>${l}</text>`)}
                  ${ann.map((a, i) => svg`<text class="node-ann" x=${n.x} y=${labelTop + n.lines.length * 14 + 2 + i * 13}>${a}</text>`)}
                </g>`;
            })}
          </svg>
        </div>
      </section>
    `;
  }

  // --- Shared pieces -------------------------------------------------------

  private _markers() {
    return svg`
      <defs>
        <marker id="m-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path class="mk-arrow" d="M0,1 L9,5 L0,9 z"></path>
        </marker>
        <marker id="m-cond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
          <circle class="mk-dot" cx="5" cy="5" r="3.5"></circle>
        </marker>
        <marker id="m-consume" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path class="mk-consume" d="M0,1 L9,5 L0,9 z"></path>
        </marker>
        <marker id="m-produce" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
          <path class="mk-produce" d="M0,0.5 L9.5,5 L0,9.5 z"></path>
        </marker>
        <marker id="m-read" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
          <circle class="mk-read" cx="5" cy="5" r="3.5"></circle>
        </marker>
      </defs>`;
  }

  private _legend(net: boolean) {
    const t = this.t;
    const line = (cls: string, marker: string) => svg`
      <svg class="sample" width="48" height="16" viewBox="0 0 48 16" aria-hidden="true">
        ${this._markers()}
        <path class=${cls} d="M2,8 L44,8" marker-end=${marker}></path>
      </svg>`;
    return html`
      <section class="legend" aria-label=${t.legendHeading}>
        <h3>${t.legendHeading}</h3>
        <ul>
          ${net
            ? html`
                <li>${line("arc read", "url(#m-read)")}${t.legendRead}</li>
                <li>${line("arc consume", "url(#m-consume)")}${t.legendConsume}</li>
                <li>${line("arc produce", "url(#m-produce)")}${t.legendProduce}</li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle class="place state" cx="11" cy="11" r="9"></circle>
                  </svg>
                  ${t.legendPlaceState}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <circle class="place control" cx="11" cy="11" r="9"></circle>
                  </svg>
                  ${t.legendPlaceControl}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <rect class="trans trigger" x="3" y="3" width="16" height="16" rx="2"></rect>
                  </svg>
                  ${t.trigger}
                </li>
                <li>
                  <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                    <rect class="trans action" x="3" y="3" width="16" height="16" rx="2"></rect>
                  </svg>
                  ${t.effect}
                </li>
              `
            : html`
                <li>${line("edge trigger", "url(#m-arrow)")}${t.trigger} / ${t.effect}</li>
                <li>${line("edge condition", "url(#m-cond)")}${t.legendCondition}</li>
                <li>${line("edge trigger proposal", "url(#m-arrow)")}${t.legendProposal}</li>
              `}
          <li>
            <svg class="sample" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <rect class="halo" x="3" y="3" width="16" height="16" rx="4"></rect>
            </svg>
            ${t.legendMarked}
          </li>
        </ul>
      </section>
    `;
  }

  static override styles = [
    sharedStyles,
    css`
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin-bottom: 12px;
      }
      .segmented {
        display: inline-flex;
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        overflow: hidden;
      }
      .segmented button {
        border: none;
        border-radius: 0;
        color: var(--primary-color);
        background: transparent;
      }
      .segmented button.on {
        color: var(--text-primary-color);
        background-color: var(--primary-color);
      }
      .chip {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        padding: 4px 12px;
        font-size: 13px;
        background-color: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 16px;
      }
      .chip.marked {
        border-color: var(--warning-color);
      }
      button.link {
        padding: 0;
        color: var(--primary-color);
        background: none;
        border: none;
        text-decoration: underline;
      }
      .scroll {
        overflow-x: auto;
      }
      svg.diagram {
        display: block;
        height: auto;
        font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      }
      /* House */
      .room rect {
        fill: var(--secondary-background-color);
        stroke: var(--divider-color);
        stroke-width: 1.5;
      }
      .room-name {
        font-size: 14px;
        font-weight: 500;
        fill: var(--primary-text-color);
      }
      .tile-box {
        fill: var(--card-background-color);
        stroke: var(--divider-color);
        stroke-width: 1.5;
      }
      .tile-name {
        font-size: 12px;
        fill: var(--primary-text-color);
      }
      .tile-state {
        font-size: 12px;
        fill: var(--secondary-text-color);
      }
      .icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        color: var(--primary-color);
      }
      .icon-wrap ha-icon {
        --mdc-icon-size: 24px;
      }
      .hub-box {
        fill: var(--card-background-color);
        stroke: var(--secondary-text-color);
        stroke-width: 1.5;
      }
      .hub {
        cursor: pointer;
      }
      .hub:focus-visible .hub-box,
      .hub.focused .hub-box {
        stroke: var(--primary-color);
        stroke-width: 3;
      }
      .hub-text {
        font-size: 13px;
        text-anchor: middle;
        fill: var(--primary-text-color);
        pointer-events: none;
      }
      .hub.proposal .hub-box {
        stroke: var(--primary-color);
        stroke-width: 2.5;
        stroke-dasharray: 6 4;
      }
      .badge-svg rect {
        fill: var(--primary-color);
      }
      .badge-svg text {
        font-size: 11px;
        font-weight: 500;
        text-anchor: middle;
        fill: var(--text-primary-color);
      }
      .edge {
        fill: none;
        stroke: var(--secondary-text-color);
        stroke-width: 1.6;
      }
      .edge.condition {
        stroke-dasharray: 5 4;
      }
      .edge.proposal {
        stroke: var(--primary-color);
        stroke-width: 2.2;
        stroke-dasharray: 6 4;
      }
      .halo {
        fill: none;
        stroke: var(--warning-color);
        stroke-width: 3;
      }
      .dim {
        opacity: 0.22;
      }
      .mk-arrow,
      .mk-dot {
        fill: var(--secondary-text-color);
      }
      .mk-consume {
        fill: var(--secondary-text-color);
      }
      .mk-produce {
        fill: var(--primary-color);
      }
      .mk-read {
        fill: var(--card-background-color);
        stroke: var(--secondary-text-color);
        stroke-width: 1.5;
      }
      /* Net */
      .net-heading {
        margin-top: 4px;
      }
      .net-card.proposal {
        border-color: var(--primary-color);
        border-style: dashed;
      }
      .net-head {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .net-head h3 {
        margin: 0;
      }
      .place {
        fill: var(--card-background-color);
        stroke: var(--primary-text-color);
        stroke-width: 1.8;
      }
      .place.control {
        fill: var(--secondary-background-color);
        stroke-dasharray: 4 3;
      }
      .trans {
        stroke: var(--primary-text-color);
        stroke-width: 1.8;
        fill: var(--card-background-color);
      }
      .trans.action {
        fill: var(--primary-text-color);
      }
      .node-label {
        font-size: 12px;
        text-anchor: middle;
        fill: var(--primary-text-color);
      }
      .node-ann {
        font-size: 11px;
        font-style: italic;
        text-anchor: middle;
        fill: var(--secondary-text-color);
      }
      .arc {
        fill: none;
        stroke: var(--secondary-text-color);
        stroke-width: 1.6;
      }
      .arc.read {
        stroke-dasharray: 5 4;
      }
      .arc.produce {
        stroke: var(--primary-color);
        stroke-width: 2.6;
      }
      .arc.marked {
        stroke: var(--warning-color);
      }
      /* Legend */
      .legend {
        margin-top: 16px;
        padding: 12px 16px;
        background-color: var(--card-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        font-size: 13px;
      }
      .legend h3 {
        font-size: 13px;
        color: var(--secondary-text-color);
      }
      .legend ul {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .legend li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sample .edge,
      .sample .arc {
        fill: none;
      }
    `,
  ];
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

customElements.define("ai-drafts-domain", DomainView);
