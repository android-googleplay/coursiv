"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { browserUuid } from "@/lib/platform/browser-uuid";
import { sanitizeMetaAttribution, sha256Hex, type MetaAttribution, type MetaEventName } from "@/lib/platform/meta-contract";

type ConsentState = {
  consent: "granted" | "denied" | "unset";
  requiresConsent: boolean;
  marketingAllowed: boolean;
};

type TrackOptions = {
  eventId?: string;
  server?: boolean;
  emailHash?: string;
  authToken?: string | null;
};

type MetaTrackingValue = {
  ready: boolean;
  enabled: boolean;
  attribution: MetaAttribution;
  track: (eventName: MetaEventName, parameters?: Record<string, string | number>, options?: TrackOptions) => Promise<string>;
  setConsent: (consent: "granted" | "denied") => Promise<void>;
  hashEmail: (email: string) => Promise<string>;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string };
    _fbq?: Window["fbq"];
  }
}

const ATTRIBUTION_KEY = "coursiv.meta.attribution.v1";
const emptyAttribution: MetaAttribution = { anonymousId: "" };
const MetaTrackingContext = createContext<MetaTrackingValue | null>(null);

function cookieValue(name: string) {
  return document.cookie.split("; ").find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function captureAttribution(): MetaAttribution {
  const currentUrl = new URL(window.location.href);
  let existing: MetaAttribution = emptyAttribution;
  try { existing = sanitizeMetaAttribution(JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) ?? "{}")); } catch { /* ignore invalid local state */ }
  const fbclid = currentUrl.searchParams.get("fbclid") ?? existing.fbclid;
  const fbc = cookieValue("_fbc") ?? existing.fbc ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
  const next = sanitizeMetaAttribution({
    anonymousId: existing.anonymousId || browserUuid(),
    fbclid,
    fbc,
    fbp: cookieValue("_fbp") ?? existing.fbp,
    utmSource: existing.utmSource ?? currentUrl.searchParams.get("utm_source") ?? undefined,
    utmCampaign: existing.utmCampaign ?? currentUrl.searchParams.get("utm_campaign") ?? undefined,
    utmContent: existing.utmContent ?? currentUrl.searchParams.get("utm_content") ?? undefined,
    utmMedium: existing.utmMedium ?? currentUrl.searchParams.get("utm_medium") ?? undefined,
    utmTerm: existing.utmTerm ?? currentUrl.searchParams.get("utm_term") ?? undefined,
    landingUrl: existing.landingUrl ?? currentUrl.toString(),
    firstSeenAt: existing.firstSeenAt ?? new Date().toISOString(),
  });
  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  return next;
}

function initializePixel(pixelId: string) {
  if (window.fbq?.loaded) return;
  type FacebookQueue = NonNullable<Window["fbq"]>;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  } as FacebookQueue;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.id = "meta-pixel-script";
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  window.fbq("init", pixelId);
}

function trackingDisabled(pathname: string) {
  if (typeof window === "undefined") return true;
  return !process.env.NEXT_PUBLIC_META_PIXEL_ID ||
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) ||
    process.env.NEXT_PUBLIC_COURSIV_DEBUG_ADMIN === "true" ||
    pathname.startsWith("/admin") ||
    window.self !== window.top;
}

export function MetaTrackingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsentState] = useState<ConsentState | null>(null);
  const [attribution, setAttribution] = useState<MetaAttribution>(() => typeof window === "undefined" ? emptyAttribution : captureAttribution());
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const lastPageView = useRef("");
  const disabled = trackingDisabled(pathname);

  useEffect(() => {
    if (disabled) {
      queueMicrotask(() => setConsentState({ consent: "denied", requiresConsent: false, marketingAllowed: false }));
      return;
    }
    let active = true;
    void fetch("/api/privacy/region", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: ConsentState) => { if (active) setConsentState(value); })
      .catch(() => { if (active) setConsentState({ consent: "unset", requiresConsent: true, marketingAllowed: false }); });
    return () => { active = false; };
  }, [disabled]);

  useEffect(() => {
    if (!consent?.marketingAllowed || disabled) return;
    initializePixel(process.env.NEXT_PUBLIC_META_PIXEL_ID!);
    queueMicrotask(() => setAttribution(captureAttribution()));
  }, [consent?.marketingAllowed, disabled]);

  useEffect(() => {
    if (!consent?.marketingAllowed || disabled || !window.fbq?.loaded) return;
    const key = `${pathname}?${searchParams.toString()}`;
    if (lastPageView.current === key) return;
    lastPageView.current = key;
    window.fbq("track", "PageView", {}, { eventID: browserUuid() });
  }, [consent?.marketingAllowed, disabled, pathname, searchParams]);

  const updateConsent = useCallback(async (value: "granted" | "denied") => {
    const response = await fetch("/api/privacy/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: value }),
    });
    if (!response.ok) return;
    setConsentState(await response.json() as ConsentState);
    setPreferencesOpen(false);
  }, []);

  const track = useCallback(async (
    eventName: MetaEventName,
    parameters: Record<string, string | number> = {},
    options: TrackOptions = {},
  ) => {
    const eventId = options.eventId ?? browserUuid();
    if (!consent?.marketingAllowed || disabled) return eventId;
    window.fbq?.("track", eventName, parameters, { eventID: eventId });
    if (options.server) {
      const currentAttribution = captureAttribution();
      setAttribution(currentAttribution);
      void fetch("/api/meta/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
        },
        body: JSON.stringify({
          eventId,
          eventName,
          eventSourceUrl: window.location.href,
          attribution: currentAttribution,
          emailHash: options.emailHash,
        }),
      }).catch(() => undefined);
    }
    return eventId;
  }, [consent?.marketingAllowed, disabled]);

  const value = useMemo<MetaTrackingValue>(() => ({
    ready: consent !== null,
    enabled: Boolean(consent?.marketingAllowed && !disabled),
    attribution,
    track,
    setConsent: updateConsent,
    hashEmail: sha256Hex,
  }), [attribution, consent, disabled, track, updateConsent]);

  const showBanner = !disabled && consent?.consent === "unset";
  return (
    <MetaTrackingContext.Provider value={value}>
      {children}
      {showBanner && (
        <aside className="privacy-consent-banner" role="dialog" aria-label="Privacy choices">
          <div><strong>Your privacy choices</strong><p>{consent.requiresConsent ? "We use Meta marketing tools to measure ads only if you allow them. The website works either way." : "Marketing measurement is enabled for this region. You can turn it off now or later; the website works either way."}</p></div>
          <div><button type="button" onClick={() => void updateConsent("denied")}>{consent.requiresConsent ? "Decline" : "Turn off"}</button><button className="primary" type="button" onClick={() => void updateConsent("granted")}>{consent.requiresConsent ? "Allow marketing" : "Continue"}</button></div>
        </aside>
      )}
      {!disabled && consent && !showBanner && (
        <button className="privacy-settings-trigger" type="button" onClick={() => setPreferencesOpen(true)}>Privacy choices</button>
      )}
      {preferencesOpen && (
        <div className="privacy-modal-backdrop" role="presentation" onMouseDown={() => setPreferencesOpen(false)}>
          <section className="privacy-modal" role="dialog" aria-modal="true" aria-label="Privacy choices" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Privacy choices</h2><p>Marketing measurement is currently <strong>{consent?.marketingAllowed ? "on" : "off"}</strong>. You can change it at any time.</p>
            <div><button type="button" onClick={() => void updateConsent("denied")}>Turn off</button><button className="primary" type="button" onClick={() => void updateConsent("granted")}>Allow marketing</button></div>
          </section>
        </div>
      )}
    </MetaTrackingContext.Provider>
  );
}

export function useMetaTracking() {
  const value = useContext(MetaTrackingContext);
  if (!value) throw new Error("useMetaTracking must be used inside MetaTrackingProvider");
  return value;
}
