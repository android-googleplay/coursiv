import { afterEach, describe, expect, it } from "vitest";
import { coursivMediaUrl } from "./coursiv-media-url";

const previousBase = process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL;

afterEach(() => {
  if (previousBase === undefined) delete process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL;
  else process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL = previousBase;
});

describe("Coursiv media URLs", () => {
  it("uses the Firebase media CDN when no override is configured", () => {
    delete process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL;
    expect(coursivMediaUrl("/coursiv-media/example.webp")).toBe("https://courseai-73920.web.app/coursiv-media/example.webp");
  });

  it("routes canonical media through the configured Firebase CDN", () => {
    process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL = "https://example.web.app/coursiv-media/";
    expect(coursivMediaUrl("/coursiv-media/example.webp")).toBe("https://example.web.app/coursiv-media/example.webp");
  });

  it("does not rewrite uploaded or remote media", () => {
    process.env.NEXT_PUBLIC_COURSIV_MEDIA_BASE_URL = "https://example.web.app/coursiv-media";
    expect(coursivMediaUrl("https://storage.googleapis.com/example/upload.webp")).toBe("https://storage.googleapis.com/example/upload.webp");
  });
});
