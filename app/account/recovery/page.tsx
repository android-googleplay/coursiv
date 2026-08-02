import { Suspense } from "react";
import { AccountRecoveryScreen } from "@/components/auth/account-recovery-screen";

export default function Page() {
  return <Suspense fallback={<div className="onboarding-loading"><span/></div>}><AccountRecoveryScreen/></Suspense>;
}
