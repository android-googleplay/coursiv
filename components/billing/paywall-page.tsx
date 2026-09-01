"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { useMetaTracking } from "@/components/privacy/meta-tracking-provider";
import { browserUuid } from "@/lib/platform/browser-uuid";

type Offer = {
  configured: boolean;
  productName?: string;
  productDescription?: string | null;
  amount?: number;
  currency?: string;
  interval?: "day" | "week" | "month" | "year";
  intervalCount?: number;
};

function priceLabel(offer: Offer | null) {
  if (!offer?.configured || !offer.amount || !offer.currency) return "Price unavailable";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: offer.currency }).format(offer.amount / 100);
}

export function PaywallPage() {
  const auth = useAuth();
  const meta = useMetaTracking();
  const searchParams = useSearchParams();
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/offer", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: Offer) => { if (active) setOffer(value); })
      .catch(() => { if (active) setOffer({ configured: false }); });
    return () => { active = false; };
  }, []);

  const checkout = async () => {
    setError("");
    setBusy(true);
    try {
      const token = await auth.getToken();
      if (!token) throw new Error("Please sign in again to continue.");
      const eventId = browserUuid();
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId, attribution: meta.attribution }),
      });
      const result = await response.json() as { url?: string; error?: string; eventId?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Unable to start secure checkout.");
      await meta.track("InitiateCheckout", {
        value: (offer?.amount ?? 0) / 100,
        currency: offer?.currency ?? "USD",
      }, { eventId: result.eventId ?? eventId });
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start secure checkout.");
      setBusy(false);
    }
  };

  return (
    <main className="paywall-stage">
      <section className="paywall-card">
        <span className="paywall-kicker"><Sparkles />YOUR PERSONAL PLAN IS READY</span>
        <h1>Build practical AI skills, one focused lesson at a time.</h1>
        <p>Unlock the complete learning path, guided practice and progress tracking.</p>
        {searchParams.get("checkout") === "canceled" && <div className="paywall-notice">Checkout was canceled. You have not been charged.</div>}
        <div className="paywall-offer">
          <div><small>{offer?.productName ?? "Coursiv membership"}</small><strong>{priceLabel(offer)}</strong><span>{offer?.configured ? `every ${offer.intervalCount && offer.intervalCount > 1 ? `${offer.intervalCount} ` : ""}${offer.interval}` : "Secure billing will appear when Stripe is configured"}</span></div>
          <ul><li><Check />Full course library</li><li><Check />Interactive practice and feedback</li><li><Check />Progress saved across devices</li></ul>
          {error && <p className="paywall-error" role="alert">{error}</p>}
          <button type="button" disabled={busy || !offer?.configured} onClick={() => void checkout()}>{busy ? "Opening secure checkout…" : "Continue to payment"}<ArrowRight /></button>
          <small className="paywall-secure"><LockKeyhole />Secure checkout powered by Stripe</small>
        </div>
        <footer><ShieldCheck />Your payment details are entered on Stripe and never stored by Coursiv.</footer>
      </section>
    </main>
  );
}
