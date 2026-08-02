import { Suspense } from "react";
import { AccountActionScreen } from "@/components/auth/account-action-screen";

export default function Page() {
  return <Suspense fallback={<div className="onboarding-loading"><span/></div>}><AccountActionScreen/></Suspense>;
}
