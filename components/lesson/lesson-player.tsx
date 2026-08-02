"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CirclePlay,
  Flag,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import {
  defaultLessonSession,
  getLessonScreen,
  getLessonScreenIndex,
  LESSON_ID,
  LESSON_STORAGE_KEY,
  lessonStorageKey,
  lessonScreens,
  type LessonMode,
  type LessonSession,
  type ReasoningAnswer,
  type TaskAnswer,
} from "@/lib/lesson-data";
import { ChatInterfaceMock, ChatWorkMock, LumoraCharacterArt } from "./lesson-artwork";
import { useLearner } from "@/components/member/learner-context";
import { useAuth } from "@/components/auth/auth-context";

function readLessonSession(userId:string,remoteScreenId:string|null|undefined): LessonSession {
  if (typeof window === "undefined") return defaultLessonSession;
  try {
    const storageKey=lessonStorageKey(userId);const scoped=localStorage.getItem(storageKey);const legacy=localStorage.getItem(LESSON_STORAGE_KEY);const parsed = JSON.parse(scoped??legacy??"{}") as Partial<LessonSession>;
    if(!scoped&&legacy)localStorage.setItem(storageKey,legacy);localStorage.removeItem(LESSON_STORAGE_KEY);
    const validRemoteScreen=lessonScreens.some((screen)=>screen.id===remoteScreenId);const validScreen = lessonScreens.some((screen) => screen.id === parsed.screenId);
    return {
      screenId: validRemoteScreen ? remoteScreenId as LessonSession["screenId"] : validScreen ? parsed.screenId as LessonSession["screenId"] : "possibilities",
      answers: {
        ...defaultLessonSession.answers,
        ...(parsed.answers ?? {}),
      },
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
    };
  } catch {
    localStorage.removeItem(lessonStorageKey(userId));localStorage.removeItem(LESSON_STORAGE_KEY);
    return defaultLessonSession;
  }
}

function LessonHeader({ progress, mode, onBack, onModeChange }: { progress: number; mode: LessonMode; onBack: () => void; onModeChange: () => void }) {
  return (
    <header className="lesson-header">
      <button type="button" onClick={onBack} aria-label="Back to course"><ArrowLeft size={24} /></button>
      <div className="lesson-progress" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
      <button type="button" className="lesson-mode-toggle" onClick={onModeChange} aria-label={mode === "listen" ? "Switch to read mode" : "Switch to listen mode"}>
        {mode === "listen" ? <X size={22} /> : <Volume2 size={22} fill="currentColor" />}
      </button>
    </header>
  );
}

function StandardFeedback({ correct, title, children }: { correct: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className={`lesson-feedback ${correct ? "feedback-correct" : "feedback-incorrect"}`} role="status">
      <h2><span>{correct ? <Check size={19} strokeWidth={4} /> : <X size={20} strokeWidth={4} />}</span>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function SlideContent({ screenId, session, setSession }: { screenId: LessonSession["screenId"]; session: LessonSession; setSession: React.Dispatch<React.SetStateAction<LessonSession>> }) {

  if (screenId === "possibilities") {
    return (
      <div className="lesson-copy opening-slide">
        <h1>Endless Possibilities With<br />ChatGPT</h1>
        <p>Most people who use ChatGPT are only scratching the surface — and don&apos;t even know it. They type a question, get an answer, and call it a day.</p>
        <p>It works — but it&apos;s a fraction of what the tool can actually do. There&apos;s a whole layer of modes and features that completely changes how you interact with it, and this course is where you find out what you&apos;ve been missing.</p>
        <LumoraCharacterArt />
      </div>
    );
  }

  if (screenId === "first-challenge") {
    return (
      <div className="lesson-copy challenge-intro-slide">
        <LumoraCharacterArt />
        <h1>Your First ChatGPT Challenge</h1>
        <p>Imagine you&apos;re preparing for a job interview. You need company research, a tailored answer to &quot;tell me about yourself,&quot; and three practice questions — all from ChatGPT. Using the same approach for all three would slow you down.</p>
        <p>This lesson shows you how to match the right ChatGPT intelligence level and feature to the right task.</p>
      </div>
    );
  }

  if (screenId === "before-you-dive") {
    return (
      <div className="lesson-copy">
        <h1>Before You Dive In</h1>
        <p>Open ChatGPT, and the home page offers two modes: <strong>Chat</strong> and <strong>Work</strong>. Chat is where everyday tasks happen — questions, drafts, and research.</p>
        <p>Work is the power mode: an advanced workspace with extra settings for specialized, heavy-duty tasks.</p>
        <p><em>This course sticks with Chat:</em> it covers most tasks you&apos;ll run into daily. Work gets its own deep dive in a separate course.</p>
        <ChatWorkMock />
      </div>
    );
  }

  if (screenId === "model-tiers") {
    return (
      <div className="lesson-copy model-slide">
        <ChatInterfaceMock compact />
        <p>ChatGPT runs on a family of models that keep updating. The latest generation, <strong>GPT-5.6</strong>, comes in three tiers:</p>
        <ul><li><strong>Sol</strong> — the flagship and most capable</li><li><strong>Terra</strong> — balances capability, speed, and cost</li><li><strong>Luna</strong> — the fastest and lowest-cost in the family</li></ul>
        <p><em>Tiers and availability may change over time.</em> In a standard ChatGPT conversation, however, you usually choose a <strong>reasoning level</strong>, not a model.</p>
      </div>
    );
  }

  if (screenId === "intelligence-levels") {
    return (
      <div className="lesson-copy intelligence-slide">
        <p>In a standard ChatGPT conversation, however, you usually choose a <strong>reasoning level</strong>, not a model.</p>
        <p>That reasoning level is the <strong>Intelligence</strong> setting. It has three levels — <strong>Instant</strong>, <strong>Medium</strong>, and <strong>High</strong> (Pro plans unlock a few more) — and the one you pick shapes how much reasoning ChatGPT puts into your response.</p>
        <ChatInterfaceMock />
      </div>
    );
  }

  if (screenId === "reasoning-check") {
    const { reasoningChoice, reasoningSubmitted } = session.answers;
    const correct = reasoningChoice === "speed";
    const choose = (reasoningChoice: ReasoningAnswer) => setSession((current) => ({ ...current, answers: { ...current.answers, reasoningChoice, reasoningSubmitted: false } }));
    return (
      <div className="lesson-copy quiz-slide">
        <ChatInterfaceMock compact />
        <h1>Say you need to quickly write a summary section in your resume ASAP. What would you choose?</h1>
        <div className="lesson-options" role="radiogroup" aria-label="Choose a reasoning level">
          <button type="button" role="radio" aria-checked={reasoningChoice === "deep"} className={reasoningChoice === "deep" ? "selected" : ""} onClick={() => choose("deep")}><i />A level built to think longer and go deeper</button>
          <button type="button" role="radio" aria-checked={reasoningChoice === "speed"} className={reasoningChoice === "speed" ? "selected" : ""} onClick={() => choose("speed")}><i />A level built for speed and immediate output</button>
        </div>
        {!reasoningSubmitted && <button type="button" className="lesson-submit" disabled={!reasoningChoice} onClick={() => setSession((current) => ({ ...current, answers: { ...current.answers, reasoningSubmitted: true } }))}>Submit</button>}
        {reasoningSubmitted && (
          <StandardFeedback correct={correct} title={correct ? "Exactly!" : "Incorrect answer"}>
            {correct ? "A quick, time-sensitive task needs speed and immediate output." : "Deeper thinking helps with complex work, but for a simple, time-sensitive task like a resume summary, it just adds friction."}
          </StandardFeedback>
        )}
      </div>
    );
  }

  if (screenId === "instant-explanation") {
    return (
      <div className="lesson-copy instant-slide">
        {session.answers.reasoningChoice === "deep" && <StandardFeedback correct={false} title="Incorrect answer">Deeper thinking helps with complex work, but for a simple, time-sensitive task like a resume summary, it just adds friction.</StandardFeedback>}
        <p>For quick, straightforward tasks, <strong>Instant</strong> is your best pick. It&apos;s the fastest option, designed for everyday questions and immediate results.</p>
        <ChatInterfaceMock compact />
      </div>
    );
  }

  if (screenId === "task-challenge") {
    const chooseTask = (taskChoice: TaskAnswer) => setSession((current) => ({
      ...current,
      answers: { ...current.answers, taskChoice, taskResult: taskChoice === "complex" ? "correct" : "incorrect" },
      attempts: current.attempts + 1,
    }));
    const retry = () => setSession((current) => ({ ...current, answers: { ...current.answers, taskChoice: null, taskResult: null } }));
    return (
      <div className="task-challenge-slide">
        <div className="task-heading"><h1>Task Challenge</h1><p>Now, evaluate this task and decide if it&apos;s simple or complex.</p></div>
        <div className="task-body">
          <blockquote>&quot;Research the company, analyze the role, create interview answers, and give me practice questions&quot;</blockquote>
          <div className="task-options">
            <button type="button" className={session.answers.taskChoice === "complex" ? session.answers.taskResult === "correct" ? "correct" : "selected" : ""} onClick={() => chooseTask("complex")}>Complex</button>
            <button type="button" className={session.answers.taskChoice === "simple" ? "incorrect" : ""} onClick={() => chooseTask("simple")}>Simple</button>
          </div>
        </div>
        {session.answers.taskResult === "incorrect" && <div className="task-result incorrect"><h2><X size={20} strokeWidth={4} />Incorrect</h2><p>This involves multiple steps and research — that&apos;s complex.</p><button type="button" onClick={retry}><RotateCcw size={18} />Try again</button></div>}
        {session.answers.taskResult === "correct" && <div className="task-result correct"><h2><Check size={20} strokeWidth={4} />Amazing!</h2><p>Multiple steps and deep analysis = complex task.</p></div>}
      </div>
    );
  }

  if (screenId === "deeper-reasoning") {
    return (
      <div className="lesson-copy deeper-slide">
        <div className="repeat-task"><RotateCcw size={20} /> Repeat task</div>
        <p>A multi-step task like this benefits from more reasoning. This is exactly what <strong>Medium</strong> and <strong>High</strong> are built for.</p>
        <p>Both spend more time thinking than Instant, so expect a slower (but deeper) response.</p>
        <ChatInterfaceMock />
      </div>
    );
  }

  return (
    <div className="lesson-copy final-slide">
      <p>Prefer to skip the choice? Turn on <strong>Higher intelligence</strong> so Instant scales up to a higher intelligence level when a task needs deeper thinking. Find it in <strong>Settings → General.</strong></p>
      <LumoraCharacterArt variant="robot" />
    </div>
  );
}

function AudioDock({ playing, rate, onToggle, onPrevious, onNext, onRate }: { playing: boolean; rate: number; onToggle: () => void; onPrevious: () => void; onNext: () => void; onRate: () => void }) {
  return (
    <div className="audio-dock" aria-label="Lesson narration controls">
      <button type="button" onClick={onPrevious} aria-label="Previous narration segment"><SkipBack size={26} fill="currentColor" /></button>
      <button type="button" onClick={onToggle} aria-label={playing ? "Pause narration" : "Play narration"}>{playing ? <Pause size={27} fill="currentColor" /> : <CirclePlay size={31} fill="currentColor" />}</button>
      <button type="button" onClick={onNext} aria-label="Next narration segment"><SkipForward size={26} fill="currentColor" /></button>
      <button type="button" className="audio-rate" onClick={onRate} aria-label={`Narration speed ${rate}x`}>{rate}x</button>
    </div>
  );
}

export function LessonPlayer() {
  const router = useRouter();
  const auth = useAuth();
  const { state:learnerState,saveScreen, completeLesson: recordCompleteLesson } = useLearner();
  const searchParams = useSearchParams();
  const requestedMode: LessonMode = searchParams.get("mode") === "listen" ? "listen" : "read";
  const userId=auth.user?.id??"anonymous";const remoteProgress=learnerState.courses.chatgpt;const remoteScreenId=remoteProgress?.lastLessonId===LESSON_ID?remoteProgress.lastScreenId:null;
  const [session, setSession] = useState<LessonSession>(()=>readLessonSession(userId,remoteScreenId));
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [audioState, setAudioState] = useState<"stopped" | "playing" | "paused">("stopped");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const screen = useMemo(() => getLessonScreen(session.screenId), [session.screenId]);
  const screenIndex = getLessonScreenIndex(session.screenId);
  const speechToken = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const speechSupported = hydrated && typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  useEffect(() => {
    if (hydrated) { localStorage.setItem(lessonStorageKey(userId), JSON.stringify(session)); const operation=saveQueue.current.catch(()=>undefined).then(()=>saveScreen("chatgpt", LESSON_ID, session.screenId));saveQueue.current=operation;void operation.catch((reason)=>setSyncError(reason instanceof Error?reason.message:"Unable to save this screen")); }
  }, [hydrated, saveScreen, session,userId]);

  const stopSpeech = useCallback(() => {
    speechToken.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setAudioState("stopped");
  }, []);

  useEffect(() => () => {
    speechToken.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speakFrom = useCallback((startIndex: number, rateOverride?: number) => {
    if (!speechSupported || requestedMode !== "listen") return;
    const token = ++speechToken.current;
    window.speechSynthesis.cancel();

    const speakSegment = (index: number) => {
      if (token !== speechToken.current || index >= screen.narration.length) {
        setAudioState("stopped");
        return;
      }
      setSegmentIndex(index);
      const utterance = new SpeechSynthesisUtterance(screen.narration[index]);
      utterance.lang = "en-US";
      utterance.rate = rateOverride ?? rate;
      const englishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;
      utterance.onstart = () => setAudioState("playing");
      utterance.onpause = () => setAudioState("paused");
      utterance.onresume = () => setAudioState("playing");
      utterance.onend = () => speakSegment(index + 1);
      utterance.onerror = () => setAudioState("stopped");
      window.speechSynthesis.speak(utterance);
    };
    speakSegment(startIndex);
  }, [rate, requestedMode, screen.narration, speechSupported]);

  const toggleSpeech = useCallback(() => {
    if (audioState === "playing") {
      window.speechSynthesis.pause();
      setAudioState("paused");
    } else if (audioState === "paused") {
      window.speechSynthesis.resume();
      setAudioState("playing");
    } else {
      speakFrom(segmentIndex);
    }
  }, [audioState, segmentIndex, speakFrom]);

  const skipSegment = useCallback((direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(segmentIndex + direction, 0), screen.narration.length - 1);
    stopSpeech();
    setSegmentIndex(nextIndex);
    speakFrom(nextIndex);
  }, [screen.narration.length, segmentIndex, speakFrom, stopSpeech]);

  const cycleRate = useCallback(() => {
    const rates = [0.75, 1, 1.25, 1.5];
    const nextRate = rates[(rates.indexOf(rate) + 1) % rates.length];
    const shouldResume = audioState !== "stopped";
    stopSpeech();
    setRate(nextRate);
    if (shouldResume) window.setTimeout(() => speakFrom(segmentIndex, nextRate), 0);
  }, [audioState, rate, segmentIndex, speakFrom, stopSpeech]);

  const canContinue = session.screenId === "reasoning-check"
    ? session.answers.reasoningSubmitted
    : session.screenId === "task-challenge"
      ? session.answers.taskResult === "correct"
      : true;

  const completeLesson = useCallback(async () => {
    if (completing) return;
    setCompleting(true);setSyncError("");
    try {
      await saveQueue.current;
      await recordCompleteLesson("chatgpt", LESSON_ID);
      localStorage.removeItem(lessonStorageKey(userId));
      stopSpeech();
      router.push("/course/chatgpt");
    } catch (reason) {
      setSyncError(reason instanceof Error?reason.message:"Unable to complete this lesson");
      setCompleting(false);
    }
  }, [completing, recordCompleteLesson, router, stopSpeech,userId]);

  const continueLesson = useCallback(() => {
    if (!canContinue) return;
    if (screenIndex === lessonScreens.length - 1) {
      void completeLesson();
      return;
    }
    stopSpeech();
    setSegmentIndex(0);
    const nextScreenId = lessonScreens[screenIndex + 1].id;
    setSession((current) => ({ ...current, screenId: nextScreenId }));
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [canContinue, completeLesson, screenIndex, stopSpeech]);

  const switchMode = useCallback(() => {
    stopSpeech();
    router.replace(`?mode=${requestedMode === "listen" ? "read" : "listen"}`);
  }, [requestedMode, router, stopSpeech]);

  const reportScreen=useCallback(async()=>{if(reported||reporting)return;setReporting(true);try{if(!auth.user?.demo){const token=await auth.getToken();const response=await fetch("/api/support",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({type:"feedback",message:`Lesson screen feedback: ChatGPT / ${LESSON_ID} / ${session.screenId}`})});const data=await response.json();if(!response.ok)throw new Error(data.error??"Unable to send feedback");}setReported(true)}catch(reason){setSyncError(reason instanceof Error?reason.message:"Unable to send feedback")}finally{setReporting(false)}},[auth,reported,reporting,session.screenId]);

  if (!hydrated) return <div className="onboarding-loading"><span /></div>;

  const effectiveMode: LessonMode = requestedMode === "listen" && speechSupported ? "listen" : "read";

  return (
    <main className={`lesson-player lesson-mode-${effectiveMode}`}>
      <LessonHeader progress={screen.progress} mode={effectiveMode} onBack={() => { stopSpeech(); router.push("/course/chatgpt"); }} onModeChange={switchMode} />
      {requestedMode === "listen" && !speechSupported && <div className="speech-fallback">Narration isn&apos;t supported in this browser. Read mode is still available.</div>}
      <div className="lesson-scroll-area">
        <section className="lesson-screen" key={screen.id} aria-label={`Lesson screen: ${screen.id.replaceAll("-", " ")}`}>
          <SlideContent screenId={screen.id} session={session} setSession={setSession} />
        </section>
      </div>
      <button type="button" disabled={reporting||reported} className={`lesson-flag ${reported ? "reported" : ""}`} onClick={()=>void reportScreen()} aria-label={reported ? "Feedback sent" : "Flag this lesson screen"}><Flag size={22} fill={reported ? "currentColor" : "none"} /></button>
      {reported && <span className="feedback-toast" role="status">Feedback sent</span>}
      {syncError && <div className="assistant-error lesson-sync-error" role="alert">{syncError}</div>}
      {effectiveMode === "listen" && <AudioDock playing={audioState === "playing"} rate={rate} onToggle={toggleSpeech} onPrevious={() => skipSegment(-1)} onNext={() => skipSegment(1)} onRate={cycleRate} />}
      {session.screenId !== "task-challenge" || session.answers.taskResult === "correct" ? (
        <div className="lesson-footer"><button type="button" disabled={!canContinue||completing} onClick={continueLesson}>{completing?"Saving…":screenIndex === lessonScreens.length - 1 ? "Complete lesson" : "Continue"}</button></div>
      ) : null}
    </main>
  );
}
