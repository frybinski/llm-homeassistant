/**
 * Deterministic left-to-right layout of the net, one diagram per automation.
 * State places that several automations use are repeated in each diagram.
 * Pure functions; no DOM measuring.
 */
import type { Net, NetAnnotation, NetArc, NetPlace, NetTransition } from "../model";
import { wrapText } from "./text";

export const COL_W = 150;
export const ROW_H = 120;
export const PLACE_R = 20;
export const TRANS_W = 40;
export const TRANS_H = 40;
const PAD_X = 84;
const PAD_Y = 40;

export interface NetNode {
  id: string;
  shape: "place" | "transition";
  /** state and control places, trigger and action transitions. */
  kind: string;
  x: number;
  y: number;
  lines: string[];
  annotations: NetAnnotation[];
}

export interface NetEdge {
  source: string;
  target: string;
  kind: NetArc["kind"];
  d: string;
  /** True if the arc runs against the left-to-right direction. */
  back: boolean;
}

export interface NetDiagram {
  automationId: string;
  width: number;
  height: number;
  nodes: NetNode[];
  edges: NetEdge[];
}

/** The elements of one automation: its transitions and everything they touch. */
function subnet(net: Net, automationId: string) {
  const transitions = net.transitions.filter((t) => t.origin.automation_id === automationId);
  const tids = new Set(transitions.map((t) => t.id));
  const arcs = net.arcs.filter((a) => tids.has(a.kind === "produce" ? a.source : a.target));
  const pids = new Set(arcs.map((a) => (a.kind === "produce" ? a.target : a.source)));
  // The control places of the automation belong to it even without an arc.
  const places = net.places.filter(
    (p) => pids.has(p.id) || p.origin.automation_id === automationId,
  );
  return { transitions, arcs, places };
}

export function layoutNet(net: Net, automationId: string): NetDiagram {
  const { transitions, arcs, places } = subnet(net, automationId);
  const placeById = new Map(places.map((p) => [p.id, p]));
  const transById = new Map(transitions.map((t) => [t.id, t]));
  const col = new Map<string, number>();

  // Spine: triggers in column 1, then each action step two columns further,
  // with the control place between. Everything else is placed around it.
  const triggers = transitions.filter((t) => t.kind === "trigger");
  const actions = transitions.filter((t) => t.kind === "action");
  const spine = new Set<string>();
  triggers.forEach((t) => {
    col.set(t.id, 1);
    spine.add(t.id);
  });
  actions.forEach((t, k) => {
    col.set(t.id, 3 + 2 * k);
    spine.add(t.id);
  });
  for (const p of places) {
    if (p.kind !== "control") continue;
    const producers = arcs.filter((a) => a.kind === "produce" && a.target === p.id);
    const c = Math.max(0, ...producers.map((a) => col.get(a.source) ?? 0)) + 1;
    col.set(p.id, c);
    spine.add(p.id);
  }
  // State places: just left of their first consumer, else just right of their producer.
  for (const p of places) {
    if (p.kind !== "state") continue;
    const consumers = arcs.filter((a) => a.kind !== "produce" && a.source === p.id);
    const producers = arcs.filter((a) => a.kind === "produce" && a.target === p.id);
    if (consumers.length) {
      col.set(p.id, Math.min(...consumers.map((a) => col.get(a.target) ?? 1)) - 1);
    } else {
      col.set(p.id, Math.max(...producers.map((a) => col.get(a.source) ?? 0)) + 1);
    }
  }

  // Rows: the spine is the middle row, places that are only read sit above it,
  // all other state places below.
  const readOnly = (p: NetPlace) =>
    arcs.filter((a) => a.source === p.id || a.target === p.id).every((a) => a.kind === "read");
  const columns = new Map<number, { up: string[]; mid: string[]; down: string[] }>();
  const slot = (c: number) => {
    let entry = columns.get(c);
    if (!entry) {
      entry = { up: [], mid: [], down: [] };
      columns.set(c, entry);
    }
    return entry;
  };
  const order = [...transitions.map((t) => t.id), ...places.map((p) => p.id)];
  for (const id of order) {
    const c = col.get(id) ?? 0;
    const place = placeById.get(id);
    if (spine.has(id)) slot(c).mid.push(id);
    else if (place && readOnly(place)) slot(c).up.push(id);
    else slot(c).down.push(id);
  }
  const maxUp = Math.max(0, ...[...columns.values()].map((e) => e.up.length));
  const maxMid = Math.max(1, ...[...columns.values()].map((e) => e.mid.length));
  const maxDown = Math.max(0, ...[...columns.values()].map((e) => e.down.length));
  const midTop = PAD_Y + maxUp * ROW_H;

  const pos = new Map<string, { x: number; y: number }>();
  for (const [c, entry] of columns) {
    const x = PAD_X + c * COL_W;
    entry.up.forEach((id, i) => pos.set(id, { x, y: midTop - (entry.up.length - i) * ROW_H }));
    entry.mid.forEach((id, i) => pos.set(id, { x, y: midTop + i * ROW_H }));
    entry.down.forEach((id, i) => pos.set(id, { x, y: midTop + maxMid * ROW_H + i * ROW_H }));
  }

  const nodes: NetNode[] = [];
  const describe = (id: string): NetNode | null => {
    const at = pos.get(id);
    if (!at) return null;
    const place: NetPlace | undefined = placeById.get(id);
    const trans: NetTransition | undefined = transById.get(id);
    const label = place?.label ?? trans?.label ?? id;
    return {
      id,
      shape: place ? "place" : "transition",
      kind: place?.kind ?? trans?.kind ?? "",
      x: at.x,
      y: at.y,
      lines: wrapText(label, 22, 2),
      annotations: trans?.annotations ?? [],
    };
  };
  for (const id of order) {
    const node = describe(id);
    if (node) nodes.push(node);
  }

  const edges: NetEdge[] = [];
  for (const arc of arcs) {
    const a = pos.get(arc.source);
    const b = pos.get(arc.target);
    if (!a || !b) continue;
    const srcHalf = placeById.has(arc.source) ? PLACE_R : TRANS_W / 2;
    const dstHalf = placeById.has(arc.target) ? PLACE_R : TRANS_W / 2;
    const back = b.x <= a.x;
    const dir = back ? -1 : 1;
    // Leave and enter at the sides; a back arc loops below the diagram nodes.
    const x1 = a.x + dir * srcHalf;
    const x2 = b.x - dir * dstHalf;
    const dx = Math.max(24, Math.abs(x2 - x1) / 2);
    const bow = back ? ROW_H * 0.55 : 0;
    const d = `M${x1},${a.y} C${x1 + dir * dx},${a.y + bow} ${x2 - dir * dx},${b.y + bow} ${x2},${b.y}`;
    edges.push({ source: arc.source, target: arc.target, kind: arc.kind, d, back });
  }

  const maxCol = Math.max(0, ...[...col.values()]);
  return {
    automationId,
    width: PAD_X * 2 + maxCol * COL_W,
    height: midTop + (maxMid + maxDown) * ROW_H + PAD_Y,
    nodes,
    edges,
  };
}

/** The automation ids of a net, in order of first appearance. */
export function automationIdsOf(net: Net): string[] {
  return [...new Set(net.transitions.map((t) => t.origin.automation_id).filter((id): id is string => !!id))];
}
