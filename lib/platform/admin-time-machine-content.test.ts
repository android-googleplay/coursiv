import { describe, expect, it } from "vitest";
import { assertContentSnapshotCollection, CONTENT_SNAPSHOT_COLLECTIONS } from "./time-machine-boundary";

describe("Time Machine content boundary", () => {
  it("allows only the three CMS collections", () => {
    expect(CONTENT_SNAPSHOT_COLLECTIONS).toEqual(["courses", "lessons", "contentMetadata"]);
    for (const collection of CONTENT_SNAPSHOT_COLLECTIONS) expect(() => assertContentSnapshotCollection(collection)).not.toThrow();
  });

  it.each(["users","progress","answers","payments","subscriptions","certificates","tickets","staff","adminAuditLogs","mediaAssets"])("rejects protected collection %s", (collection) => {
    expect(() => assertContentSnapshotCollection(collection)).toThrow("Forbidden Time Machine collection");
  });
});
