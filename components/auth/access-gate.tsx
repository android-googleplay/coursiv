"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { useLearner } from "@/components/member/learner-context";

const publicPrefixes = ["/admin", "/login", "/verify", "/legal", "/dynamic", "/email-preview", "/account/recovery", "/account/action", "/worksheet-builder"];

export function AccessGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const learner = useLearner();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/" || publicPrefixes.some((prefix) => pathname.startsWith(prefix));
  useEffect(() => {
    if (!auth.loading && !auth.user && !isPublic) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [auth.loading, auth.user, isPublic, pathname, router]);
  if (!isPublic && (auth.loading || !auth.user || !learner.ready)) return <div className="onboarding-loading"><span /></div>;
  return children;
}
