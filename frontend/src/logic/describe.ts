/** House-term descriptions of automations, derived from the net. */
import type { House } from "../model";
import type { AutomationInfo } from "./net";

export interface Described {
  text: string;
  room: string | null;
}

export interface DescribedEffect extends Described {
  delay: string | null;
}

export interface Description {
  triggers: Described[];
  conditions: Described[];
  effects: DescribedEffect[];
  rooms: string[];
}

export function describeAutomation(info: AutomationInfo, house: House): Description {
  const roomName = (areaId: string | null) =>
    house.areas.find((a) => a.id === areaId)?.name ?? null;
  const triggers = info.triggers.map((t) => ({ text: t.label, room: roomName(t.areaId) }));
  const conditions = info.conditions.map((c) => ({ text: c.label, room: roomName(c.areaId) }));
  const effects = info.effects.map((e) => ({
    text: e.label,
    room: roomName(e.areaId),
    delay: e.delay,
  }));
  const rooms = [
    ...new Set(
      [...triggers, ...effects].map((d) => d.room).filter((r): r is string => r !== null),
    ),
  ];
  return { triggers, conditions, effects, rooms };
}
