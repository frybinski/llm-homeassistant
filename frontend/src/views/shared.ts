import { type TemplateResult, css, html } from "lit";
import type { Strings } from "../localize";

/** Dispatch a bubbling event that crosses shadow roots. */
export function fire<T>(el: HTMLElement, name: string, detail?: T): void {
  el.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
}

/** The visible demo marking, shown at the top of every view. */
export function demoBanner(t: Strings): TemplateResult {
  return html`
    <div class="demo-banner" role="note">
      <span class="demo-tag">${t.demoTitle}</span>
      <span>${t.demoText}</span>
    </div>
  `;
}

/** An mdi icon. `ha-icon` is part of Home Assistant's frontend and defined when the panel loads. */
export function icon(name: string): TemplateResult {
  return html`<ha-icon icon=${name}></ha-icon>`;
}

export const sharedStyles = css`
  :host {
    display: block;
    color: var(--primary-text-color);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 500;
  }
  h3 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 500;
  }
  p {
    margin: 0 0 8px;
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .demo-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-bottom: 16px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--primary-text-color);
    background-color: var(--secondary-background-color);
    border: 1px dashed var(--warning-color, var(--primary-color));
    border-radius: 8px;
  }
  .demo-tag {
    padding: 1px 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--text-primary-color);
    background-color: var(--warning-color, var(--primary-color));
    border-radius: 10px;
  }
  .card {
    margin-bottom: 16px;
    padding: 16px;
    background-color: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
  }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    color: var(--primary-text-color);
    background-color: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 12px;
  }
  .badge.applied,
  .badge.checked {
    border-color: var(--success-color, var(--primary-color));
  }
  .badge.failed,
  .badge.error {
    border-color: var(--error-color);
  }
  .badge.warning {
    border-color: var(--warning-color);
  }
  .badge.discarded,
  .badge.reverted,
  .badge.info {
    border-color: var(--secondary-text-color);
  }
  .badge.proposal {
    color: var(--text-primary-color);
    background-color: var(--primary-color);
    border-color: var(--primary-color);
  }
  button {
    font: inherit;
    padding: 8px 16px;
    cursor: pointer;
    color: var(--text-primary-color);
    background-color: var(--primary-color);
    border: 1px solid var(--primary-color);
    border-radius: 8px;
  }
  button.secondary {
    color: var(--primary-color);
    background-color: transparent;
    border-color: var(--primary-color);
  }
  button.danger {
    color: var(--error-color);
    background-color: transparent;
    border-color: var(--error-color);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  dl.facts {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 0;
  }
  dl.facts dt {
    color: var(--secondary-text-color);
  }
  dl.facts dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  @media (max-width: 480px) {
    dl.facts {
      grid-template-columns: 1fr;
      gap: 0;
    }
    dl.facts dd {
      margin-bottom: 8px;
    }
  }
`;
