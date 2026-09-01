"use client";

import { useCallback, useEffect, useRef } from "react";

export function clearAnswerScrollRoom(main: HTMLElement | null) {
  if (!main?.hasAttribute("data-answer-scroll-room")) return;
  main.style.removeProperty("--answer-scroll-room");
  main.removeAttribute("data-answer-scroll-room");
}

function addOnlyRequiredScrollRoom(target: HTMLElement, block: ScrollLogicalPosition) {
  if (block !== "start" || typeof target.closest !== "function") return null;
  const main = target.closest<HTMLElement>("main");
  if (!main) return null;
  clearAnswerScrollRoom(main);
  const documentElement = target.ownerDocument?.documentElement;
  if (!documentElement || typeof target.getBoundingClientRect !== "function") return main;
  const scrollMarginTop = Number.parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
  const desiredScrollTop = target.getBoundingClientRect().top + window.scrollY - scrollMarginTop;
  const availableScrollTop = documentElement.scrollHeight - window.innerHeight;
  const requiredRoom = Math.ceil(desiredScrollTop - availableScrollTop);
  if (requiredRoom > 0) {
    main.style.setProperty("--answer-scroll-room", `${requiredRoom}px`);
    main.setAttribute("data-answer-scroll-room", "true");
  }
  return main;
}

function scrollMargin(target: HTMLElement, property: "scrollMarginTop" | "scrollMarginBottom") {
  return Number.parseFloat(window.getComputedStyle(target)[property]) || 0;
}

function viewportOccluderTop(target: HTMLElement, bounds: DOMRect) {
  const footers = target.ownerDocument?.querySelectorAll<HTMLElement>("footer") ?? [];
  let visibleBottom = window.innerHeight;
  for (const footer of footers) {
    if (footer === target || footer.contains(target) || target.contains(footer)) continue;
    const position = window.getComputedStyle(footer).position;
    if (position !== "fixed" && position !== "sticky") continue;
    const footerBounds = footer.getBoundingClientRect();
    if (footerBounds.top >= window.innerHeight || footerBounds.bottom < window.innerHeight - 1) continue;
    const horizontallyOverlaps = !Number.isFinite(bounds.left) || !Number.isFinite(bounds.right)
      || (footerBounds.right > bounds.left && footerBounds.left < bounds.right);
    if (horizontallyOverlaps) visibleBottom = Math.min(visibleBottom, footerBounds.top);
  }
  return visibleBottom;
}

export function scrollResultIntoView(target: HTMLElement | null, block: ScrollLogicalPosition = "nearest") {
  if (!target || typeof target.scrollIntoView !== "function") return null;
  const main = typeof target.closest === "function" ? target.closest<HTMLElement>("main") : null;
  clearAnswerScrollRoom(main);
  if (typeof target.getBoundingClientRect === "function") {
    const bounds = target.getBoundingClientRect();
    const visibleTop = scrollMargin(target, "scrollMarginTop");
    const viewportBottom = window.innerHeight - scrollMargin(target, "scrollMarginBottom");
    const visibleBottom = Math.min(viewportBottom, viewportOccluderTop(target, bounds) - scrollMargin(target, "scrollMarginBottom"));
    if (bounds.top >= visibleTop && bounds.bottom <= visibleBottom) return null;
    if (block === "nearest" && bounds.height > visibleBottom - visibleTop) block = "start";
    if (block === "nearest" && visibleBottom < viewportBottom && typeof window.scrollBy === "function") {
      const offset = bounds.top < visibleTop ? bounds.top - visibleTop : bounds.bottom - visibleBottom;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollBy({ top: offset, behavior: reduceMotion ? "auto" : "smooth" });
      return null;
    }
  }
  const spacedMain = addOnlyRequiredScrollRoom(target, block);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block });
  return spacedMain;
}

export function useScrollToResult<T extends HTMLElement>(revealed: boolean, block: ScrollLogicalPosition = "nearest") {
  const resultRef = useRef<T>(null);

  useEffect(() => {
    if (!revealed) return;
    let spacedMain: HTMLElement | null = null;
    const frame = requestAnimationFrame(() => {
      spacedMain = scrollResultIntoView(resultRef.current, block);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearAnswerScrollRoom(spacedMain);
    };
  }, [block, revealed]);

  return resultRef;
}

export function scrollQuestionAfterReset(target: () => HTMLElement | null) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => scrollResultIntoView(target(), "start"));
  });
}

export function useRetryToQuestion<T extends HTMLElement>() {
  const questionRef = useRef<T>(null);
  const retryToQuestion = useCallback((reset: () => void) => {
    reset();
    scrollQuestionAfterReset(() => questionRef.current);
  }, []);

  return { questionRef, retryToQuestion };
}
