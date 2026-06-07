import type { Dataset } from "./types";

export type Collection = "sections" | "courses" | "instructors" | "rooms" | "meetings";
const COLLECTIONS: Collection[] = ["sections", "courses", "instructors", "rooms", "meetings"];

export type Op =
  | { coll: Collection; kind: "upsert"; item: { id: string } }
  | { coll: Collection; kind: "delete"; id: string };

/** Changes between a loaded baseline and the edited draft, as id-keyed upserts/deletes. */
export function diffDataset(original: Dataset, draft: Dataset): Op[] {
  const ops: Op[] = [];
  for (const coll of COLLECTIONS) {
    const orig = original[coll] as { id: string }[];
    const next = draft[coll] as { id: string }[];
    const origById = new Map(orig.map((x) => [x.id, x]));
    const nextIds = new Set(next.map((x) => x.id));

    for (const item of next) {
      const before = origById.get(item.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
        ops.push({ coll, kind: "upsert", item });
      }
    }
    for (const item of orig) {
      if (!nextIds.has(item.id)) {
        ops.push({ coll, kind: "delete", id: item.id });
      }
    }
  }
  return ops;
}

/** Apply ops onto a dataset (used to re-layer local edits over the server's latest on conflict). */
export function applyOps(dataset: Dataset, ops: Op[]): Dataset {
  const next: Dataset = {
    ...dataset,
    sections: [...dataset.sections],
    courses: [...dataset.courses],
    instructors: [...dataset.instructors],
    rooms: [...dataset.rooms],
    meetings: [...dataset.meetings],
  };
  const colls = next as unknown as Record<Collection, { id: string }[]>;
  for (const op of ops) {
    if (op.kind === "delete") {
      colls[op.coll] = colls[op.coll].filter((x) => x.id !== op.id);
    } else {
      const arr = colls[op.coll];
      const idx = arr.findIndex((x) => x.id === op.item.id);
      if (idx >= 0) arr[idx] = op.item;
      else arr.push(op.item);
    }
  }
  return next;
}
