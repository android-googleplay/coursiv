"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Heart, Home, MessageCircle, MoreHorizontal, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import type { CoursivLesson } from "@/lib/coursiv-content";
import { shortsQuizData, type ShortsQuizQuestion } from "@/lib/shorts-quiz-data";
import { useLearner } from "@/components/member/learner-context";
import { useScrollToResult } from "@/components/shared/use-scroll-to-result";

type ShortItem = {
  lesson: CoursivLesson;
  prompt: string;
  quiz: ShortsQuizQuestion[];
  video: string;
};

type QuizState = {
  questionIndex: number;
  selectedIndex: number | null;
  score: number;
  complete: boolean;
};

const initialQuizState: QuizState = { questionIndex: 0, selectedIndex: null, score: 0, complete: false };

function ShortsQuizFeedback({correct,explanation,onAdvance,label}:{correct:boolean;explanation:string;onAdvance:()=>void;label:string}) {
  const feedbackRef=useScrollToResult<HTMLElement>(true);
  return <footer ref={feedbackRef}>
    <p className={correct?"correct":"incorrect"}>
      <strong>{correct?"Correct":"Not quite"}</strong>
      {explanation}
    </p>
    <button type="button" onClick={onAdvance}>{label}</button>
  </footer>;
}

export function ShortsLessonPlayer({
  courseId,
  courseTitle,
  lessons,
  initialLessonId,
}: {
  courseId: string;
  courseTitle: string;
  lessons: CoursivLesson[];
  initialLessonId: string;
}) {
  const router = useRouter();
  const { completeLesson, state } = useLearner();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const previousVolumeRef = useRef(1);
  const scrollDirectionRef = useRef<"up" | "down">("down");
  const lastScrollTopRef = useRef(0);
  const didInitialScrollRef = useRef(false);
  const [activeFeedId, setActiveFeedId] = useState(`${initialLessonId}:video`);
  const [volume, setVolume] = useState(0);
  const [paused, setPaused] = useState(false);
  const [watchedLessonIds, setWatchedLessonIds] = useState<string[]>([]);
  const [favoriteLessonIds, setFavoriteLessonIds] = useState<string[]>([]);
  const [quizStates, setQuizStates] = useState<Record<string, QuizState>>({});
  const [promptLesson, setPromptLesson] = useState<ShortItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const shorts = useMemo<ShortItem[]>(() => lessons.map((lesson) => {
    const blocks = lesson.screens.flatMap((screen) => screen.blocks);
    const video = blocks.find((block) => block.type === "video");
    const prompt = blocks.find((block) => block.type === "callout" && block.tone === "copy-prompt");
    return {
      lesson,
      video: video?.type === "video" ? video.src : "",
      prompt: prompt?.type === "callout" ? prompt.text : "",
      quiz: shortsQuizData[courseId]?.[lesson.slug] ?? [],
    };
  }).filter((item) => item.video), [courseId, lessons]);
  const completedIds = state.courses[courseId]?.completedLessonIds ?? [];
  const watchedFeedKey = [...new Set([...completedIds, ...watchedLessonIds])].sort().join("|");

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.dataset.scrollDirection = "down";
    if (!didInitialScrollRef.current) {
      const initialCard = feed.querySelector<HTMLElement>(`[data-feed-id="${CSS.escape(`${initialLessonId}:video`)}"]`);
      initialCard?.scrollIntoView({ block: "start" });
      lastScrollTopRef.current = feed.scrollTop;
      didInitialScrollRef.current = true;
    }
    const trackScrollDirection = () => {
      const nextScrollTop = feed.scrollTop;
      if (Math.abs(nextScrollTop - lastScrollTopRef.current) > 3) {
        scrollDirectionRef.current = nextScrollTop < lastScrollTopRef.current ? "up" : "down";
        feed.dataset.scrollDirection = scrollDirectionRef.current;
        lastScrollTopRef.current = nextScrollTop;
      }
    };
    feed.addEventListener("scroll", trackScrollDirection, { passive: true });
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const target = visible?.target as HTMLElement | undefined;
      const nextFeedId = target?.dataset.feedId;
      const nextLessonId = target?.dataset.lessonId;
      const nextType = target?.dataset.feedType;
      if (nextFeedId && nextLessonId) {
        if (nextType === "quiz" && scrollDirectionRef.current === "up") {
          const previousLessonCard = feed.querySelector<HTMLElement>(`[data-feed-id="${CSS.escape(`${nextLessonId}:video`)}"]`);
          if (previousLessonCard) {
            requestAnimationFrame(() => previousLessonCard.scrollIntoView({ behavior: "smooth", block: "start" }));
            return;
          }
        }
        setActiveFeedId(nextFeedId);
        setPaused(false);
        window.history.replaceState(null, "", `/course/${courseId}/lesson/${nextLessonId}${nextType === "quiz" ? "?view=quiz" : ""}`);
      }
    }, { root: feed, threshold: [0.55, 0.7, 0.9] });
    feed.querySelectorAll<HTMLElement>("[data-feed-id]").forEach((card) => observer.observe(card));
    return () => {
      feed.removeEventListener("scroll", trackScrollDirection);
      observer.disconnect();
    };
  }, [courseId, initialLessonId, watchedFeedKey]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.querySelectorAll<HTMLVideoElement>("video[data-short-video]").forEach((video) => {
      const isActive = activeFeedId === `${video.dataset.shortVideo}:video`;
      video.muted = volume === 0;
      video.volume = volume;
      if (!isActive || paused || promptLesson) video.pause();
      else void video.play().catch(() => undefined);
    });
  }, [activeFeedId, paused, promptLesson, volume]);

  const markWatchedAndLoop = (item: ShortItem, video: HTMLVideoElement) => {
    const alreadyWatched = watchedLessonIds.includes(item.lesson.slug) || completedIds.includes(item.lesson.slug);
    if (!alreadyWatched) {
      setWatchedLessonIds((current) => current.includes(item.lesson.slug) ? current : [...current, item.lesson.slug]);
      void completeLesson(courseId, item.lesson.slug).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to save lesson progress.");
      });
    }
    video.currentTime = 0;
    if (activeFeedId === `${item.lesson.slug}:video`) void video.play().catch(() => undefined);
  };

  const openTakeaway = (item: ShortItem) => {
    setError("");
    setPromptLesson(item);
    setCopied(false);
  };

  const copyPrompt = async () => {
    if (!promptLesson) return;
    try {
      await navigator.clipboard.writeText(promptLesson.prompt);
      setCopied(true);
    } catch {
      setError("Select the prompt and copy it manually.");
    }
  };

  const toggleFavorite = (lessonId: string) => {
    setFavoriteLessonIds((current) => current.includes(lessonId) ? current.filter((id) => id !== lessonId) : [...current, lessonId]);
  };

  const toggleMute = () => {
    if (volume === 0) setVolume(previousVolumeRef.current || 1);
    else {
      previousVolumeRef.current = volume;
      setVolume(0);
    }
  };

  const chooseAnswer = (lessonId: string, question: ShortsQuizQuestion, optionIndex: number) => {
    setQuizStates((current) => {
      const quiz = current[lessonId] ?? initialQuizState;
      if (quiz.selectedIndex !== null || quiz.complete) return current;
      return {
        ...current,
        [lessonId]: {
          ...quiz,
          selectedIndex: optionIndex,
          score: quiz.score + (optionIndex === question.correctIndex ? 1 : 0),
        },
      };
    });
  };

  const advanceQuiz = (lessonId: string, questionCount: number) => {
    setQuizStates((current) => {
      const quiz = current[lessonId] ?? initialQuizState;
      if (quiz.selectedIndex === null) return current;
      if (quiz.questionIndex >= questionCount - 1) return { ...current, [lessonId]: { ...quiz, complete: true } };
      return { ...current, [lessonId]: { ...quiz, questionIndex: quiz.questionIndex + 1, selectedIndex: null } };
    });
  };

  const continueAfterQuiz = (index: number) => {
    const nextLesson = shorts[index + 1];
    if (!nextLesson) {
      router.push(`/course/${courseId}`);
      return;
    }
    feedRef.current?.querySelector<HTMLElement>(`[data-feed-id="${CSS.escape(`${nextLesson.lesson.slug}:video`)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="shorts-lesson-player">
      <header className="shorts-topbar">
        <button type="button" onClick={() => router.push(`/course/${courseId}`)} aria-label="Back to course"><Home /></button>
        <span />
        <span />
      </header>

      <div className="shorts-feed" ref={feedRef} aria-label={`${courseTitle} lesson feed`}>
        {shorts.flatMap((item, index) => {
          const lessonId = item.lesson.slug;
          const videoFeedId = `${lessonId}:video`;
          const quizFeedId = `${lessonId}:quiz`;
          const activeVideo = activeFeedId === videoFeedId;
          const watched = watchedLessonIds.includes(lessonId) || completedIds.includes(lessonId);
          const favorite = favoriteLessonIds.includes(lessonId);
          const quizState = quizStates[lessonId] ?? initialQuizState;
          const question = item.quiz[quizState.questionIndex];

          return [
            <article className="shorts-card" data-feed-id={videoFeedId} data-feed-type="video" data-lesson-id={lessonId} key={videoFeedId}>
              <div className="shorts-card-content">
                <div className="shorts-video-shell" onClick={() => activeVideo && setPaused((value) => !value)}>
                  <video
                    ref={(video) => { if (video) videoRefs.current.set(lessonId, video); else videoRefs.current.delete(lessonId); }}
                    data-short-video={lessonId}
                    src={item.video}
                    muted={volume === 0}
                    playsInline
                    autoPlay={activeVideo}
                    preload={index < 2 ? "auto" : "metadata"}
                    aria-label={item.lesson.title}
                    onEnded={(event) => markWatchedAndLoop(item, event.currentTarget)}
                  />
                  {activeVideo && paused && <span className="shorts-play-indicator"><Play fill="currentColor" /></span>}
                  {activeVideo && <div className="shorts-volume-control">
                    <div className="shorts-volume-slider">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        style={{ "--shorts-volume": `${volume * 100}%` } as React.CSSProperties}
                        aria-label="Video volume"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          const nextVolume = Number(event.target.value);
                          if (nextVolume > 0) previousVolumeRef.current = nextVolume;
                          setVolume(nextVolume);
                        }}
                      />
                    </div>
                    <button type="button" aria-label={volume === 0 ? "Unmute video" : "Mute video"} aria-pressed={volume === 0} onClick={(event) => { event.stopPropagation(); toggleMute(); }}>
                      {volume === 0 ? <VolumeX /> : <Volume2 />}
                    </button>
                  </div>}
                </div>
                <div className="shorts-video-info">
                  <span>LESSON {index + 1} OF {shorts.length}</span>
                  <h1>{item.lesson.title}</h1>
                  <small>{courseTitle}</small>
                  <button
                    type="button"
                    className={`shorts-status-pill ${watched ? "watched" : ""}`}
                    disabled={!watched}
                    onClick={() => openTakeaway(item)}
                  >{watched ? "View Takeaway" : "Incomplete"}</button>
                  {error && activeVideo && <p className="shorts-error" role="alert">{error}</p>}
                </div>
                <aside className="shorts-action-rail" aria-label="Video actions">
                  <button type="button" className={favorite ? "active" : ""} aria-pressed={favorite} onClick={() => toggleFavorite(lessonId)}><Heart fill={favorite ? "currentColor" : "none"} /><span>{favorite ? "Saved" : "Favorite"}</span></button>
                  <button type="button" disabled aria-label="Comments coming soon"><MessageCircle /><span>Comment</span></button>
                  <button type="button" disabled aria-label="Share coming soon"><Send /><span>Share</span></button>
                  <button type="button" disabled aria-label="More actions coming soon"><MoreHorizontal /><span>More</span></button>
                </aside>
              </div>
            </article>,
            watched ? <article className="shorts-card shorts-quiz-card" data-feed-id={quizFeedId} data-feed-type="quiz" data-lesson-id={lessonId} key={quizFeedId}>
              <div className="shorts-quiz-layout">
                <section className="shorts-quiz-shell" aria-label={`${item.lesson.title} quiz`}>
                  {!quizState.complete && question ? <>
                    <header>
                      <span>LESSON {index + 1} QUIZ</span>
                      <small>QUESTION {quizState.questionIndex + 1} OF {item.quiz.length}</small>
                    </header>
                    <div className="shorts-quiz-progress" aria-hidden="true"><i style={{ width: `${((quizState.questionIndex + 1) / item.quiz.length) * 100}%` }} /></div>
                    {quizState.selectedIndex !== null && <ShortsQuizFeedback
                      correct={quizState.selectedIndex===question.correctIndex}
                      explanation={question.explanation}
                      label={quizState.questionIndex===item.quiz.length-1?"See result":"Next question"}
                      onAdvance={()=>advanceQuiz(lessonId,item.quiz.length)}
                    />}
                    <div className="shorts-quiz-question">
                      <h2>{question.question}</h2>
                      <div className="shorts-quiz-options">
                        {question.options.map((option, optionIndex) => {
                          const answered = quizState.selectedIndex !== null;
                          const correct = answered && optionIndex === question.correctIndex;
                          const incorrect = answered && optionIndex === quizState.selectedIndex && optionIndex !== question.correctIndex;
                          return <button
                            type="button"
                            className={correct ? "correct" : incorrect ? "incorrect" : ""}
                            disabled={answered}
                            onClick={() => chooseAnswer(lessonId, question, optionIndex)}
                            key={option}
                          ><b>{String.fromCharCode(65 + optionIndex)}</b><span>{option}</span>{correct && <Check />}{incorrect && <X />}</button>;
                        })}
                      </div>
                    </div>
                  </> : <div className="shorts-quiz-result">
                    <span><Check /></span>
                    <small>QUIZ COMPLETE</small>
                    <h2>{quizState.score} / {item.quiz.length}</h2>
                    <p>{quizState.score === item.quiz.length ? "Perfect — you got every answer right." : "Nice work — your takeaway is ready whenever you need it."}</p>
                    <button type="button" onClick={() => continueAfterQuiz(index)}>{index < shorts.length - 1 ? "Continue to next lesson" : "Back to course"}</button>
                  </div>}
                </section>
              </div>
            </article> : null,
          ];
        })}
      </div>

      {promptLesson && (
        <div className="shorts-prompt-backdrop" role="dialog" aria-modal="true" aria-labelledby="shorts-prompt-title">
          <section className="shorts-prompt-card">
            <button className="shorts-prompt-close" type="button" onClick={() => setPromptLesson(null)} aria-label="Close prompt"><X /></button>
            <span className="shorts-prompt-kicker"><Check /> Lesson takeaway</span>
            <h2 id="shorts-prompt-title">Copy this prompt</h2>
            <p>{promptLesson.prompt}</p>
            <button className="shorts-copy-button" type="button" onClick={() => void copyPrompt()}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy prompt"}</button>
            <button className="shorts-back-button" type="button" onClick={() => router.push(`/course/${courseId}`)}>Back to course</button>
            {error && <p className="shorts-error" role="alert">{error}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
