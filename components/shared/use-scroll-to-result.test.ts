import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollQuestionAfterReset, scrollResultIntoView } from "./use-scroll-to-result";

afterEach(() => vi.unstubAllGlobals());

describe("scrollResultIntoView", () => {
  function targetAt(top: number, height: number) {
    const scrollIntoView = vi.fn();
    return {
      element: {
        scrollIntoView,
        closest: () => null,
        getBoundingClientRect: () => ({ top, bottom: top + height, height }),
      } as unknown as HTMLElement,
      scrollIntoView,
    };
  }

  function stubWindow(reducedMotion = false) {
    vi.stubGlobal("window", {
      getComputedStyle: () => ({ scrollMarginTop: "72px", scrollMarginBottom: "0px" }),
      innerHeight: 800,
      matchMedia: () => ({ matches: reducedMotion }),
    });
  }

  it("does not move feedback that is already fully visible", () => {
    stubWindow();
    const { element, scrollIntoView } = targetAt(500, 200);

    scrollResultIntoView(element);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses the shortest movement to reveal clipped feedback in full", () => {
    stubWindow();
    const { element, scrollIntoView } = targetAt(700, 180);

    scrollResultIntoView(element);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
  });

  it("keeps feedback above a fixed footer that covers the viewport", () => {
    const scrollBy = vi.fn();
    const footer = {
      contains: () => false,
      getBoundingClientRect: () => ({ top: 620, bottom: 800, left: 0, right: 1000 }),
    } as unknown as HTMLElement;
    vi.stubGlobal("window", {
      getComputedStyle: (element: HTMLElement) => element === footer
        ? { position: "fixed" }
        : { scrollMarginTop: "72px", scrollMarginBottom: "16px" },
      innerHeight: 800,
      matchMedia: () => ({ matches: false }),
      scrollBy,
    });
    const scrollIntoView = vi.fn();
    const element = {
      scrollIntoView,
      closest: () => null,
      contains: () => false,
      ownerDocument: { querySelectorAll: () => [footer] },
      getBoundingClientRect: () => ({ top: 500, bottom: 700, height: 200, left: 100, right: 500 }),
    } as unknown as HTMLElement;

    scrollResultIntoView(element);

    expect(scrollBy).toHaveBeenCalledWith({ top: 96, behavior: "smooth" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("aligns oversized feedback to the top to show as much as possible", () => {
    stubWindow();
    const { element, scrollIntoView } = targetAt(300, 900);

    scrollResultIntoView(element);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("respects reduced-motion preferences", () => {
    stubWindow(true);
    const { element, scrollIntoView } = targetAt(700, 180);

    scrollResultIntoView(element);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "nearest" });
  });

  it("moves a reset question to the top after React can commit the reset", () => {
    stubWindow();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    const { element, scrollIntoView } = targetAt(-400, 500);

    scrollQuestionAfterReset(() => element);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
