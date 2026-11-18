/** Types of the example data and of the change set JSON (PLAN.md section 3). */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type Severity = "error" | "warning" | "info";

export type ChangeSetStatus =
  | "draft"
  | "checked"
  | "failed"
  | "applied"
  | "reverted"
  | "discarded";

export interface Finding {
  severity: Severity;
  check: string;
  message: string;
  path: string | null;
  net_refs: string[];
}

export interface Operation {
  kind: string;
  op: "create" | "update" | "delete";
  target_id: string | null;
  before: { [key: string]: Json } | null;
  after: { [key: string]: Json } | null;
}

export interface ChangeSet {
  id: string;
  request: string;
  status: ChangeSetStatus;
  operations: Operation[];
  findings: Finding[];
  model: string | null;
  rounds: number;
  created: string;
  decided: string | null;
}

export interface Area {
  id: string;
  name: string;
  icon: string;
}

export interface HouseEntity {
  entity_id: string;
  name: string;
  icon: string;
  state: string;
  area_id: string | null;
}

export interface House {
  areas: Area[];
  entities: HouseEntity[];
}

/** An automation in Home Assistant's config format (the part the panel reads). */
export interface AutomationConfig {
  id: string;
  alias: string;
  mode: string;
  triggers: Json[];
  conditions: Json[];
  actions: Json[];
}

/** Net format version 0 (provisional), see demo/README.md. */
export interface NetOrigin {
  automation_id?: string;
  path?: string;
  entity_id?: string;
  area_id?: string;
}

export interface NetAnnotation {
  type: string;
  value: string;
}

export interface NetPlace {
  id: string;
  kind: "state" | "control";
  entity_id?: string;
  state?: string;
  label: string;
  origin: NetOrigin;
}

export interface NetTransition {
  id: string;
  kind: "trigger" | "action";
  label: string;
  origin: NetOrigin;
  annotations: NetAnnotation[];
}

export interface NetArc {
  source: string;
  target: string;
  kind: "read" | "consume" | "produce";
}

export interface Net {
  format: string;
  version: number;
  places: NetPlace[];
  transitions: NetTransition[];
  arcs: NetArc[];
}
