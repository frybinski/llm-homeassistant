import { type TemplateResult, css, html } from "lit";
import { type Strings, statusLabel } from "../localize";
import type { ApiError } from "../api";

/** Dispatch a bubbling event that crosses shadow roots. */
export function fire<T>(el: HTMLElement, name: string, detail?: T): void {
  el.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
}

/** The visible demo marking, shown at the top of every example view. */
export function demoBanner(t: Strings): TemplateResult {
  return html`
    <div class="demo-banner" role="note">
      ${icon("mdi:flask-outline")}
      <span class="demo-tag">${t.demoTitle}</span>
      <span class="demo-text">${t.demoText}</span>
    </div>
  `;
}

/** Icon of a change set status. The status is always also written out next to it. */
export function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    draft: "mdi:pencil-outline",
    checked: "mdi:shield-check-outline",
    failed: "mdi:alert-circle-outline",
    applied: "mdi:check-circle-outline",
    reverted: "mdi:undo-variant",
    discarded: "mdi:close-circle-outline",
  };
  return icons[status] ?? "mdi:circle-outline";
}

/** Icon of a finding severity. */
export function severityIcon(severity: string): string {
  return severity === "error"
    ? "mdi:alert-circle"
    : severity === "warning"
      ? "mdi:alert"
      : "mdi:information";
}

/** The status of a change set: icon, colour and the written status name. */
export function statusBadge(t: Strings, status: string): TemplateResult {
  return html`<span class="badge ${status}">${icon(statusIcon(status))}${statusLabel(t, status)}</span>`;
}

function errorLead(t: Strings, code: string): string {
  const leads: Record<string, string> = {
    busy: t.errBusy,
    model_error: t.errModel,
    invalid_model: t.errInvalidModel,
    not_loaded: t.errNotLoaded,
    apply_blocked: t.errApplyBlocked,
    apply_failed: t.errApplyFailed,
    revert_refused: t.errRevertRefused,
    wrong_state: t.errWrongState,
    not_found: t.errNotFound,
  };
  return leads[code] ?? t.errUnknown;
}

/** A backend error: what it means for the user, then the backend's own message. */
export function errorBox(t: Strings, err: ApiError): TemplateResult {
  return html`
    <div class="alert error" role="alert">
      ${icon("mdi:alert-circle")}
      <div class="alert-body">
        <p>${errorLead(t, err.code)}</p>
        <p class="detail">${err.message}</p>
        <p class="detail code">${t.errorCode}: ${err.code}</p>
      </div>
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
    font-size: 14px;
    line-height: 1.5;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.3;
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
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  ha-icon {
    --mdc-icon-size: 20px;
    flex: none;
  }
  /* Example data banner: one quiet line, still clearly marked. */
  .demo-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
    margin-bottom: 16px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--secondary-text-color);
    border: 1px dashed var(--warning-color, var(--divider-color));
    border-radius: 8px;
  }
  .demo-banner ha-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, var(--secondary-text-color));
  }
  .demo-tag {
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.7;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--warning-color, var(--primary-color)) 22%, transparent);
    border: 1px solid var(--warning-color, var(--primary-color));
    border-radius: 10px;
  }
  .demo-text {
    flex: 1 1 260px;
  }
  .card {
    margin-bottom: 16px;
    padding: 20px;
    background-color: var(--ha-card-background, var(--card-background-color));
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color));
    border-radius: var(--ha-card-border-radius, 12px);
    box-shadow: var(--ha-card-box-shadow, none);
  }
  @media (max-width: 480px) {
    .card {
      padding: 16px;
    }
  }
  /* Alert rows: icon and colour by kind, the kind is also written out. */
  .alert {
    --alert-color: var(--info-color, var(--primary-color));
    display: flex;
    gap: 12px;
    margin: 12px 0 0;
    padding: 12px 16px;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--alert-color) 12%, var(--card-background-color, transparent));
    border: 1px solid color-mix(in srgb, var(--alert-color) 45%, transparent);
    border-inline-start: 4px solid var(--alert-color);
    border-radius: 8px;
  }
  .alert > ha-icon {
    margin-top: 1px;
    color: var(--alert-color);
  }
  .alert.error {
    --alert-color: var(--error-color);
  }
  .alert.warning {
    --alert-color: var(--warning-color);
  }
  .alert.success {
    --alert-color: var(--success-color, var(--primary-color));
  }
  .alert-body {
    flex: 1;
    min-width: 0;
  }
  .alert-body p:last-child {
    margin-bottom: 0;
  }
  .alert .detail {
    margin-bottom: 4px;
    color: var(--secondary-text-color);
    font-family: var(--code-font-family, monospace);
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .alert button {
    margin-top: 4px;
  }
  /* Status badge: tinted pill, coloured icon, text in the normal text colour. */
  .badge {
    --badge-color: var(--secondary-text-color);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px 2px 6px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    white-space: nowrap;
    color: var(--primary-text-color);
    background-color: color-mix(in srgb, var(--badge-color) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
    border-radius: 999px;
  }
  .badge ha-icon {
    --mdc-icon-size: 16px;
    color: var(--badge-color);
  }
  .badge.checked,
  .badge.proposal {
    --badge-color: var(--primary-color);
  }
  .badge.applied {
    --badge-color: var(--success-color, var(--primary-color));
  }
  .badge.failed,
  .badge.error {
    --badge-color: var(--error-color);
  }
  .badge.draft,
  .badge.warning {
    --badge-color: var(--warning-color);
  }
  .badge.info {
    --badge-color: var(--info-color, var(--primary-color));
  }
  /* Buttons: native-looking pills. Primary is filled, secondary outlined. */
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    box-sizing: border-box;
    padding: 0 20px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-primary-color);
    /* Darkened a little so the label keeps its contrast on bright primary colours. */
    background-color: color-mix(in srgb, var(--primary-color) 74%, black);
    border: 1px solid color-mix(in srgb, var(--primary-color) 74%, black);
    border-radius: var(--ha-button-border-radius, 999px);
  }
  button:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  button.secondary,
  button.danger {
    color: var(--primary-text-color);
    background-color: transparent;
    border-color: var(--outline-color, var(--divider-color));
  }
  button.secondary:hover:not(:disabled),
  button.danger:hover:not(:disabled) {
    filter: none;
    background-color: var(--secondary-background-color);
  }
  button.secondary ha-icon {
    color: var(--primary-color);
  }
  button.danger {
    color: var(--error-color);
    border-color: var(--error-color);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  button:focus-visible,
  textarea:focus-visible,
  select:focus-visible,
  summary:focus-visible,
  a:focus-visible,
  pre:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* Segmented control for switching between two representations. */
  .segmented {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    background-color: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 999px;
  }
  .segmented button {
    min-height: 32px;
    padding: 0 16px;
    color: var(--secondary-text-color);
    background: transparent;
    border-color: transparent;
    border-radius: 999px;
  }
  .segmented button.on {
    color: var(--primary-text-color);
    background-color: var(--card-background-color);
    border-color: var(--divider-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .segmented button:hover:not(:disabled) {
    filter: none;
    color: var(--primary-text-color);
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
