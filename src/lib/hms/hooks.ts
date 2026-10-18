"use client";

import {
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentReference,
  type Query,
  type WhereFilterOp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import type { WithId } from "./common";
import {
  collectionRef,
  docRef,
  type CollectionName,
  type EntityMap,
} from "./repo";
import { useSandbox } from "./sandbox-context";

export type LiveState<T> = {
  /** Undefined while loading or after an error. */
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** Re-subscribe after an error. */
  retry: () => void;
};

/** A serialisable query description, so hooks can resubscribe only on change. */
export type QueryFilter = {
  where?: ReadonlyArray<
    readonly [field: string, op: WhereFilterOp, value: unknown]
  >;
  orderBy?: ReadonlyArray<readonly [field: string, direction: "asc" | "desc"]>;
  limit?: number;
};

// Dates survive the round trip through the filter key.
function serialiseFilter(filter: QueryFilter | undefined): string {
  return JSON.stringify(
    filter ?? {},
    function (this: Record<string, unknown>, key, value) {
      const raw = this[key];
      return raw instanceof Date ? { $date: raw.toISOString() } : value;
    },
  );
}

function parseFilter(key: string): QueryFilter {
  return JSON.parse(key, (_k, value) =>
    value && typeof value === "object" && "$date" in value
      ? new Date(value.$date as string)
      : value,
  ) as QueryFilter;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

type Snapshot<T> = { key: string; data?: T; error?: Error };

function useSubscription<T>(
  baseKey: string,
  subscribe: (
    next: (value: T) => void,
    fail: (error: Error) => void,
  ) => () => void,
): LiveState<T> {
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T> | null>(null);
  const key = `${baseKey}#${attempt}`;

  useEffect(
    () =>
      subscribe(
        (data) => setSnapshot({ key, data }),
        (error) => setSnapshot({ key, error }),
      ),
    [key, subscribe],
  );

  const current = snapshot?.key === key ? snapshot : null;
  return {
    data: current?.data,
    loading: current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((a) => a + 1),
  };
}

function subscribeQuery<T>(q: Query<T>) {
  return (next: (value: T[]) => void, fail: (error: Error) => void) =>
    onSnapshot(
      q,
      (snap) => {
        try {
          next(snap.docs.map((d) => d.data()));
        } catch (e) {
          fail(toError(e));
        }
      },
      fail,
    );
}

function subscribeDoc<T>(ref: DocumentReference<T>) {
  return (next: (value: T | null) => void, fail: (error: Error) => void) =>
    onSnapshot(
      ref,
      (snap) => {
        try {
          next(snap.exists() ? snap.data() : null);
        } catch (e) {
          fail(toError(e));
        }
      },
      fail,
    );
}

/** Live list of a sandbox collection, optionally filtered and ordered. */
export function useCollection<C extends CollectionName>(
  name: C,
  filter?: QueryFilter,
): LiveState<WithId<EntityMap[C]>[]> {
  const { db, uid } = useSandbox();
  const filterKey = serialiseFilter(filter);

  const subscribe = useMemo(() => {
    const f = parseFilter(filterKey);
    const constraints = [
      ...(f.where ?? []).map(([field, op, value]) => where(field, op, value)),
      ...(f.orderBy ?? []).map(([field, dir]) => orderBy(field, dir)),
      ...(f.limit ? [limitTo(f.limit)] : []),
    ];
    return subscribeQuery(query(collectionRef(db, uid, name), ...constraints));
  }, [db, uid, name, filterKey]);

  return useSubscription(`${uid}/${name}?${filterKey}`, subscribe);
}

/** Live single document; `data` is null when it does not exist. */
export function useDocument<C extends CollectionName>(
  name: C,
  id: string,
): LiveState<WithId<EntityMap[C]> | null> {
  const { db, uid } = useSandbox();
  const subscribe = useMemo(
    () => subscribeDoc(docRef(db, uid, name, id)),
    [db, uid, name, id],
  );
  return useSubscription(`${uid}/${name}/${id}`, subscribe);
}

/** Index a list by id for quick lookups (patients and staff in tables). */
export function useById<T extends { id: string }>(
  items: readonly T[] | undefined,
) {
  return useMemo(
    () => new Map((items ?? []).map((item) => [item.id, item])),
    [items],
  );
}
