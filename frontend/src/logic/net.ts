/**
 * Pure functions on the net (format version 0). The house relations of the
 * domain view and the inventory are derived here from the net and its origin
 * references, never from the automation configs.
 */
import type { Net, NetArc, NetPlace, NetTransition } from "../model";

export function mergeNets(...nets: Net[]): Net {
  return {
    format: nets[0].format,
    version: nets[0].version,
    places: nets.flatMap((n) => n.places),
    transitions: nets.flatMap((n) => n.transitions),
    arcs: nets.flatMap((n) => n.arcs),
  };
}

export interface TriggerInfo {
  transitionId: string;
  label: string;
  /** The entity whose state change triggers; null for events such as a time. */
  entityId: string | null;
  areaId: string | null;
  placeId: string | null;
  event: string | null;
}

export interface ConditionInfo {
  placeId: string;
  label: string;
  entityId: string;
  areaId: string | null;
}

export interface EffectInfo {
  transitionId: string;
  label: string;
  entityId: string;
  areaId: string | null;
  /** The state place this step produces. */
  placeId: string;
  delay: string | null;
}

export interface AutomationInfo {
  id: string;
  mode: string | null;
  triggers: TriggerInfo[];
  conditions: ConditionInfo[];
  effects: EffectInfo[];
  /** State places read by triggers and conditions. */
  reads: string[];
  /** State places written by actions. */
  writes: string[];
}

export interface Dependency {
  /** The automation that writes the state. */
  from: string;
  /** The automation that reads it. */
  to: string;
  placeId: string;
  role: "trigger" | "condition";
}

function annotation(t: NetTransition, type: string): string | null {
  return t.annotations.find((a) => a.type === type)?.value ?? null;
}

/** One entry per automation, in order of first appearance in the net. */
export function deriveAutomations(net: Net): AutomationInfo[] {
  const places = new Map<string, NetPlace>(net.places.map((p) => [p.id, p]));
  const infos = new Map<string, AutomationInfo>();
  const arcsByTransition = new Map<string, NetArc[]>();
  for (const arc of net.arcs) {
    const tid = arc.kind === "produce" ? arc.source : arc.target;
    const list = arcsByTransition.get(tid) ?? [];
    list.push(arc);
    arcsByTransition.set(tid, list);
  }

  for (const t of net.transitions) {
    const aid = t.origin.automation_id;
    if (!aid) continue;
    let info = infos.get(aid);
    if (!info) {
      info = {
        id: aid,
        mode: null,
        triggers: [],
        conditions: [],
        effects: [],
        reads: [],
        writes: [],
      };
      infos.set(aid, info);
    }
    const arcs = arcsByTransition.get(t.id) ?? [];
    if (t.kind === "trigger") {
      info.mode ??= annotation(t, "mode");
      const reads = arcs
        .filter((a) => a.kind === "read")
        .map((a) => places.get(a.source))
        .filter((p): p is NetPlace => p?.kind === "state");
      // A read arc from the trigger's own entity is the trigger; any other
      // read arc is a condition (see the known simplifications in demo/README).
      const own = reads.find((p) => p.entity_id === t.origin.entity_id);
      info.triggers.push({
        transitionId: t.id,
        label: t.label,
        entityId: t.origin.entity_id ?? null,
        areaId: t.origin.area_id ?? null,
        placeId: own?.id ?? null,
        event: annotation(t, "event"),
      });
      for (const p of reads) {
        if (p === own) continue;
        if (info.conditions.some((c) => c.placeId === p.id)) continue;
        info.conditions.push({
          placeId: p.id,
          label: p.label,
          entityId: p.entity_id ?? "",
          areaId: p.origin.area_id ?? null,
        });
      }
    } else {
      for (const arc of arcs) {
        const target = places.get(arc.target);
        if (arc.kind !== "produce" || target?.kind !== "state") continue;
        info.effects.push({
          transitionId: t.id,
          label: t.label,
          entityId: target.entity_id ?? "",
          areaId: target.origin.area_id ?? null,
          placeId: target.id,
          delay: annotation(t, "delay"),
        });
      }
    }
  }

  for (const info of infos.values()) {
    info.reads = unique([
      ...info.triggers.flatMap((t) => (t.placeId ? [t.placeId] : [])),
      ...info.conditions.map((c) => c.placeId),
    ]);
    info.writes = unique(info.effects.map((e) => e.placeId));
  }
  return [...infos.values()];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** A depends on B when A writes a state place that B reads. */
export function deriveDependencies(infos: AutomationInfo[]): Dependency[] {
  const result: Dependency[] = [];
  for (const writer of infos) {
    for (const reader of infos) {
      if (writer.id === reader.id) continue;
      for (const placeId of writer.writes) {
        if (!reader.reads.includes(placeId)) continue;
        const isTrigger = reader.triggers.some((t) => t.placeId === placeId);
        result.push({
          from: writer.id,
          to: reader.id,
          placeId,
          role: isTrigger ? "trigger" : "condition",
        });
      }
    }
  }
  return result;
}

export interface Marks {
  entityIds: Set<string>;
  automationIds: Set<string>;
  placeIds: Set<string>;
  transitionIds: Set<string>;
}

/** Resolve net element ids (a finding's `net_refs`) to what the views mark. */
export function resolveMarks(net: Net, refs: readonly string[]): Marks {
  const marks: Marks = {
    entityIds: new Set(),
    automationIds: new Set(),
    placeIds: new Set(),
    transitionIds: new Set(),
  };
  const places = new Map(net.places.map((p) => [p.id, p]));
  const transitions = new Map(net.transitions.map((t) => [t.id, t]));
  for (const ref of refs) {
    const element = places.get(ref) ?? transitions.get(ref);
    if (!element) continue;
    if (places.has(ref)) marks.placeIds.add(ref);
    else marks.transitionIds.add(ref);
    if (element.origin.entity_id) marks.entityIds.add(element.origin.entity_id);
    if (element.origin.automation_id) {
      marks.automationIds.add(element.origin.automation_id);
    }
  }
  return marks;
}

export const NO_MARKS: Marks = {
  entityIds: new Set(),
  automationIds: new Set(),
  placeIds: new Set(),
  transitionIds: new Set(),
};
