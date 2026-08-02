export const CONTENT_SNAPSHOT_COLLECTIONS = ["courses", "lessons", "contentMetadata"] as const;
export type ContentSnapshotCollection = typeof CONTENT_SNAPSHOT_COLLECTIONS[number];

export function assertContentSnapshotCollection(value: string): asserts value is ContentSnapshotCollection {
  if (!(CONTENT_SNAPSHOT_COLLECTIONS as readonly string[]).includes(value)) throw new Error(`Forbidden Time Machine collection: ${value}`);
}
