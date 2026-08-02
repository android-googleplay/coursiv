"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { SafeRichText } from "@/components/shared/safe-rich-text";
import { useMetaTracking } from "@/components/privacy/meta-tracking-provider";
import { useAuth } from "@/components/auth/auth-context";
import {
  contentString,
  type OnboardingFunnelPage,
  type OnboardingFunnelOption,
} from "@/lib/onboarding-funnel";

type FunnelState = {
  answers: Record<string, string>;
  email?: string;
  name?: string;
};

const storageKey = "coursiv.acquisition.c-1185.v1";

function mediaFor(page: OnboardingFunnelPage, reference: unknown) {
  if (typeof reference !== "string" || !reference) return page.media[0]?.localSrc;
  const clean = reference.split("/").pop();
  return page.media.find((media) =>
    media.reference === reference ||
    media.reference.split("/").pop() === clean ||
    media.sourceUrl.split("/").pop() === clean
  )?.localSrc;
}

function optionMedia(page: OnboardingFunnelPage, option: OnboardingFunnelOption) {
  const image = option.source.image;
  if (typeof image === "string") return mediaFor(page, image);
  if (Array.isArray(image)) {
    const first = image[0] as { image?: unknown } | undefined;
    return mediaFor(page, first?.image);
  }
  const icon = option.source.icon;
  return mediaFor(page, icon);
}

function nestedWildContent(page: OnboardingFunnelPage) {
  const blocks = page.content.blocks;
  if (!Array.isArray(blocks)) return null;
  const first = blocks[0] as { page?: unknown[] } | undefined;
  const nested = first?.page?.[0];
  return nested && typeof nested === "object" ? nested as Record<string, unknown> : null;
}

function primaryImage(page: OnboardingFunnelPage) {
  const nested = nestedWildContent(page);
  return mediaFor(
    page,
    nested?.image ??
      page.content.mainImage ??
      page.content.socialProofImage ??
      page.content.goalImage ??
      (Array.isArray(page.content.image)
        ? (page.content.image[0] as { image?: unknown } | undefined)?.image
        : page.content.image),
  );
}

function buttonLabel(page: OnboardingFunnelPage) {
  const button = page.content.button;
  if (typeof button === "string") return button;
  if (button && typeof button === "object" && "text" in button) {
    return String((button as { text?: unknown }).text ?? "Continue");
  }
  return "Continue";
}

function getList(page: OnboardingFunnelPage) {
  const list = page.content.list;
  if (!Array.isArray(list)) return [];
  return list.map((item) => item as Record<string, unknown>);
}

function FunnelHeader({
  page,
  canGoBack,
  onBack,
}: {
  page: OnboardingFunnelPage;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const current = page.progress.current;
  const total = page.progress.total || 16;
  return (
    <header className="funnel-header">
      <button
        type="button"
        aria-label="Go back"
        className={canGoBack ? "" : "invisible"}
        onClick={onBack}
      >
        <ArrowLeft />
      </button>
      <div className="funnel-logo"><span>C</span><strong>Coursiv</strong></div>
      <span className="funnel-safe"><LockKeyhole />Secure</span>
      {current !== null && current > 0 && (
        <div className="funnel-progress" aria-label={`Question ${current} of ${total}`}>
          <i style={{ width: `${Math.min(100, current / total * 100)}%` }} />
          <small>{current} / {total}</small>
        </div>
      )}
    </header>
  );
}

function QuestionPage({
  page,
  selected,
  onSelect,
}: {
  page: OnboardingFunnelPage;
  selected?: string;
  onSelect: (option: OnboardingFunnelOption) => void;
}) {
  const subtitle = contentString(page.content, "subtitle");
  return (
    <section className="funnel-question">
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      {subtitle && <SafeRichText value={subtitle} as="p" />}
      <div className="funnel-options" role="radiogroup">
        {page.options.map((option) => {
          const image = optionMedia(page, option);
          return (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={selected === option.id}
              className={selected === option.id ? "selected" : ""}
              onClick={() => onSelect(option)}
            >
              {image && <img src={image} alt="" />}
              <span>{option.label}</span>
              <i>{selected === option.id ? <Check /> : <ArrowRight />}</i>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TeaserPage({
  page,
  onContinue,
}: {
  page: OnboardingFunnelPage;
  onContinue: () => void;
}) {
  const nested = nestedWildContent(page);
  const title = String(nested?.title ?? page.content.title ?? page.title);
  const description = String(
    nested?.description ?? page.content.description ?? page.content.subtitle ?? "",
  );
  const image = ["02-classic-social-proof", "08-wild-page", "15-wild-page-2", "21-followup-teaser-page", "27-solution-pitch-page"].includes(page.id)
    ? undefined
    : primaryImage(page);
  return (
    <section className="funnel-teaser">
      {image && <img src={image} alt="" />}
      <SafeRichText value={title} as="h1" inline />
      {description && <SafeRichText value={description} />}
      <button className="funnel-primary" type="button" onClick={onContinue}>
        {buttonLabel(page)}<ArrowRight />
      </button>
    </section>
  );
}

function InputPage({
  page,
  value,
  type,
  onChange,
  onContinue,
}: {
  page: OnboardingFunnelPage;
  value: string;
  type: "email" | "text";
  onChange: (value: string) => void;
  onContinue: () => void | Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    if (type === "text" && value.trim().length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try { await onContinue(); } finally { setBusy(false); }
  };
  return (
    <section className="funnel-input-page">
      <span className="funnel-orb"><Sparkles /></span>
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      {contentString(page.content, "subtitle") && (
        <SafeRichText value={contentString(page.content, "subtitle")} />
      )}
      <label>
        <span>{type === "email" ? "Email address" : "Your name"}</span>
        <input
          autoFocus
          type={type}
          value={value}
          autoComplete={type}
          placeholder={contentString(page.content, "placeholder") || (type === "email" ? "you@example.com" : "Enter your name")}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void submit()}
        />
      </label>
      {error && <p className="funnel-error" role="alert">{error}</p>}
      <button className="funnel-primary" type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? "Please wait…" : buttonLabel(page)}<ArrowRight />
      </button>
      <small><ShieldCheck />Your information is encrypted and kept private.</small>
    </section>
  );
}

function MagicPage({ page }: { page: OnboardingFunnelPage }) {
  return (
    <section className="funnel-magic">
      <span className="funnel-spinner"><Sparkles /></span>
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      <p>{contentString(page.content, "subtitle")}</p>
      <div className="funnel-loading"><i /><span>{contentString(page.content, "loadingText")}</span></div>
    </section>
  );
}

function workdayProfile(answers: Record<string, string>) {
  const values = Object.values(answers).join(" ");
  if (/(constantly-reacting|messages-and-requests-control|overwhelmed-by-too-many)/.test(values)) {
    return { name: "Reactive Responder", opportunity: "Protect one focused hour and reduce incoming-task control." };
  }
  if (/(manual-data-entry|repetitive|repeated-admin|email|meetings)/.test(values)) {
    return { name: "Manual Work Specialist", opportunity: "Turn one repeated task into a safe, reusable workflow." };
  }
  if (/(frequently-distracted|struggle-to-start|deciding-what-to-do-next|switching-between-tasks)/.test(values)) {
    return { name: "Scattered Starter", opportunity: "Choose one daily outcome and create a reliable starting ritual." };
  }
  if (/(manage-a-team|manager|team-leader|executive|business-owner)/.test(values)) {
    return { name: "Overloaded Operator", opportunity: "Delegate routine preparation while keeping decisions human." };
  }
  return { name: "Emerging AI Operator", opportunity: "Build your first dependable AI-assisted workday workflow." };
}

function SummaryPage({
  page,
  answers,
  onContinue,
}: {
  page: OnboardingFunnelPage;
  answers: Record<string, string>;
  onContinue: () => void;
}) {
  const rows = Array.isArray(page.content.rows)
    ? page.content.rows as Array<Record<string, unknown>>
    : [];
  const profile = workdayProfile(answers);
  return (
    <section className="funnel-summary">
      <span className="funnel-step">PERSONALIZED FOR YOU</span>
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      {contentString(page.content, "subtitle") && <SafeRichText value={contentString(page.content, "subtitle")} />}
      {page.type === "personalized-summary-page" && (
        <div className="funnel-meter-card">
          <small>YOUR AI WORKDAY PROFILE</small>
          <strong>{profile.name}</strong>
          <p>{profile.opportunity}</p>
          <span><i /></span>
        </div>
      )}
      {rows.length > 0 && (
        <div className="funnel-summary-rows">
          {rows.slice(0, 4).map((row, index) => {
            const value = row.value as Record<string, unknown> | undefined;
            return (
              <div key={index}>
                <Target />
                <span><small>{String(row.label ?? "Your plan")}</small><strong>{String(value?.default ?? "Personalized for your goals")}</strong></span>
              </div>
            );
          })}
        </div>
      )}
      {getList(page).length > 0 && (
        <div className="funnel-benefit-list">
          {getList(page).slice(0, 6).map((item, index) => (
            <div key={index}><CheckCircle2 /><SafeRichText value={String(item.item ?? "")} /></div>
          ))}
        </div>
      )}
      {page.type === "before-after-page-personalized" && (
        <div className="funnel-before-after">
          <article><small>WITHOUT A SYSTEM</small><strong>Reactive and overloaded</strong><p>Requests and repeated work control the day.</p></article>
          <ArrowRight />
          <article><small>WITH AI WORKDAY</small><strong>Focused and in control</strong><p>Repeatable workflows protect your important work.</p></article>
        </div>
      )}
      <button className="funnel-primary" type="button" onClick={onContinue}>
        {buttonLabel(page)}<ArrowRight />
      </button>
      <span className="funnel-answer-count"><Check />{Object.keys(answers).length} answers used to personalize this plan</span>
    </section>
  );
}

function TestimonialsPage({
  page,
  onContinue,
}: {
  page: OnboardingFunnelPage;
  onContinue: () => void;
}) {
  const deliverables = [
    "Clearer emails",
    "Action-ready meetings",
    "Faster documents",
    "Reusable workflows",
  ];
  return (
    <section className="funnel-testimonials">
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      {contentString(page.content, "subtitle") && <SafeRichText value={contentString(page.content, "subtitle")} />}
      <div>
        {deliverables.map((item) => (
          <article className="funnel-proof-card" key={item}>
            <CheckCircle2 />
            <strong>{item}</strong>
            <small>Created through a guided workplace exercise</small>
          </article>
        ))}
      </div>
      <button className="funnel-primary" type="button" onClick={onContinue}>See my plan<ArrowRight /></button>
    </section>
  );
}

function OfferPage({ page }: { page: OnboardingFunnelPage }) {
  const auth = useAuth();
  return (
    <section className="funnel-offer">
      <span className="funnel-offer-kicker"><Sparkles />YOUR PERSONAL PLAN</span>
      <SafeRichText value={contentString(page.content, "title") || page.title} as="h1" inline />
      <p>{contentString(page.content, "subtitle") || "Start with short daily lessons and build a practical system for your role."}</p>
      <div className="funnel-goals">
        <article><Target /><span><small>Your goal</small><strong>Take control of my workday</strong></span></article>
        <article><Clock3 /><span><small>Your daily plan</small><strong>10 minutes a day</strong></span></article>
      </div>
      <article className="funnel-plan-card">
        <span>RECOMMENDED START</span>
        <h2>Complete AI Workday Program</h2>
        <ul>
          <li><Check />6 practical launch courses</li>
          <li><Check />Daily guided workplace practice</li>
          <li><Check />Progress tracking and reusable workflows</li>
        </ul>
        <Link className="funnel-primary" href={auth.user ? "/paywall" : "/login?next=/paywall"}>Continue securely<ArrowRight /></Link>
        <small><LockKeyhole />Sign in to save your plan and continue securely.</small>
      </article>
    </section>
  );
}

function FunnelPageBody({
  page,
  state,
  setState,
  onContinue,
  onQuizStart,
  onLead,
}: {
  page: OnboardingFunnelPage;
  state: FunnelState;
  setState: React.Dispatch<React.SetStateAction<FunnelState>>;
  onContinue: () => void;
  onQuizStart: () => void;
  onLead: (email: string) => Promise<void>;
}) {
  if (page.type === "gender-select-landing" || page.type === "question-page") {
    return (
      <QuestionPage
        page={page}
        selected={state.answers[page.slug ?? page.id]}
        onSelect={(option) => {
          if (page.type === "gender-select-landing") onQuizStart();
          setState((current) => ({
            ...current,
            answers: { ...current.answers, [page.slug ?? page.id]: option.id },
          }));
          window.setTimeout(onContinue, 180);
        }}
      />
    );
  }
  if (page.type === "magic-page") return <MagicPage page={page} />;
  if (page.type === "email-page") {
    return <InputPage page={page} type="email" value={state.email ?? ""} onChange={(email) => setState((current) => ({ ...current, email }))} onContinue={async () => { await onLead(state.email ?? ""); onContinue(); }} />;
  }
  if (page.type === "enter-name-page") {
    return <InputPage page={page} type="text" value={state.name ?? ""} onChange={(name) => setState((current) => ({ ...current, name }))} onContinue={onContinue} />;
  }
  if (page.type === "social-proof-testimonials-page") return <TestimonialsPage page={page} onContinue={onContinue} />;
  if (page.type === "selling-page") return <OfferPage page={page} />;
  if (["personalized-summary-page", "before-after-page-personalized", "solution-pitch-page"].includes(page.type)) {
    return <SummaryPage page={page} answers={state.answers} onContinue={onContinue} />;
  }
  return <TeaserPage page={page} onContinue={onContinue} />;
}

export function AcquisitionFunnel({
  pages,
  initialIndex,
}: {
  pages: OnboardingFunnelPage[];
  initialIndex: number;
}) {
  const router = useRouter();
  const meta = useMetaTracking();
  const quizStarted = useRef(false);
  const leadSent = useRef(false);
  const [state, setState] = useState<FunnelState>(() => {
    if (typeof window === "undefined") return { answers: {} };
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) as FunnelState : { answers: {} };
    } catch {
      sessionStorage.removeItem(storageKey);
      return { answers: {} };
    }
  });
  const page = pages[initialIndex] ?? pages[0];

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const query = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    if (!params.has("prc_id")) params.set("prc_id", "1185");
    return `?${params.toString()}`;
  }, []);
  const move = (offset: number) => {
    const target = pages[Math.max(0, Math.min(pages.length - 1, initialIndex + offset))];
    if (target) router.push(`${target.path}${query}`);
  };
  useEffect(() => {
    if (page?.type !== "magic-page") return;
    const timeout = window.setTimeout(() => move(1), 4200);
    return () => window.clearTimeout(timeout);
    // The page index is the timer boundary; move is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  if (!page) return null;
  return (
    <main className={`acquisition-funnel funnel-${page.type}`}>
      <div className="funnel-shell">
        <FunnelHeader page={page} canGoBack={initialIndex > 0} onBack={() => move(-1)} />
        <FunnelPageBody
          page={page}
          state={state}
          setState={setState}
          onContinue={() => move(1)}
          onQuizStart={() => {
            if (quizStarted.current) return;
            quizStarted.current = true;
            void meta.track("ViewContent", { content_name: "onboarding_quiz" });
          }}
          onLead={async (email) => {
            if (leadSent.current) return;
            leadSent.current = true;
            const emailHash = await meta.hashEmail(email);
            await meta.track("Lead", {}, { server: true, emailHash });
          }}
        />
        <footer>© 2026 Coursiv · <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link></footer>
      </div>
    </main>
  );
}

export function AcquisitionFunnelPreview({ page }: { page: OnboardingFunnelPage }) {
  const [state, setState] = useState<FunnelState>({ answers: {} });
  return (
    <div className="acquisition-funnel funnel-preview">
      <div className="funnel-shell">
        <FunnelHeader page={page} canGoBack onBack={() => undefined} />
        <FunnelPageBody page={page} state={state} setState={setState} onContinue={() => undefined} onQuizStart={() => undefined} onLead={async () => undefined} />
      </div>
    </div>
  );
}
