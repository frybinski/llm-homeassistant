/**
 * Describes an automation config in house terms. Pure: no DOM, no `hass`.
 *
 * This reads the automation as Home Assistant stores it (`triggers`,
 * `conditions`, `actions`, and the older singular spellings). It does not know
 * the net, which only exists from milestone M2. Whatever it does not recognise
 * is returned as a YAML fragment with a label, never dropped and never guessed.
 */
import type { Json } from "../model";
import type { Strings } from "../localize";
import { stateLabel } from "../localize";
import { formatDuration } from "./text";
import { toYaml } from "./yaml";

export interface Fragment {
  label: string;
  yaml: string;
}

/** One line of the description, with the parts it could not put into words. */
export interface DescribedItem {
  text: string;
  fragments: Fragment[];
}

export interface AutomationDescription {
  alias: string | null;
  description: string | null;
  mode: string | null;
  triggers: DescribedItem[];
  conditions: DescribedItem[];
  actions: DescribedItem[];
  /** Top-level fields that are not part of the description. */
  other: Fragment[];
}

export interface DescribeContext {
  t: Strings;
  language: string | undefined;
  /** Friendly name of an entity; the id itself if it is unknown. */
  nameOf: (entityId: string) => string;
}

type Obj = { [key: string]: Json };

const isObj = (v: Json | undefined): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const BENIGN = ["id", "alias"];

function asList(v: Json | undefined): Json[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** A string or a list of strings; null for anything else. */
function strings(v: Json | undefined): string[] | null {
  const list = asList(v);
  if (list.length === 0 || !list.every((x) => typeof x === "string")) return null;
  return list as string[];
}

function quote(t: Strings, text: string): string {
  return t.quote(text);
}

function join(ctx: DescribeContext, items: string[], type: "conjunction" | "disjunction") {
  return new Intl.ListFormat(ctx.language, { style: "long", type }).format(items);
}

function units(t: Strings) {
  return { hour: t.unitHour, minute: t.unitMinute, second: t.unitSecond };
}

/** A state value as shown to a person: booleans of YAML become on and off. */
function stateText(ctx: DescribeContext, v: Json): string | null {
  if (typeof v === "boolean") return quote(ctx.t, stateLabel(ctx.language, v ? "on" : "off"));
  if (typeof v === "string" || typeof v === "number") {
    return quote(ctx.t, stateLabel(ctx.language, String(v)));
  }
  return null;
}

function stateList(ctx: DescribeContext, v: Json | undefined): string | null {
  const parts = asList(v).map((x) => stateText(ctx, x));
  if (parts.length === 0 || parts.some((p) => p === null)) return null;
  return join(ctx, parts as string[], "disjunction");
}

/** A duration given as "hh:mm:ss", as a mapping, or as seconds; null if unknown. */
export function durationText(ctx: DescribeContext, v: Json | undefined): string | null {
  const u = units(ctx.t);
  if (typeof v === "string") {
    const m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(v);
    if (!m) return null;
    return formatDuration(`${m[1]}:${m[2]}:${m[3] ?? "00"}`, u);
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0) return null;
    const total = Math.round(v);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return formatDuration(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, u);
  }
  if (isObj(v)) {
    const allowed = ["days", "hours", "minutes", "seconds", "milliseconds"];
    if (!Object.keys(v).every((k) => allowed.includes(k))) return null;
    if (!Object.values(v).every((x) => typeof x === "number")) return null;
    const n = (k: string) => Number(v[k] ?? 0);
    if (n("milliseconds") !== 0) return null;
    const seconds = n("days") * 86400 + n("hours") * 3600 + n("minutes") * 60 + n("seconds");
    return durationText(ctx, seconds);
  }
  return null;
}

/** A point in time: a clock time, or an entity that holds one; null if unknown. */
type TimeValue = { clock: string } | { entity: string };

function timeValue(ctx: DescribeContext, v: Json | undefined): TimeValue | null {
  if (typeof v !== "string") return null;
  const m = CLOCK.exec(v);
  if (m) {
    const hh = m[1].padStart(2, "0");
    return { clock: m[3] && m[3] !== "00" ? `${hh}:${m[2]}:${m[3]}` : `${hh}:${m[2]}` };
  }
  return ENTITY_ID.test(v) ? { entity: ctx.nameOf(v) } : null;
}

/** An offset of a sun event as "hh:mm:ss" with an optional sign, or seconds. */
function sunOffset(ctx: DescribeContext, v: Json | undefined): { text: string; before: boolean } | null {
  if (v === undefined) return { text: "", before: false };
  let before = false;
  let raw = v;
  if (typeof v === "string" && v.startsWith("-")) {
    before = true;
    raw = v.slice(1);
  } else if (typeof v === "string" && v.startsWith("+")) {
    raw = v.slice(1);
  } else if (typeof v === "number" && v < 0) {
    before = true;
    raw = -v;
  }
  const text = durationText(ctx, raw);
  return text === null ? null : { text, before };
}

function sunName(ctx: DescribeContext, event: Json | undefined): string | null {
  if (event === "sunrise") return ctx.t.sunrise;
  if (event === "sunset") return ctx.t.sunset;
  return null;
}

function numberOrEntity(ctx: DescribeContext, v: Json | undefined): string | null {
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && ENTITY_ID.test(v)) return ctx.nameOf(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return v.trim();
  return null;
}

/** Triggers fire for any of the entities, conditions need all of them. */
function names(ctx: DescribeContext, ids: string[], type: "conjunction" | "disjunction"): string {
  return join(ctx, ids.map((id) => ctx.nameOf(id)), type);
}

function typeOf(item: Obj, ...keys: string[]): string | null {
  for (const k of keys) if (typeof item[k] === "string") return item[k] as string;
  return null;
}

/** True when every key of `item` is one the description reads. */
function onlyKnown(item: Obj, known: string[]): boolean {
  return Object.keys(item).every((k) => known.includes(k) || BENIGN.includes(k));
}

function unrecognised(label: string, raw: Json, yamlLabel: string): DescribedItem {
  return { text: label, fragments: [{ label: yamlLabel, yaml: toYaml(raw) }] };
}

// --- Triggers --------------------------------------------------------------

export function describeTrigger(raw: Json, ctx: DescribeContext): DescribedItem {
  const t = ctx.t;
  const fallback = (type: string | null) =>
    unrecognised(type ? t.unknownTriggerOf(type) : t.unknownTrigger, raw, t.fragmentYaml);
  if (!isObj(raw)) return fallback(null);
  const type = typeOf(raw, "trigger", "platform");
  const ok = (text: string): DescribedItem => ({ text, fragments: [] });
  const forPart = (): string | undefined => {
    if (raw.for === undefined) return "";
    const d = durationText(ctx, raw.for);
    return d === null ? undefined : t.triggerFor(d);
  };

  switch (type) {
    case "state": {
      if (!onlyKnown(raw, ["trigger", "platform", "entity_id", "to", "from", "for"])) break;
      const ids = strings(raw.entity_id);
      const suffix = forPart();
      if (!ids || suffix === undefined) break;
      const who = names(ctx, ids, "disjunction");
      const to = raw.to === undefined || raw.to === null ? null : stateList(ctx, raw.to);
      const from = raw.from === undefined || raw.from === null ? null : stateList(ctx, raw.from);
      if ((raw.to !== undefined && raw.to !== null && to === null) || (raw.from !== undefined && raw.from !== null && from === null)) break;
      if (to && from) return ok(t.changesFromTo(who, from, to) + suffix);
      if (to) return ok(t.changesTo(who, to) + suffix);
      if (from) return ok(t.changesFrom(who, from) + suffix);
      return ok(t.changes(who) + suffix);
    }
    case "time": {
      if (!onlyKnown(raw, ["trigger", "platform", "at"])) break;
      const list = asList(raw.at).map((x) => timeValue(ctx, x));
      if (list.length === 0 || list.some((x) => x === null)) break;
      const parts = (list as TimeValue[]).map((v) =>
        "clock" in v ? t.timeAt(t.clock(v.clock)) : t.timeAtEntity(v.entity),
      );
      return ok(join(ctx, parts, "disjunction"));
    }
    case "sun": {
      if (!onlyKnown(raw, ["trigger", "platform", "event", "offset"])) break;
      const event = sunName(ctx, raw.event);
      const offset = sunOffset(ctx, raw.offset);
      if (!event || !offset) break;
      return ok(t.sunTrigger(event, offset.text, offset.before));
    }
    case "numeric_state": {
      if (!onlyKnown(raw, ["trigger", "platform", "entity_id", "above", "below", "for"])) break;
      const ids = strings(raw.entity_id);
      const suffix = forPart();
      const above = raw.above === undefined ? null : numberOrEntity(ctx, raw.above);
      const below = raw.below === undefined ? null : numberOrEntity(ctx, raw.below);
      if (!ids || suffix === undefined) break;
      if ((raw.above !== undefined && above === null) || (raw.below !== undefined && below === null)) break;
      if (above === null && below === null) break;
      return ok(t.triggerNumeric(names(ctx, ids, "disjunction"), above, below) + suffix);
    }
  }
  return fallback(type);
}

// --- Conditions ------------------------------------------------------------

export function describeCondition(raw: Json, ctx: DescribeContext): DescribedItem {
  const t = ctx.t;
  const fallback = (type: string | null) =>
    unrecognised(type ? t.unknownConditionOf(type) : t.unknownCondition, raw, t.fragmentYaml);
  if (!isObj(raw)) return fallback(null);
  const type = typeOf(raw, "condition");
  const ok = (text: string): DescribedItem => ({ text, fragments: [] });

  switch (type) {
    case "state": {
      if (!onlyKnown(raw, ["condition", "entity_id", "state", "for"])) break;
      const ids = strings(raw.entity_id);
      const states = stateList(ctx, raw.state);
      let suffix = "";
      if (raw.for !== undefined) {
        const d = durationText(ctx, raw.for);
        if (d === null) break;
        suffix = t.conditionFor(d);
      }
      if (!ids || !states) break;
      return ok(t.isState(names(ctx, ids, "conjunction"), states) + suffix);
    }
    case "numeric_state": {
      if (!onlyKnown(raw, ["condition", "entity_id", "above", "below"])) break;
      const ids = strings(raw.entity_id);
      const above = raw.above === undefined ? null : numberOrEntity(ctx, raw.above);
      const below = raw.below === undefined ? null : numberOrEntity(ctx, raw.below);
      if (!ids) break;
      if ((raw.above !== undefined && above === null) || (raw.below !== undefined && below === null)) break;
      if (above === null && below === null) break;
      return ok(t.conditionNumeric(names(ctx, ids, "conjunction"), above, below));
    }
    case "sun": {
      if (!onlyKnown(raw, ["condition", "after", "before", "after_offset", "before_offset"])) break;
      const parts: string[] = [];
      for (const [key, kind] of [["after", "after"], ["before", "before"]] as const) {
        if (raw[key] === undefined) continue;
        const event = sunName(ctx, raw[key]);
        const offset = sunOffset(ctx, raw[`${key}_offset`]);
        if (!event || !offset) return fallback(type);
        parts.push(t.sunCondition(kind, event, offset.text, offset.before));
      }
      if (parts.length === 0) break;
      return ok(join(ctx, parts, "conjunction"));
    }
    case "time": {
      if (!onlyKnown(raw, ["condition", "after", "before", "weekday"])) break;
      const parts: string[] = [];
      let unknownTime = false;
      for (const kind of ["after", "before"] as const) {
        if (raw[kind] === undefined) continue;
        const v = timeValue(ctx, raw[kind]);
        if (v === null) unknownTime = true;
        else parts.push("clock" in v ? t.timeCondition(kind, t.clock(v.clock)) : t.timeConditionEntity(kind, v.entity));
      }
      if (unknownTime) break;
      if (raw.weekday !== undefined) {
        const days = strings(raw.weekday);
        const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
        if (!days || !days.every((d) => order.includes(d))) break;
        const fmt = new Intl.DateTimeFormat(ctx.language, { weekday: "short", timeZone: "UTC" });
        // 2024-01-01 is a Monday.
        const label = (d: string) => fmt.format(new Date(Date.UTC(2024, 0, 1 + order.indexOf(d))));
        parts.push(t.onWeekdays(join(ctx, order.filter((d) => days.includes(d)).map(label), "conjunction")));
      }
      if (parts.length === 0) break;
      return ok(join(ctx, parts, "conjunction"));
    }
  }
  return fallback(type);
}

// --- Actions ---------------------------------------------------------------

/** The entity ids of a service call, and the target keys that could not be named. */
function targetEntities(raw: Obj): { ids: string[]; rest: Obj } {
  const rest: Obj = {};
  const ids: string[] = [];
  const take = (src: Json | undefined) => {
    if (!isObj(src)) return;
    for (const [k, v] of Object.entries(src)) {
      const list = k === "entity_id" ? strings(v) : null;
      if (list && list.every((x) => ENTITY_ID.test(x))) ids.push(...list);
      else rest[k] = v;
    }
  };
  take(raw.target);
  if (raw.entity_id !== undefined) take({ entity_id: raw.entity_id });
  return { ids, rest };
}

export function describeAction(raw: Json, ctx: DescribeContext): DescribedItem {
  const t = ctx.t;
  if (!isObj(raw)) return unrecognised(t.unknownAction, raw, t.fragmentYaml);
  const service = typeOf(raw, "action", "service");

  if (service !== null && /^[a-z0-9_]+\.[a-z0-9_]+$/.test(service)) {
    const known = ["action", "service", "target", "entity_id", "data", "metadata", "alias", "id"];
    const extra = Object.keys(raw).filter((k) => !known.includes(k));
    if (extra.length === 0) {
      const { ids, rest } = targetEntities(raw);
      const who = ids.length > 0 ? join(ctx, ids.map((i) => ctx.nameOf(i)), "conjunction") : null;
      const verb = service.split(".")[1];
      let text: string;
      if (who && verb === "turn_on") text = t.turnOn(who);
      else if (who && verb === "turn_off") text = t.turnOff(who);
      else if (who && verb === "toggle") text = t.toggle(who);
      else text = who ? t.callOn(service, who) : t.call(service);
      const fragments: Fragment[] = [];
      if (Object.keys(rest).length > 0) fragments.push({ label: t.fragmentTarget, yaml: toYaml(rest) });
      if (isObj(raw.data) && Object.keys(raw.data).length > 0) {
        fragments.push({ label: t.fragmentData, yaml: toYaml(raw.data) });
      } else if (raw.data !== undefined && !isObj(raw.data)) {
        fragments.push({ label: t.fragmentData, yaml: toYaml(raw.data) });
      }
      return { text, fragments };
    }
    return unrecognised(t.unknownActionOf(service), raw, t.fragmentYaml);
  }

  if ("delay" in raw && onlyKnown(raw, ["delay"])) {
    const d = durationText(ctx, raw.delay);
    if (d !== null) return { text: t.waits(d), fragments: [] };
    return unrecognised(t.unknownActionOf("delay"), raw, t.fragmentYaml);
  }
  const kind = Object.keys(raw).find((k) => !BENIGN.includes(k)) ?? null;
  return unrecognised(kind ? t.unknownActionOf(kind) : t.unknownAction, raw, t.fragmentYaml);
}

function cap(item: DescribedItem): DescribedItem {
  return { ...item, text: item.text.charAt(0).toUpperCase() + item.text.slice(1) };
}

// --- Automation ------------------------------------------------------------

const KNOWN_TOP = [
  "id",
  "alias",
  "description",
  "mode",
  "max",
  "triggers",
  "trigger",
  "conditions",
  "condition",
  "actions",
  "action",
];

export function describeConfig(config: Obj, ctx: DescribeContext): AutomationDescription {
  const pick = (a: string, b: string) => (config[a] !== undefined ? config[a] : config[b]);
  const str = (v: Json | undefined) => (typeof v === "string" && v ? v : null);
  const other: Fragment[] = Object.entries(config)
    .filter(([k]) => !KNOWN_TOP.includes(k))
    .map(([k, v]) => ({ label: k, yaml: toYaml({ [k]: v }) }));
  return {
    alias: str(config.alias),
    description: str(config.description),
    mode: str(config.mode),
    triggers: asList(pick("triggers", "trigger")).map((x) => cap(describeTrigger(x, ctx))),
    conditions: asList(pick("conditions", "condition")).map((x) => cap(describeCondition(x, ctx))),
    actions: asList(pick("actions", "action")).map((x) => cap(describeAction(x, ctx))),
    other,
  };
}
