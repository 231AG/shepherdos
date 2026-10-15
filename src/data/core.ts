"use client";

/**
 * Data core: merges the generated seed with the visitor's persisted deltas
 * and provides the low-level write helpers. Only repository modules in
 * src/data/ import this file; components use src/data/repo.ts.
 */
import { useMemo } from "react";
import { generateSeed, type TableName, type Tables } from "@/mock/seed";
import { useDemoStore, type Deltas, type TableDelta } from "./store";
import { toISODate, today } from "@/lib/dates";

export type Db = Tables & { now: Date; epoch: Date };

let seedCache: { key: string; tables: Tables } | null = null;

function getSeed(now: Date, epoch: Date): Tables {
  const key = `${toISODate(now)}:${epoch.getTime()}`;
  if (!seedCache || seedCache.key !== key) seedCache = { key, tables: generateSeed(now, epoch) };
  return seedCache.tables;
}

type Row = { id: string };
const mergeCache = new Map<TableName, { seed: unknown; delta: unknown; rows: unknown }>();

function mergeTable<T extends Row>(name: TableName, seed: T[], delta: TableDelta<T> | undefined): T[] {
  if (!delta) return seed;
  const hit = mergeCache.get(name);
  if (hit && hit.seed === seed && hit.delta === delta) return hit.rows as T[];
  const patch = (r: T) => (delta.patched[r.id] ? { ...r, ...delta.patched[r.id] } : r);
  let rows = seed.map(patch).concat(delta.added.map(patch));
  if (delta.removed?.length) {
    const gone = new Set(delta.removed);
    rows = rows.filter((r) => !gone.has(r.id));
  }
  mergeCache.set(name, { seed, delta, rows });
  return rows;
}

const dbCache: { deltas: Deltas | null; key: string; db: Db | null } = { deltas: null, key: "", db: null };

function buildDb(deltas: Deltas, epochMs: number): Db {
  const now = today();
  const key = `${toISODate(now)}:${epochMs}`;
  if (dbCache.db && dbCache.deltas === deltas && dbCache.key === key) return dbCache.db;
  const epoch = new Date(epochMs);
  const seed = getSeed(now, epoch);
  const db = { now, epoch } as Db;
  for (const name of Object.keys(seed) as TableName[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)[name] = mergeTable(name, seed[name] as Row[], deltas[name] as TableDelta<Row> | undefined);
  }
  dbCache.deltas = deltas;
  dbCache.key = key;
  dbCache.db = db;
  return db;
}

/** Subscribe to the merged database. Re-renders when the visitor changes data. */
export function useDb(): Db {
  const deltas = useDemoStore((s) => s.deltas);
  const epochMs = useDemoStore((s) => s.epoch);
  return useMemo(() => buildDb(deltas, epochMs), [deltas, epochMs]);
}

/** The current merged database, for commands outside React. */
export function currentDb(): Db {
  const s = useDemoStore.getState();
  return buildDb(s.deltas, s.epoch);
}

/** Per-db memo for derived indexes. A new db (any change) recomputes. */
const derived = new WeakMap<Db, Map<string, unknown>>();
export function memo<T>(db: Db, key: string, fn: () => T): T {
  let m = derived.get(db);
  if (!m) derived.set(db, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as T;
}

type AnyDelta<K extends TableName> = TableDelta<Tables[K][number]>;
const emptyDelta = { added: [], patched: {} };

export function addRows<K extends TableName>(table: K, rows: Tables[K][number][]) {
  if (!rows.length) return;
  useDemoStore.getState().mutate((d) => {
    const cur = (d[table] ?? emptyDelta) as AnyDelta<K>;
    return { ...d, [table]: { ...cur, added: [...cur.added, ...rows] } };
  });
}

export function addRow<K extends TableName>(table: K, row: Tables[K][number]) {
  addRows(table, [row]);
}

export function patchRows<K extends TableName>(table: K, patches: Record<string, Partial<Tables[K][number]>>) {
  const ids = Object.keys(patches);
  if (!ids.length) return;
  useDemoStore.getState().mutate((d) => {
    const cur = (d[table] ?? emptyDelta) as AnyDelta<K>;
    const patched = { ...cur.patched };
    for (const id of ids) patched[id] = { ...patched[id], ...patches[id] };
    return { ...d, [table]: { ...cur, patched } };
  });
}

export function patchRow<K extends TableName>(table: K, id: string, patch: Partial<Tables[K][number]>) {
  patchRows(table, { [id]: patch } as Record<string, Partial<Tables[K][number]>>);
}

/** Remove rows. Visitor-added rows are dropped; seeded rows are hidden. */
export function removeRows<K extends TableName>(table: K, ids: string[]) {
  if (!ids.length) return;
  const gone = new Set(ids);
  useDemoStore.getState().mutate((d) => {
    const cur = (d[table] ?? emptyDelta) as AnyDelta<K>;
    const added = cur.added.filter((r) => !gone.has((r as Row).id));
    const fromSeed = ids.filter((id) => !cur.added.some((r) => (r as Row).id === id));
    return { ...d, [table]: { ...cur, added, removed: [...(cur.removed ?? []), ...fromSeed] } };
  });
}
