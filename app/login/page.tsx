import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
export default function Page(){return <Suspense fallback={<div className="onboarding-loading"><span /></div>}><AuthScreen/></Suspense>}
