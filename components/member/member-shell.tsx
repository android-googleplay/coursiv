"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Flame, Gamepad2, History, Home, Sparkles, UserRound } from "lucide-react";
import type { MemberTab } from "@/lib/member-data";
import { calculateStreaks, localDateKey } from "@/lib/learner-state";
import { useLearner } from "./learner-context";

const tabs: { id: MemberTab; href: string; label: string; icon: typeof BookOpen }[] = [
  { id: "courses", href: "/dashboard", label: "Home", icon: Home },
  { id: "courses", href: "/courses", label: "Courses", icon: BookOpen },
  { id: "courses", href: "/ai-tools", label: "AI Tools", icon: Sparkles },
  { id: "games", href: "/games", label: "Games", icon: Gamepad2 },
  { id: "profile", href: "/profile", label: "Profile", icon: UserRound },
];

export function LumoraLogo() {
  return <Link href="/dashboard" className="member-logo" aria-label="Coursiv dashboard"><span>C</span>Coursiv</Link>;
}

export function MemberShell({ children, title, showTop = true, hideNav = false }: { children: React.ReactNode; title?: string; showTop?: boolean; hideNav?: boolean }) {
  const pathname = usePathname();
  const { state } = useLearner();
  const streak = calculateStreaks(state.activityDates, localDateKey(new Date(), state.preferences.timezone)).current;
  return (
    <div className="member-frame">
      <main className={`member-shell ${hideNav ? "member-no-nav" : ""} ${pathname==="/ai-tools"?"ai-tools-shell":""}`}>
        {showTop && (
          <header className={`member-topbar ${pathname==="/courses"?"show-mobile-top-nav":""}`}>
            <LumoraLogo />
            {title&&<h1 className="member-page-title">{title}</h1>}
            <nav className="member-nav" aria-label="Member navigation">
              {tabs.map((tab,index) => {const active=pathname===tab.href||(index===1&&["/course/","/certificate-programs","/use-cases","/challenges"].some((path)=>pathname.startsWith(path)));const Icon=tab.icon;return <Link key={`${tab.href}-${index}`} href={tab.href} className={active?"active":""}><Icon size={21}/><span>{tab.label}</span></Link>})}
            </nav>
            {pathname==="/ai-tools"?<span className="ai-top-actions"><b><Sparkles/>∞</b><History/></span>:<span className="streak-pill" aria-label={`${streak} day learning streak`}><Flame size={19} fill="currentColor" /> {streak}</span>}
          </header>
        )}
        {children}
        {!hideNav&&showTop&&<nav className="member-mobile-nav" aria-label="Mobile member navigation">{tabs.slice(1).map((tab)=>{const active=pathname===tab.href||(tab.href==="/courses"&&["/dashboard","/course/","/certificate-programs","/use-cases","/challenges"].some(path=>pathname.startsWith(path)));const Icon=tab.icon;return <Link key={`mobile-${tab.href}`} href={tab.href} className={active?"active":""}><Icon size={23}/><span>{tab.label}</span></Link>})}</nav>}
        {!hideNav && !showTop && (
          <nav className="member-nav" aria-label="Member navigation">
            {tabs.map((tab) => {
              const active = pathname === tab.href || (tab.id === "courses" && ["/courses", "/certificate-programs", "/use-cases", "/challenges"].some((path) => pathname.startsWith(path)));
              const Icon = tab.icon;
              return <Link key={`${tab.href}-${tab.label}`} href={tab.href} className={active ? "active" : ""}><Icon size={23} strokeWidth={active ? 2.6 : 2} /><span>{tab.label}</span></Link>;
            })}
          </nav>
        )}
      </main>
    </div>
  );
}

export function PlaceholderArt({ index = 0, label, src }: { index?: number; label?: string; src?:string }) {
  return <div className={`placeholder-art art-${index % 6} ${src?"has-image":""}`} style={src?{backgroundImage:`url(${src})`}:undefined} aria-label={`${label ?? "Coursiv"} course artwork`}><i /><b>{label?.slice(0, 2).toUpperCase() ?? "AI"}</b><span>✦</span></div>;
}
