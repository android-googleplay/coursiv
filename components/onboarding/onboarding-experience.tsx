"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Search } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { loadOnboardingProfile, saveOnboardingProfile } from "@/lib/platform/user-profile-client";
import {
  defaultOnboardingState,
  getProgram,
  isProgramId,
  onboardingStorageKey,
  ONBOARDING_STORAGE_KEY,
  type OnboardingState,
  type OnboardingStep,
  type ProgramId,
  programs,
} from "@/lib/onboarding-data";
import { ProgramArt } from "./program-art";

function readOnboardingState(storageKey = ONBOARDING_STORAGE_KEY): OnboardingState {
  if (typeof window === "undefined") return defaultOnboardingState;

  const url = new URL(window.location.href);
  if (url.searchParams.get("reset") === "1") {
    localStorage.removeItem(storageKey);
    window.history.replaceState({}, "", url.pathname);
    return defaultOnboardingState;
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return defaultOnboardingState;
    const parsed = JSON.parse(saved) as Partial<OnboardingState>;
    const step = Number.isInteger(parsed.step) && Number(parsed.step) >= 0 && Number(parsed.step) <= 6
      ? Number(parsed.step) as OnboardingStep
      : 0;
    return {
      step,
      selectedProgram: isProgramId(parsed.selectedProgram) ? parsed.selectedProgram : "ai-mastery",
      completed: parsed.completed === true,
    };
  } catch {
    localStorage.removeItem(storageKey);
    return defaultOnboardingState;
  }
}

function programRoute(programId: ProgramId) {
  return `/certificate-programs/${programId === "ai-mastery" ? "ai-mastery" : programId === "personalized-ai" ? "program-2" : "program-3"}`;
}

function OnboardingProgress({ completed }: { completed: number }) {
  return (
    <div className="onboarding-progress" aria-label={`${completed} of 6 onboarding sections completed`}>
      {Array.from({ length: 6 }, (_, index) => <i key={index} className={index < completed ? "active" : ""} />)}
    </div>
  );
}

function CertificateArtwork() {
  const badges = ["✦", "J", "⌁", "♥", "◆"];
  return (
    <div className="certificate-art" aria-label="Coursiv AI Mastery certificate preview">
      <div className="certificate-grid" />
      <h2>AI Mastery Certification</h2>
      <span className="issued-label">ISSUED TO</span>
      <div className="certificate-name"><span>HJ</span><Pencil size={18} /></div>
      <div className="badge-cloud">
        {badges.map((badge, index) => <i key={index} className={`cert-badge badge-${index + 1}`}>{badge}</i>)}
      </div>
      <span className="certificate-watermark">L</span>
    </div>
  );
}

function ToolCards() {
  return (
    <div className="tool-grid">
      <article className="tool-card mint"><span>💬</span><strong>ChatGPT</strong><small>13 lessons</small></article>
      <article className="tool-card peach"><span>📝</span><strong>Claude</strong><small>10 lessons</small></article>
      <article className="tool-card lilac"><span>✨</span><strong>Gemini</strong><small>10 lessons</small></article>
      <article className="tool-card yellow"><span>🎨</span><strong>Midjourney</strong><small>12 lessons</small></article>
      <article className="tool-more"><Search size={25} /><strong>And many more...</strong></article>
    </div>
  );
}

function LearningSteps() {
  const steps = [
    ["📖", "Read a short lesson", "Learn through clear, digestible chunks written in simple language"],
    ["🛠️", "Try it yourself", "AI tools are built into the app. Practice right after you learn."],
    ["🎓", "Finish a course — earn a certificate", "Each course = a certificate. Finish a program = program certificate."],
  ];
  return (
    <div className="learning-steps">
      {steps.map(([emoji, title, text], index) => (
        <article key={title}>
          <span className={`learning-icon learning-${index}`}>{emoji}</span>
          <div><strong>{title}</strong><p>{text}</p></div>
        </article>
      ))}
    </div>
  );
}

function StreakCard() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <>
      <div className="streak-card">
        <p>Finish <strong>1 lesson</strong> to keep your streak</p>
        <div className="streak-days">
          {days.map((day, index) => (
            <div key={day} className={index < 4 ? "done" : index === 4 ? "today" : ""}>
              <span>{index < 4 && <Check size={16} strokeWidth={3.5} />}</span><small>{day}</small>
            </div>
          ))}
        </div>
      </div>
      <div className="streak-benefits">
        <article><span>🧠</span><p>Small daily sessions help you actually remember what you learn</p></article>
        <article><span>📈</span><p>Your streak keeps you motivated — one day at a time</p></article>
        <article><span>🏆</span><p>Students with a 7-day streak are 3x more likely to earn an AI program certificate</p></article>
      </div>
    </>
  );
}

export function OnboardingExperience() {
  const router = useRouter();
  const auth = useAuth();
  const [state, setState] = useState<OnboardingState>(readOnboardingState);
  const [hydratedProfileId, setHydratedProfileId] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const program = useMemo(() => getProgram(state.selectedProgram), [state.selectedProgram]);

  useEffect(() => {
    if (auth.loading) return;
    let active = true;
    if (!auth.user || auth.user.demo) {
      const profileId = auth.user?.id ?? "anonymous";
      queueMicrotask(() => {
        if (!active) return;
        if (!auth.user) { setState(readOnboardingState()); setHydratedProfileId(profileId); return; }
        const scopedKey = onboardingStorageKey(auth.user.id);
        const scoped = localStorage.getItem(scopedKey);
        const legacy = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        const local = scoped ? readOnboardingState(scopedKey) : legacy ? readOnboardingState() : defaultOnboardingState;
        localStorage.setItem(scopedKey, JSON.stringify(local));
        localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        setState(local); setHydratedProfileId(profileId);
      });
      return () => { active = false; };
    }
    const userId = auth.user.id;
    void loadOnboardingProfile(userId).then((remote) => {
      if (!active) return;
      const scopedKey = onboardingStorageKey(userId);
      if (remote) {
        const step = Number.isInteger(remote.step) && remote.step >= 0 && remote.step <= 6 ? remote.step as OnboardingStep : 0;
        const next = { step, selectedProgram: isProgramId(remote.selectedProgram) ? remote.selectedProgram : "ai-mastery" as ProgramId, completed: remote.completed };
        localStorage.setItem(scopedKey, JSON.stringify(next)); setState(next); return;
      }
      const scoped = localStorage.getItem(scopedKey);
      const legacy = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const local = scoped ? readOnboardingState(scopedKey) : legacy ? readOnboardingState() : defaultOnboardingState;
      localStorage.setItem(scopedKey, JSON.stringify(local)); localStorage.removeItem(ONBOARDING_STORAGE_KEY); setState(local);
    }).catch(() => undefined).finally(() => { if (active) setHydratedProfileId(userId); });
    return () => { active = false; };
  }, [auth.loading, auth.user]);

  const remoteReady = hydratedProfileId === (auth.user?.id ?? "anonymous");

  useEffect(() => {
    if (!hydrated || !remoteReady) return;
    const storageKey = auth.user ? onboardingStorageKey(auth.user.id) : ONBOARDING_STORAGE_KEY;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [auth.user, hydrated, remoteReady, state]);

  useEffect(() => {
    if (!hydrated || !remoteReady || !auth.user || auth.user.demo) return;
    void saveOnboardingProfile(auth.user.id, state).catch(() => undefined);
  }, [auth.user, hydrated, remoteReady, state]);

  useEffect(() => {
    if (hydrated && state.completed) router.replace(programRoute(state.selectedProgram));
  }, [hydrated, router, state.completed, state.selectedProgram]);

  const goNext = useCallback(() => {
    setState((current) => ({ ...current, step: Math.min(current.step + 1, 6) as OnboardingStep }));
  }, []);

  const chooseProgram = useCallback((selectedProgram: ProgramId) => {
    setState((current) => ({ ...current, selectedProgram, step: 6 }));
  }, []);

  const complete = useCallback(() => {
    const completedState = { ...state, completed: true };
    localStorage.setItem(auth.user ? onboardingStorageKey(auth.user.id) : ONBOARDING_STORAGE_KEY, JSON.stringify(completedState));
    setState(completedState);
    const finish = async () => {
      if (auth.user && !auth.user.demo) await saveOnboardingProfile(auth.user.id, completedState);
      router.push(programRoute(state.selectedProgram));
    };
    void finish();
  }, [auth.user, router, state]);

  if (!hydrated || auth.loading || !remoteReady || state.completed) return <div className="onboarding-loading"><span /></div>;

  if (state.step === 0) {
    return (
      <main className="onboarding-stage intro-screen">
        <div className="intro-copy"><h1>Hello! Before we dive in,<br />let&apos;s take a closer look at<br />your learning path</h1></div>
        <div className="intro-footer"><button type="button" onClick={goNext}>Get Started</button></div>
      </main>
    );
  }

  if (state.step === 1) {
    return (
      <main className="onboarding-stage onboarding-white certificate-screen">
        <div className="onboarding-content">
          <CertificateArtwork />
          <h1>Welcome to your AI Program</h1>
          <p>This plan is designed to take you from your first AI tool to earning the AI Mastery Certification.</p>
        </div>
        <div className="onboarding-footer"><button type="button" onClick={goNext}>I&apos;m ready</button></div>
      </main>
    );
  }

  if (state.step === 2) {
    return (
      <main className="onboarding-stage onboarding-white">
        <OnboardingProgress completed={1} />
        <div className="onboarding-content standard-content">
          <h1>Every tool you master earns you a certificate</h1>
          <p>Coursiv has 30+ in-depth courses. Finish a course and get a named certificate you can download and share.</p>
          <ToolCards />
          <div className="callout">Your first certificate can be earned in <strong>just a few days!</strong></div>
        </div>
        <div className="onboarding-footer"><button type="button" onClick={goNext}>Continue</button></div>
      </main>
    );
  }

  if (state.step === 3) {
    return (
      <main className="onboarding-stage onboarding-white">
        <OnboardingProgress completed={3} />
        <div className="onboarding-content standard-content how-content">
          <h1>How it works — 3 simple steps</h1>
          <p>Read. Try. Get a certificate. That&apos;s it.</p>
          <LearningSteps />
        </div>
        <div className="onboarding-footer"><button type="button" onClick={goNext}>Continue</button></div>
      </main>
    );
  }

  if (state.step === 4) {
    return (
      <main className="onboarding-stage onboarding-white">
        <OnboardingProgress completed={4} />
        <div className="onboarding-content standard-content streak-content">
          <h1>One lesson a day is all it takes</h1>
          <p>Just 10 minutes. Morning with coffee, evening before bed — whenever works. The key is not to break the chain.</p>
          <StreakCard />
        </div>
        <div className="onboarding-footer"><button type="button" onClick={goNext}>Continue</button></div>
      </main>
    );
  }

  if (state.step === 5) {
    return (
      <main className="onboarding-stage onboarding-white">
        <OnboardingProgress completed={5} />
        <div className="onboarding-content standard-content programs-content">
          <h1>Which program do you want to start first?</h1>
          <p>Just your starting point. All programs are available anytime.</p>
          <div className="program-list">
            {programs.map((item) => (
              <button type="button" key={item.id} onClick={() => chooseProgram(item.id)}>
                <ProgramArt variant={item.thumbnail} />
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
              </button>
            ))}
          </div>
          <strong className="more-programs">And 14 more programs...</strong>
        </div>
      </main>
    );
  }

  return (
    <main className="onboarding-stage onboarding-white">
      <OnboardingProgress completed={6} />
      <div className="onboarding-content all-set-content">
        <span className="target-emoji">🎯</span>
        <h1>You&apos;re all set</h1>
        <p>Everything is ready. Here&apos;s your path:</p>
        <div className="path-summary">
          <article><span>📚</span><div><strong>Start with: {program.title}</strong><small>{program.courseSubtitle}</small></div></article>
          <article><span>⏱️</span><div><strong>Your first certificate</strong><small>After completing 1 course</small></div></article>
          <article><span>🏆</span><div><strong>Program certificate</strong><small>After completing all 5 courses</small></div></article>
        </div>
      </div>
      <div className="onboarding-footer"><button type="button" onClick={complete}>Continue</button></div>
    </main>
  );
}
