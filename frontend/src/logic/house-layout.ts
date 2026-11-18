/**
 * Deterministic layout of the house view: rooms as columns of entity tiles,
 * with the automations as hubs in the channels between the columns. Pure
 * functions; every coordinate is computed from the data.
 */
import type { House, HouseEntity } from "../model";
import type { AutomationInfo } from "./net";
import { wrapText } from "./text";

export const TILE_W = 156;
export const TILE_H = 52;
const TILE_GAP = 12;
const ROOM_PAD = 12;
const ROOM_HEADER = 36;
const COL_W = TILE_W + 2 * ROOM_PAD;
const CHANNEL_W = 204;
const MARGIN = 16;
export const HUB_W = 140;
export const HUB_H = 46;
const HUB_GAP = 26;

export interface LayoutTile {
  key: string;
  /** Null for event pseudo-tiles such as a time trigger. */
  entityId: string | null;
  col: number;
  x: number;
  y: number;
  name: string;
  icon: string;
  state: string;
}

export interface LayoutRoom {
  id: string | null;
  name: string | null;
  icon: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutHub {
  automationId: string;
  channel: number;
  x: number;
  y: number;
  lines: string[];
}

export type EdgeKind = "trigger" | "effect" | "condition";

export interface LayoutEdge {
  automationId: string;
  kind: EdgeKind;
  tileKey: string;
  d: string;
}

export interface HouseLayout {
  width: number;
  height: number;
  rooms: LayoutRoom[];
  tiles: LayoutTile[];
  hubs: LayoutHub[];
  edges: LayoutEdge[];
}

interface Link {
  automationId: string;
  kind: EdgeKind;
  tileKey: string;
}

/** Key of the tile an automation endpoint attaches to. */
function tileKeyFor(entityId: string | null, transitionId: string): string {
  return entityId ?? `event:${transitionId}`;
}

export function layoutHouse(
  house: House,
  automations: readonly AutomationInfo[],
  aliasOf: (automationId: string) => string,
  eventLabel: (transitionId: string) => string,
  eventIcon = "mdi:clock-outline",
): HouseLayout {
  // Columns: the rooms in file order, with the entities without a room as one
  // more column in the middle, so state read by several rooms is adjacent.
  type Column = { id: string | null; name: string | null; icon: string };
  const columns: Column[] = house.areas.map((a) => ({ id: a.id, name: a.name, icon: a.icon }));
  columns.splice(Math.floor(columns.length / 2), 0, { id: null, name: null, icon: "mdi:home-outline" });
  const colOfArea = new Map<string | null, number>(columns.map((c, i) => [c.id, i]));
  const noRoomCol = colOfArea.get(null) ?? 0;

  // Tiles per column. Entities that no automation touches still appear.
  const tileSpecs = new Map<string, Omit<LayoutTile, "x" | "y">>();
  const byColumn: string[][] = columns.map(() => []);
  const addTile = (key: string, col: number, spec: Omit<LayoutTile, "col" | "key" | "x" | "y">) => {
    tileSpecs.set(key, { key, col, ...spec });
    byColumn[col].push(key);
  };
  const entityCol = (e: HouseEntity) => colOfArea.get(e.area_id) ?? noRoomCol;
  for (const e of house.entities) {
    addTile(e.entity_id, entityCol(e), { entityId: e.entity_id, name: e.name, icon: e.icon, state: e.state });
  }
  for (const a of automations) {
    for (const t of a.triggers) {
      if (t.entityId === null) {
        addTile(tileKeyFor(null, t.transitionId), noRoomCol, {
          entityId: null,
          name: eventLabel(t.transitionId),
          icon: eventIcon,
          state: "",
        });
      }
    }
  }

  // Geometry of columns and rooms. Channel c lies left of column c.
  const usesChannel = (c: number, hubs: { channel: number }[]) => hubs.some((h) => h.channel === c);
  const wantedChannel = new Map<string, number>();
  for (const a of automations) {
    const cols = [
      ...a.triggers.map((t) => tileSpecs.get(tileKeyFor(t.entityId, t.transitionId))?.col),
      ...a.effects.map((e) => tileSpecs.get(e.entityId)?.col),
      ...a.conditions.map((c) => tileSpecs.get(c.entityId)?.col),
    ].filter((c): c is number => c !== undefined);
    const home = a.triggers
      .map((t) => tileSpecs.get(tileKeyFor(t.entityId, t.transitionId))?.col)
      .find((c): c is number => c !== undefined) ?? 0;
    const left = cols.filter((c) => c < home).length;
    const right = cols.filter((c) => c > home).length;
    // More neighbours on the left: left channel. Tie: right, except in the
    // last column, which has no channel on its right.
    const goLeft = left > right || (left === right && home === columns.length - 1);
    wantedChannel.set(a.id, goLeft ? home : home + 1);
  }
  const pre = [...wantedChannel.values()].map((channel) => ({ channel }));
  const leftExtra = usesChannel(0, pre) ? CHANNEL_W : 0;
  const colX = (col: number) => MARGIN + leftExtra + col * (COL_W + CHANNEL_W);
  const channelX = (c: number) => colX(c) - CHANNEL_W / 2; // center of channel c
  const rightExtra = usesChannel(columns.length, pre) ? CHANNEL_W : 0;

  const tiles: LayoutTile[] = [];
  const rooms: LayoutRoom[] = [];
  let bottom = 0;
  columns.forEach((c, col) => {
    const keys = byColumn[col];
    const h = ROOM_HEADER + ROOM_PAD + keys.length * (TILE_H + TILE_GAP) - TILE_GAP + ROOM_PAD;
    rooms.push({ id: c.id, name: c.name, icon: c.icon, col, x: colX(col), y: MARGIN, w: COL_W, h });
    keys.forEach((key, i) => {
      const spec = tileSpecs.get(key);
      if (!spec) return;
      tiles.push({
        ...spec,
        x: colX(col) + ROOM_PAD,
        y: MARGIN + ROOM_HEADER + ROOM_PAD + i * (TILE_H + TILE_GAP),
      });
    });
    bottom = Math.max(bottom, MARGIN + h);
  });
  const tileByKey = new Map(tiles.map((t) => [t.key, t]));

  // Links of each automation, then the hub positions per channel.
  const links: Link[] = [];
  for (const a of automations) {
    for (const t of a.triggers) {
      links.push({ automationId: a.id, kind: "trigger", tileKey: tileKeyFor(t.entityId, t.transitionId) });
    }
    for (const e of a.effects) links.push({ automationId: a.id, kind: "effect", tileKey: e.entityId });
    for (const c of a.conditions) links.push({ automationId: a.id, kind: "condition", tileKey: c.entityId });
  }

  const hubs: LayoutHub[] = [];
  const perChannel = new Map<number, { id: string; want: number }[]>();
  for (const a of automations) {
    const ys = links
      .filter((l) => l.automationId === a.id)
      .map((l) => tileByKey.get(l.tileKey))
      .filter((t): t is LayoutTile => t !== undefined)
      .map((t) => t.y + TILE_H / 2);
    const want = ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : MARGIN;
    const channel = wantedChannel.get(a.id) ?? 0;
    perChannel.set(channel, [...(perChannel.get(channel) ?? []), { id: a.id, want }]);
  }
  for (const [channel, items] of perChannel) {
    items.sort((p, q) => p.want - q.want || p.id.localeCompare(q.id));
    let minY = MARGIN;
    for (const item of items) {
      const y = Math.max(minY, item.want - HUB_H / 2);
      hubs.push({
        automationId: item.id,
        channel,
        x: channelX(channel) - HUB_W / 2,
        y,
        lines: wrapText(aliasOf(item.id), 18, 2),
      });
      minY = y + HUB_H + HUB_GAP;
      bottom = Math.max(bottom, y + HUB_H + MARGIN);
    }
  }
  const hubById = new Map(hubs.map((h) => [h.automationId, h]));

  // Edges. Each tile side hands out evenly spread attachment points.
  type Request = { link: Link; tile: LayoutTile; side: 1 | -1; hub: LayoutHub };
  const requests: Request[] = [];
  for (const link of links) {
    const tile = tileByKey.get(link.tileKey);
    const hub = hubById.get(link.automationId);
    if (!tile || !hub) continue;
    const side = hub.x + HUB_W / 2 >= tile.x + TILE_W / 2 ? 1 : -1;
    requests.push({ link, tile, side, hub });
  }
  const slots = new Map<string, Request[]>();
  for (const r of requests) {
    const key = `${r.tile.key}|${r.side}`;
    slots.set(key, [...(slots.get(key) ?? []), r]);
  }
  const hubSlots = new Map<string, Request[]>();
  for (const r of requests) {
    const key = `${r.hub.automationId}|${-r.side}`;
    hubSlots.set(key, [...(hubSlots.get(key) ?? []), r]);
  }
  const spread = (group: Request[], r: Request, top: number, height: number) =>
    top + (height * (group.indexOf(r) + 1)) / (group.length + 1);

  const edges: LayoutEdge[] = requests.map((r) => {
    const tileGroup = slots.get(`${r.tile.key}|${r.side}`) ?? [r];
    const hubGroup = hubSlots.get(`${r.hub.automationId}|${-r.side}`) ?? [r];
    const tx = r.side === 1 ? r.tile.x + TILE_W : r.tile.x;
    const ty = spread(tileGroup, r, r.tile.y, TILE_H);
    const hx = r.side === 1 ? r.hub.x : r.hub.x + HUB_W;
    const hy = spread(hubGroup, r, r.hub.y, HUB_H);
    // Triggers and conditions run from the tile to the hub, effects back.
    const [x1, y1, x2, y2, d1, d2] =
      r.link.kind === "effect"
        ? [hx, hy, tx, ty, -r.side, r.side]
        : [tx, ty, hx, hy, r.side, -r.side];
    const dx = Math.max(24, Math.abs(x2 - x1) / 2);
    const d = `M${x1},${y1} C${x1 + d1 * dx},${y1} ${x2 + d2 * dx},${y2} ${x2},${y2}`;
    return { automationId: r.link.automationId, kind: r.link.kind, tileKey: r.link.tileKey, d };
  });

  const lastColRight = colX(columns.length - 1) + COL_W;
  return {
    width: lastColRight + rightExtra + MARGIN,
    height: bottom + MARGIN,
    rooms,
    tiles,
    hubs,
    edges,
  };
}
