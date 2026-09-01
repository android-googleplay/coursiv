import { afterEach, describe, expect, it, vi } from "vitest";
import { queueWelcomeEmail } from "./welcome-email-client";

afterEach(() => vi.unstubAllGlobals());

describe("welcome email client", () => {
  it("does not call the API for demo or guest flows without a Firebase token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(queueWelcomeEmail(null)).resolves.toEqual({ status:"skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queues an authenticated welcome email without sending client-owned recipient data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status:"queued" }, { status:202 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(queueWelcomeEmail("firebase-token")).resolves.toEqual({ status:"queued" });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/welcome", {
      method:"POST",
      headers:{ Authorization:"Bearer firebase-token" },
    });
  });

  it("surfaces API failure to the all-settled signup caller", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error:"not configured" }, { status:503 })));
    await expect(queueWelcomeEmail("firebase-token")).rejects.toThrow("not configured");
  });
});
