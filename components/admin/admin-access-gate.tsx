"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";

export function AdminAccessGate({ children }: { children?: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasChildren = children !== undefined;
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    if (auth.loading) return;
    let active = true;
    const check = async () => {
      let response = await fetch("/api/admin/session", { cache: "no-store" });
      if (response.status === 401 && auth.user) {
        const token = await auth.getToken();
        if (token) response = await fetch("/api/admin/session", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
      if (!active) return;
      if (response.ok) {
        if (hasChildren) setStatus("allowed");
        else router.refresh();
      }
      else {
        setStatus("denied");
        if (auth.user) router.replace("/dashboard?notice=admin-access-required");
        else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
    };
    void check();
    return () => { active = false; };
  }, [auth, hasChildren, pathname, router]);

  if (status !== "allowed") return <div className="onboarding-loading"><span /></div>;
  return children??<div className="onboarding-loading"><span /></div>;
}
