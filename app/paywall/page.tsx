import { Suspense } from "react";
import { PaywallPage } from "@/components/billing/paywall-page";

export default function Page() {
  return <Suspense fallback={<div className="onboarding-loading"><span /></div>}><PaywallPage /></Suspense>;
}
